export type Profile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StopSummary = {
  cityName: string;
  countryName: string;
  isHomeBase: boolean;
  stayLabel: string | null;
  latitude: number;
  longitude: number;
};

export type LegSummary = {
  orderIndex: number;
  transportType: string;
  transportLabel: string | null;
};

export type FeedTrip = {
  id: string;
  localId: string;
  userId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  stopsJson: StopSummary[];
  legsJson: LegSummary[];
  isPublic: boolean;
  publishedAt: string;
  updatedAt: string;
  profile: Profile;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
};

export type TripComment = {
  id: string;
  tripId: string;
  userId: string;
  body: string;
  createdAt: string;
  profile: Profile;
};

export type UserProfile = Profile & {
  followersCount: number;
  followingCount: number;
  tripsCount: number;
  isFollowedByMe: boolean;
};
