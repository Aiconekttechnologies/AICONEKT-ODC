-- ============================================================================
-- AICONEXT / AICONEKT TECHNOLOGIES — Supabase Schema & Row-Level Security
-- Migration: 20261025000001_aiconext_schema_and_rls.sql
-- ============================================================================
-- Safe, idempotent PostgreSQL migration for:
--   1. public.admin_users        (Server-controlled administrator authorization)
--   2. public.projects           (Dashboard-managed projects with draft/publish/archive lifecycle)
--   3. public.events             (Dashboard-managed flagship events with timezone-aware dates)
--   4. public.contact_inquiries  (Public contact submissions, admin-only inbox read/manage)
--   5. public.career_applications(Public roster applications, admin-only review)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Utility Trigger: Automatically maintain updated_at in UTC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Administrator Authorization Table (public.admin_users)
-- ----------------------------------------------------------------------------
-- Ordinary users CANNOT insert, update, or delete rows in this table.
-- Privileges can only be granted via Supabase SQL Editor (postgres role) or
-- a trusted backend holding the service_role key.
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'Administrator' CHECK (role IN ('Founder', 'Administrator')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(user_id) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Non-recursive Security Definer helper with restricted search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke write privileges from client roles so no user can self-promote
REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM anon, authenticated;
REVOKE SELECT ON public.admin_users FROM anon;
GRANT SELECT ON public.admin_users TO authenticated;

-- Non-recursive self-lookup policy: an authenticated user can check only their own row
DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
CREATE POLICY "admin_users_select_self"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Projects Table (public.projects)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 160),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tagline TEXT CHECK (tagline IS NULL OR char_length(tagline) <= 240),
  description TEXT NOT NULL CHECK (char_length(btrim(description)) >= 10),
  image_url TEXT CHECK (image_url IS NULL OR image_url ~* '^https?://'),
  category TEXT NOT NULL DEFAULT 'ai-ml' CHECK (char_length(btrim(category)) > 0),
  technologies TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  live_url TEXT CHECK (live_url IS NULL OR live_url ~* '^https?://'),
  source_url TEXT CHECK (source_url IS NULL OR source_url ~* '^https?://'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT projects_publish_status_consistency CHECK (
    (is_published = TRUE AND status = 'published')
    OR (is_published = FALSE AND status IN ('draft', 'archived'))
  )
);

CREATE INDEX IF NOT EXISTS idx_projects_public_listing
  ON public.projects (is_published, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_category
  ON public.projects (category);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.projects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;

-- Public visitors (and any user) can ONLY read explicitly published projects
DROP POLICY IF EXISTS "projects_public_read_published" ON public.projects;
CREATE POLICY "projects_public_read_published"
  ON public.projects
  FOR SELECT
  TO anon, authenticated
  USING (is_published = TRUE AND status = 'published');

-- Authorized administrators can read all projects (including drafts & archived)
DROP POLICY IF EXISTS "projects_admin_read_all" ON public.projects;
CREATE POLICY "projects_admin_read_all"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Authorized administrators can create projects
DROP POLICY IF EXISTS "projects_admin_insert" ON public.projects;
CREATE POLICY "projects_admin_insert"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Authorized administrators can update/publish/unpublish/archive projects
DROP POLICY IF EXISTS "projects_admin_update" ON public.projects;
CREATE POLICY "projects_admin_update"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authorized administrators can delete projects
DROP POLICY IF EXISTS "projects_admin_delete" ON public.projects;
CREATE POLICY "projects_admin_delete"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Events Table (public.events)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 180),
  slug TEXT UNIQUE CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tagline TEXT CHECK (tagline IS NULL OR char_length(tagline) <= 240),
  category TEXT NOT NULL DEFAULT 'Hackathon' CHECK (char_length(btrim(category)) > 0),
  description TEXT NOT NULL CHECK (char_length(btrim(description)) >= 10),
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ CHECK (end_date IS NULL OR end_date >= event_date),
  location TEXT NOT NULL CHECK (char_length(btrim(location)) > 0),
  is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
  registration_url TEXT CHECK (registration_url IS NULL OR registration_url ~* '^https?://'),
  image_url TEXT CHECK (image_url IS NULL OR image_url ~* '^https?://'),
  prize_pool TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'ongoing', 'past', 'cancelled', 'archived')),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT events_publish_status_consistency CHECK (
    NOT (is_published = TRUE AND status IN ('draft', 'cancelled', 'archived'))
  )
);

CREATE INDEX IF NOT EXISTS idx_events_public_upcoming
  ON public.events (is_published, status, event_date ASC);

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;

-- Public visitors can ONLY read explicitly published events that qualify for public listing
DROP POLICY IF EXISTS "events_public_read_published" ON public.events;
CREATE POLICY "events_public_read_published"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = TRUE
    AND status IN ('upcoming', 'ongoing', 'past')
  );

-- Authorized administrators can read all events (including drafts, cancelled, archived)
DROP POLICY IF EXISTS "events_admin_read_all" ON public.events;
CREATE POLICY "events_admin_read_all"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Authorized administrators can create events
DROP POLICY IF EXISTS "events_admin_insert" ON public.events;
CREATE POLICY "events_admin_insert"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Authorized administrators can update/publish/unpublish events
DROP POLICY IF EXISTS "events_admin_update" ON public.events;
CREATE POLICY "events_admin_update"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authorized administrators can delete events
DROP POLICY IF EXISTS "events_admin_delete" ON public.events;
CREATE POLICY "events_admin_delete"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. Contact Inquiries Table (Preserves existing Connect & Dashboard Inbox)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject TEXT NOT NULL DEFAULT 'General Inquiry' CHECK (char_length(btrim(subject)) <= 200),
  category TEXT NOT NULL DEFAULT 'General Inquiry',
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 5 AND 5000),
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Read', 'In Progress', 'Responded', 'Closed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status
  ON public.contact_inquiries (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER trg_contact_inquiries_updated_at
  BEFORE UPDATE ON public.contact_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.contact_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_inquiries TO authenticated;

-- Public visitors can submit contact inquiries, but CANNOT read/update/delete them
DROP POLICY IF EXISTS "contact_inquiries_public_insert" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_public_insert"
  ON public.contact_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'New' AND admin_notes IS NULL);

DROP POLICY IF EXISTS "contact_inquiries_admin_select" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_select"
  ON public.contact_inquiries
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "contact_inquiries_admin_update" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_update"
  ON public.contact_inquiries
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "contact_inquiries_admin_delete" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_delete"
  ON public.contact_inquiries
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Career / Roster Applications Table (Preserves Join Roster & Dashboard tab)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.career_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_name TEXT NOT NULL CHECK (char_length(btrim(applicant_name)) BETWEEN 2 AND 120),
  applicant_email TEXT NOT NULL CHECK (applicant_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  department_name TEXT NOT NULL DEFAULT 'AI & Machine Learning',
  skills TEXT,
  cover_note TEXT,
  portfolio_url TEXT CHECK (portfolio_url IS NULL OR portfolio_url ~* '^https?://'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'accepted', 'declined')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_career_applications_submitted
  ON public.career_applications (submitted_at DESC);

ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.career_applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.career_applications TO authenticated;

DROP POLICY IF EXISTS "career_applications_public_insert" ON public.career_applications;
CREATE POLICY "career_applications_public_insert"
  ON public.career_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "career_applications_admin_select" ON public.career_applications;
CREATE POLICY "career_applications_admin_select"
  ON public.career_applications
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "career_applications_admin_update" ON public.career_applications;
CREATE POLICY "career_applications_admin_update"
  ON public.career_applications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "career_applications_admin_delete" ON public.career_applications;
CREATE POLICY "career_applications_admin_delete"
  ON public.career_applications
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Supabase Realtime Publication (for live public site updates)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
    END IF;
  END IF;
END
$$;

-- ============================================================================
-- NEXT STEP:
-- Apply supabase/migrations/20261025000002_ceo_rbac_and_team_access.sql next,
-- then create & verify aiconekttechnologies@gmail.com in Supabase Auth and run:
--   SELECT public.bootstrap_initial_ceo_owner();
-- ============================================================================
