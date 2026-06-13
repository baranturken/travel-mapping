import { supabase } from '@/lib/supabase';
import type { FeedTrip, LegSummary, Profile, StopSummary, TripComment, TripPhoto, UserProfile } from './types';

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    bannerUrl: (row.banner_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapFeedTrip(row: Record<string, unknown>, userId: string | null, likedIds: Set<string>): FeedTrip {
  const profileRaw = row.profile as Record<string, unknown>;
  const likeCount = (row.like_count as Array<unknown> | null)?.[0] ?? { count: 0 };
  const commentCount = (row.comment_count as Array<unknown> | null)?.[0] ?? { count: 0 };
  return {
    id: row.id as string,
    localId: row.local_id as string,
    userId: row.user_id as string,
    title: row.title as string,
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    stopsJson: (row.stops_json as StopSummary[]) ?? [],
    legsJson: (row.legs_json as LegSummary[]) ?? [],
    photosJson: (row.photos_json as TripPhoto[]) ?? [],
    coverImageUrl: (row.cover_image_url as string | null) ?? null,
    isPublic: row.is_public as boolean,
    publishedAt: row.published_at as string,
    updatedAt: row.updated_at as string,
    profile: mapProfile(profileRaw),
    likeCount: (likeCount as { count: number }).count,
    commentCount: (commentCount as { count: number }).count,
    isLikedByMe: likedIds.has(row.id as string),
  };
}

async function hydrateLikes(trips: Array<Record<string, unknown>>, userId: string | null): Promise<Set<string>> {
  if (!userId || trips.length === 0) return new Set();
  const ids = trips.map((t) => t.id as string);
  const { data } = await supabase
    .from('trip_likes')
    .select('trip_id')
    .eq('user_id', userId)
    .in('trip_id', ids);
  return new Set((data ?? []).map((r) => r.trip_id as string));
}

const TRIP_SELECT = `
  *,
  profile:profiles!user_id(id, username, display_name, avatar_url, bio, created_at, updated_at),
  like_count:trip_likes(count),
  comment_count:trip_comments(count)
`;

// ─── Feed ─────────────────────────────────────────────────────────────────────

export async function getFeed(userId: string, offset = 0): Promise<FeedTrip[]> {
  const { data: followRows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  const followingIds = (followRows ?? []).map((r) => r.following_id as string);
  if (followingIds.length === 0) return [];

  const { data, error } = await supabase
    .from('published_trips')
    .select(TRIP_SELECT)
    .in('user_id', followingIds)
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + 19);

  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const liked = await hydrateLikes(rows, userId);
  return rows.map((r) => mapFeedTrip(r, userId, liked));
}

export async function getRecommendations(userId: string, offset = 0): Promise<FeedTrip[]> {
  const { data, error } = await supabase
    .from('published_trips')
    .select(TRIP_SELECT)
    .neq('user_id', userId)
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + 19);

  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const liked = await hydrateLikes(rows, userId);
  return rows.map((r) => mapFeedTrip(r, userId, liked));
}

export async function getPublishedTrip(tripId: string, viewerId: string | null): Promise<FeedTrip | null> {
  const { data, error } = await supabase
    .from('published_trips')
    .select(TRIP_SELECT)
    .eq('id', tripId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const liked = await hydrateLikes([row], viewerId);
  return mapFeedTrip(row, viewerId, liked);
}

// ─── User trips ───────────────────────────────────────────────────────────────

export async function getUserTrips(userId: string, viewerId: string | null): Promise<FeedTrip[]> {
  const query = supabase
    .from('published_trips')
    .select(TRIP_SELECT)
    .eq('user_id', userId)
    .order('published_at', { ascending: false });

  if (viewerId !== userId) query.eq('is_public', true);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const liked = await hydrateLikes(rows, viewerId);
  return rows.map((r) => mapFeedTrip(r, viewerId, liked));
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function searchProfiles(query: string): Promise<Profile[]> {
  // Strip characters that have special meaning in PostgREST or-filters / ILIKE patterns
  const sanitized = query.replace(/[,%_()]/g, '').trim();
  if (!sanitized) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%`)
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => mapProfile(r as Record<string, unknown>));
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data ? mapProfile(data as Record<string, unknown>) : null;
}

export async function getUserProfile(userId: string, viewerId: string | null): Promise<UserProfile | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;

  const [{ count: followers }, { count: following }, { count: trips }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('published_trips').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_public', true),
  ]);

  let isFollowedByMe = false;
  if (viewerId && viewerId !== userId) {
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewerId)
      .eq('following_id', userId)
      .maybeSingle();
    isFollowedByMe = data !== null;
  }

  return {
    ...profile,
    followersCount: followers ?? 0,
    followingCount: following ?? 0,
    tripsCount: trips ?? 0,
    isFollowedByMe,
  };
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

// ─── Follows ──────────────────────────────────────────────────────────────────

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function getIsFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return data !== null;
}

// ─── Publish ──────────────────────────────────────────────────────────────────

export async function publishTrip(params: {
  localId: string;
  userId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  stopsJson: StopSummary[];
  legsJson: LegSummary[];
  photosJson: TripPhoto[];
  coverImageUrl?: string | null;
  isPublic: boolean;
}): Promise<string> {
  const row: Record<string, unknown> = {
    local_id: params.localId,
    user_id: params.userId,
    title: params.title,
    start_date: params.startDate,
    end_date: params.endDate,
    stops_json: params.stopsJson,
    legs_json: params.legsJson,
    photos_json: params.photosJson,
    is_public: params.isPublic,
    updated_at: new Date().toISOString(),
  };
  // Only overwrite the cover when a freshly rendered one was provided, so a
  // failed render on re-publish never blanks the existing cover image.
  if (params.coverImageUrl !== undefined && params.coverImageUrl !== null) {
    row.cover_image_url = params.coverImageUrl;
  }
  const { data, error } = await supabase
    .from('published_trips')
    .upsert(row, { onConflict: 'user_id,local_id' })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function unpublishTrip(supabaseId: string): Promise<void> {
  const { error } = await supabase.from('published_trips').delete().eq('id', supabaseId);
  if (error) throw error;
}

// ─── Likes ────────────────────────────────────────────────────────────────────

export async function likeTrip(tripId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('trip_likes').insert({ trip_id: tripId, user_id: userId });
  if (error && !error.message.includes('duplicate')) throw error;
}

export async function unlikeTrip(tripId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_likes')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getComments(tripId: string): Promise<TripComment[]> {
  const { data, error } = await supabase
    .from('trip_comments')
    .select(
      'id, trip_id, user_id, body, created_at, profile:profiles!user_id(id, username, display_name, avatar_url, bio, created_at, updated_at)',
    )
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      tripId: row.trip_id as string,
      userId: row.user_id as string,
      body: row.body as string,
      createdAt: row.created_at as string,
      profile: mapProfile(row.profile as Record<string, unknown>),
    };
  });
}

export async function addComment(tripId: string, userId: string, body: string): Promise<TripComment> {
  const { data, error } = await supabase
    .from('trip_comments')
    .insert({ trip_id: tripId, user_id: userId, body: body.trim() })
    .select('id, trip_id, user_id, body, created_at, profile:profiles!user_id(id, username, display_name, avatar_url, bio, created_at, updated_at)')
    .single();
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    userId: row.user_id as string,
    body: row.body as string,
    createdAt: row.created_at as string,
    profile: mapProfile(row.profile as Record<string, unknown>),
  };
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('trip_comments').delete().eq('id', commentId);
  if (error) throw error;
}
