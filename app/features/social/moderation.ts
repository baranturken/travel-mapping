import { supabase } from '@/lib/supabase';
import type { ReportReason, ReportTargetType } from '@/features/social/report-reasons';

export {
  REPORT_REASONS,
  type ReportReason,
  type ReportTargetType,
} from '@/features/social/report-reasons';

// User-generated content moderation: blocking, reporting, and the read-side
// filtering that makes a block actually mean something.
//
// Required by App Store Review Guideline 1.2 for any app with user-generated
// content: a way to report objectionable content, a way to block abusive
// users, filtering of that content, and a published contact that acts on
// reports within 24 hours.

// ─── Blocking ────────────────────────────────────────────────────────────────

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw new Error('You cannot block yourself.');

  // A plain insert, not an upsert. PostgREST compiles upsert to
  // INSERT ... ON CONFLICT DO UPDATE, which needs UPDATE privilege and an
  // UPDATE policy on user_blocks — neither of which exists, and neither of
  // which should: a block row has nothing to update. Blocking twice is simply
  // a no-op, so the duplicate-key error is the expected outcome, not a failure.
  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && error.code !== '23505') throw error;

  // Blocking implies not following. Leaving the follow edges in place would
  // keep the blocked account in follower counts and let a later unblock
  // silently restore a relationship the user meant to end.
  await supabase
    .from('follows')
    .delete()
    .or(
      `and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),` +
        `and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`,
    );
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

/** True when the viewer has blocked this user (not the reverse). */
export async function isBlockedByMe(viewerId: string, otherId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', viewerId)
    .eq('blocked_id', otherId)
    .maybeSingle();
  return data !== null;
}

/**
 * The ids this viewer has blocked.
 *
 * Only their own blocks — the reverse direction is deliberately not readable.
 * Content filtering for both directions happens in RLS, so the app never needs
 * to know who blocked it; handing a client that list would let anyone
 * enumerate it, which is a harassment vector in itself.
 *
 * Used only to filter profile search results, where the rows are profiles
 * rather than content and RLS intentionally leaves them visible.
 */
export async function listMyBlockedIds(viewerId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', viewerId);
  return (data ?? []).map((r) => r.blocked_id as string);
}

/** The viewer's own blocks, for a manage-blocked-accounts list. */
export async function listBlockedProfiles(viewerId: string) {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at, profile:profiles!blocked_id(*)')
    .eq('blocker_id', viewerId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// ─── Reporting ───────────────────────────────────────────────────────────────

export async function reportContent(params: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string | null;
  reason: ReportReason;
  details?: string;
}): Promise<void> {
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: params.reporterId,
    target_type: params.targetType,
    target_id: params.targetId,
    target_owner_id: params.targetOwnerId,
    reason: params.reason,
    details: params.details?.trim() || null,
  });

  // 23505 is unique_violation: this person already reported this item. That is
  // not a failure worth showing — the report is on file either way.
  if (error && error.code !== '23505') throw error;
}
