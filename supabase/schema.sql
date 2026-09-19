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
CREATE POLICY "profiles_insert_own"  ON profiles FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING ((SELECT auth.uid()) = id);

-- published_trips
CREATE POLICY "trips_select" ON published_trips FOR SELECT
  USING (is_public = true OR (SELECT auth.uid()) = user_id);
CREATE POLICY "trips_insert_own" ON published_trips FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "trips_delete_own" ON published_trips FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- follows
CREATE POLICY "follows_select_all"  ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own"  ON follows FOR INSERT WITH CHECK ((SELECT auth.uid()) = follower_id);
CREATE POLICY "follows_delete_own"  ON follows FOR DELETE USING ((SELECT auth.uid()) = follower_id);

-- trip_likes
CREATE POLICY "likes_select_all"   ON trip_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_auth"  ON trip_likes FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "likes_delete_own"   ON trip_likes FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- trip_comments
CREATE POLICY "comments_select_all"  ON trip_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_auth" ON trip_comments FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "comments_delete_own"  ON trip_comments FOR DELETE USING ((SELECT auth.uid()) = user_id);

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

CREATE INDEX trip_collaborators_user_id_idx    ON trip_collaborators(user_id);
CREATE INDEX trip_collaborators_invited_by_idx ON trip_collaborators(invited_by);

-- SECURITY DEFINER helpers so policies on trip_collaborators and
-- published_trips can reference each other without RLS recursion.
--
-- They live in a `private` schema, not `public`: PostgREST only exposes its
-- configured schemas, so this keeps them callable from RLS policies while
-- removing them from /rest/v1/rpc/, where any signed-in user could invoke them.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_trip_owner(p_trip_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM published_trips WHERE id = p_trip_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.is_trip_editor(p_trip_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_collaborators
    WHERE trip_id = p_trip_id AND user_id = auth.uid() AND role = 'editor'
  );
$$;

-- RLS policies evaluate these with the caller's privileges, so authenticated
-- keeps EXECUTE; anon has no business calling them via RPC.
REVOKE ALL ON FUNCTION private.is_trip_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_trip_editor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_trip_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_trip_editor(UUID) TO authenticated;

ALTER TABLE trip_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collaborators_select" ON trip_collaborators
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR private.is_trip_owner(trip_id));

CREATE POLICY "collaborators_insert" ON trip_collaborators
  FOR INSERT WITH CHECK (private.is_trip_owner(trip_id) AND invited_by = (SELECT auth.uid()));

CREATE POLICY "collaborators_update" ON trip_collaborators
  FOR UPDATE USING (private.is_trip_owner(trip_id));

CREATE POLICY "collaborators_delete" ON trip_collaborators
  FOR DELETE USING (user_id = (SELECT auth.uid()) OR private.is_trip_owner(trip_id));

-- Owner and editor UPDATE rights are one policy, not two. Two permissive
-- policies for the same role/action are both evaluated on every row.
CREATE POLICY "trips_update_own_or_editor" ON published_trips
  FOR UPDATE USING (
    (SELECT auth.uid()) = user_id OR private.is_trip_editor(id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON trip_collaborators TO authenticated;

-- ─── Moderation: blocks and reports ───────────────────────────────────────────
-- Applied to the live project as migrations add_user_blocks_and_content_reports
-- + filter_blocked_content_in_rls.
--
-- Required by App Store Review Guideline 1.2 for user-generated content: a way
-- to report objectionable content, a way to block abusive users, filtering of
-- that content, and a published contact that acts on reports within 24 hours.

-- Blocking is mutual in effect: once A blocks B, neither sees the other's
-- content. Only A can undo it, so the row records who did it.
CREATE TABLE user_blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

-- Both directions are read on every feed query.
CREATE INDEX user_blocks_blocker_idx ON user_blocks(blocker_id);
CREATE INDEX user_blocks_blocked_idx ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Deliberately NOT readable by the blocked party: letting someone enumerate who
-- blocked them is itself a harassment vector.
CREATE POLICY "blocks_select_own" ON user_blocks
  FOR SELECT USING ((SELECT auth.uid()) = blocker_id);
CREATE POLICY "blocks_insert_own" ON user_blocks
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = blocker_id);
CREATE POLICY "blocks_delete_own" ON user_blocks
  FOR DELETE USING ((SELECT auth.uid()) = blocker_id);

GRANT SELECT, INSERT, DELETE ON user_blocks TO authenticated;

-- Reports are write-only for users: file one, see your own, change nothing.
CREATE TABLE content_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type     TEXT NOT NULL CHECK (target_type IN ('trip', 'comment', 'profile')),
  -- Not a foreign key: the reported row may be deleted by its author or by
  -- moderation, and the report must survive as a record of what happened.
  target_id       UUID NOT NULL,
  -- Denormalised so a report stays actionable after the target is gone.
  target_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL CHECK (
                    reason IN ('spam', 'harassment', 'hate', 'violence',
                               'sexual', 'misinformation', 'other')),
  details         TEXT CHECK (char_length(details) <= 1000),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One report per person per item; re-reporting the same thing adds nothing.
  UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX content_reports_status_idx   ON content_reports(status, created_at DESC);
CREATE INDEX content_reports_target_idx   ON content_reports(target_type, target_id);
CREATE INDEX content_reports_reporter_idx ON content_reports(reporter_id);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert_own" ON content_reports
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = reporter_id);
CREATE POLICY "reports_select_own" ON content_reports
  FOR SELECT USING ((SELECT auth.uid()) = reporter_id);

-- No UPDATE or DELETE policy: a filed report cannot be retracted or altered,
-- and nobody can touch anyone else's. Moderation happens out of band.
GRANT SELECT, INSERT ON content_reports TO authenticated;

-- Hide blocked users' content at the database rather than in the client, so the
-- app never needs to know who blocked it.
CREATE OR REPLACE FUNCTION private.is_hidden_user(p_other_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p_other_id)
       OR (b.blocked_id = auth.uid() AND b.blocker_id = p_other_id)
  );
$$;

REVOKE ALL ON FUNCTION private.is_hidden_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_hidden_user(UUID) TO authenticated;

-- Replaces the trips_select policy defined earlier in this file.
DROP POLICY IF EXISTS "trips_select" ON published_trips;
CREATE POLICY "trips_select" ON published_trips
  FOR SELECT USING (
    ((is_public = true) OR ((SELECT auth.uid()) = user_id))
    AND NOT private.is_hidden_user(user_id)
  );

-- Replaces the comments_select_all policy defined earlier in this file.
DROP POLICY IF EXISTS "comments_select_all" ON trip_comments;
CREATE POLICY "comments_select_all" ON trip_comments
  FOR SELECT USING (NOT private.is_hidden_user(user_id));

-- Profiles are deliberately NOT filtered here: the blocked-accounts screen has
-- to join profiles to show who you blocked. Search filters them client-side
-- using the viewer's own blocks, which RLS already exposes.
