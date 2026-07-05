-- Travel Mapping — Supabase schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  banner_url    TEXT,
  bio           TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE published_trips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      TEXT NOT NULL,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title         TEXT NOT NULL,
  start_date    DATE,
  end_date      DATE,
  stops_json    JSONB NOT NULL DEFAULT '[]',
  legs_json     JSONB NOT NULL DEFAULT '[]',
  photos_json   JSONB NOT NULL DEFAULT '[]',
  cover_image_url TEXT,
  is_public     BOOLEAN DEFAULT TRUE NOT NULL,
  published_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, local_id)
);

CREATE TABLE follows (
  follower_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE trip_likes (
  trip_id       UUID REFERENCES published_trips(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (trip_id, user_id)
);

CREATE TABLE trip_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID REFERENCES published_trips(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  body          TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_published_trips_user_id    ON published_trips(user_id);
CREATE INDEX idx_published_trips_published  ON published_trips(published_at DESC);
CREATE INDEX idx_follows_follower           ON follows(follower_id);
CREATE INDEX idx_follows_following          ON follows(following_id);
CREATE INDEX idx_trip_likes_trip            ON trip_likes(trip_id);
CREATE INDEX idx_trip_comments_trip         ON trip_comments(trip_id, created_at);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER published_trips_updated_at
  BEFORE UPDATE ON published_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row-level security ───────────────────────────────────────────────────────

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_comments   ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_all"  ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = id);

-- published_trips
CREATE POLICY "trips_select" ON published_trips FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "trips_insert_own" ON published_trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trips_update_own" ON published_trips FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "trips_delete_own" ON published_trips FOR DELETE
  USING (auth.uid() = user_id);

-- follows
CREATE POLICY "follows_select_all"  ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own"  ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own"  ON follows FOR DELETE USING (auth.uid() = follower_id);

-- trip_likes
CREATE POLICY "likes_select_all"   ON trip_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_auth"  ON trip_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "likes_delete_own"   ON trip_likes FOR DELETE USING (auth.uid() = user_id);

-- trip_comments
CREATE POLICY "comments_select_all"  ON trip_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_auth" ON trip_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);
CREATE POLICY "comments_delete_own"  ON trip_comments FOR DELETE USING (auth.uid() = user_id);

-- ─── Grants ───────────────────────────────────────────────────────────────────
-- Required when the project does not auto-expose new tables to the Data API.
-- RLS still controls which rows are visible/writable; grants only open the door.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON profiles        TO anon, authenticated;
GRANT SELECT ON published_trips TO anon, authenticated;
GRANT SELECT ON follows         TO anon, authenticated;
GRANT SELECT ON trip_likes      TO anon, authenticated;
GRANT SELECT ON trip_comments   TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON profiles        TO authenticated;
GRANT INSERT, UPDATE, DELETE ON published_trips TO authenticated;
GRANT INSERT, DELETE         ON follows         TO authenticated;
GRANT INSERT, DELETE         ON trip_likes      TO authenticated;
GRANT INSERT, DELETE         ON trip_comments   TO authenticated;

-- ─── Storage: trip photos ─────────────────────────────────────────────────────
-- Public bucket so images load via their public object URL. Writes (and listing,
-- used before deletion) are restricted to each user's own {userId}/... folder.

INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "trip_photos_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "trip_photos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "trip_photos_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "trip_photos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trip-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Collaborative trip planning (groundwork) ─────────────────────────────────
-- Applied to the live project as migrations add_trip_collaborators +
-- restrict_collab_helper_functions. No app behavior changes until the invite
-- UI writes rows here.

CREATE TABLE trip_collaborators (
  trip_id     UUID REFERENCES published_trips(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

CREATE INDEX trip_collaborators_user_id_idx ON trip_collaborators(user_id);

-- SECURITY DEFINER helpers so policies on trip_collaborators and
-- published_trips can reference each other without RLS recursion.
CREATE OR REPLACE FUNCTION is_trip_owner(p_trip_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM published_trips WHERE id = p_trip_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_trip_editor(p_trip_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_collaborators
    WHERE trip_id = p_trip_id AND user_id = auth.uid() AND role = 'editor'
  );
$$;

-- RLS policies evaluate these with the caller's privileges, so authenticated
-- keeps EXECUTE; anon has no business calling them via RPC.
REVOKE EXECUTE ON FUNCTION is_trip_owner(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION is_trip_editor(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_trip_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_trip_editor(UUID) TO authenticated;

ALTER TABLE trip_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collaborators_select" ON trip_collaborators
  FOR SELECT USING (user_id = auth.uid() OR is_trip_owner(trip_id));

CREATE POLICY "collaborators_insert" ON trip_collaborators
  FOR INSERT WITH CHECK (is_trip_owner(trip_id) AND invited_by = auth.uid());

CREATE POLICY "collaborators_update" ON trip_collaborators
  FOR UPDATE USING (is_trip_owner(trip_id));

CREATE POLICY "collaborators_delete" ON trip_collaborators
  FOR DELETE USING (user_id = auth.uid() OR is_trip_owner(trip_id));

CREATE POLICY "published_trips_collaborator_update" ON published_trips
  FOR UPDATE USING (is_trip_editor(id));

GRANT SELECT, INSERT, UPDATE, DELETE ON trip_collaborators TO authenticated;
