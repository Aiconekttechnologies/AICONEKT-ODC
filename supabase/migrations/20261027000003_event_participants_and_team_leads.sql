-- ============================================================================
-- AICONEXT / AICONEKT TECHNOLOGIES — Event Participation (No Login Required) & Team Leads
-- Migration: 20261027000003_event_participants_and_team_leads.sql
-- ============================================================================
-- 1. public.event_participants:
--    - Stores public registrations/interest without requiring authentication
--    - Prevents duplicates on (event_id, email)
--    - No 5-minute takeback constraint (permanent confirmation unless CEO removes)
-- 2. public.team_members:
--    - Dynamic roster count, CEO appointment of team leads, profile links
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Event Participation Table (public.event_participants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'withdrawn', 'confirmed', 'attended', 'cancelled')),
  CONSTRAINT uq_event_participant_email UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_email ON public.event_participants(email);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Drop any previous withdrawal trigger
DROP TRIGGER IF EXISTS trg_check_event_participation_withdrawal ON public.event_participants;
DROP FUNCTION IF EXISTS public.check_event_participation_withdrawal();

-- Event Participants RLS Policies:
-- 1. SELECT:
--    - Public can count registrations via count function
--    - Authenticated users can view their own registrations
--    - Administrators/CEO can view all participants
CREATE POLICY "Public read or admin view on event participants"
  ON public.event_participants
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin() OR user_id = auth.uid() OR auth.role() = 'anon'
  );

-- 2. INSERT: Open to all (No login required - public registration)
CREATE POLICY "Public can register interest for events"
  ON public.event_participants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    TRUE
  );

-- 3. DELETE: Administrators/CEO only
CREATE POLICY "Only admins can delete or manage participants"
  ON public.event_participants
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- Helper function for public to get participant count for an event
CREATE OR REPLACE FUNCTION public.get_event_participant_count(target_event_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.event_participants
  WHERE event_id = target_event_id
    AND status != 'withdrawn';
$$;

GRANT EXECUTE ON FUNCTION public.get_event_participant_count(UUID) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Team Members & Leads Table (public.team_members)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT 'Engineering Member',
  department TEXT NOT NULL,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  lead_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  bio TEXT,
  avatar_url TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_team_members_dept ON public.team_members(department) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_team_members_lead ON public.team_members(is_lead) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team Members RLS Policies:
-- 1. SELECT: Public read access for active members and leads
CREATE POLICY "Public read for active team members"
  ON public.team_members
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE OR public.is_admin());

-- 2. ALL: Strictly CEO / Administrator only
CREATE POLICY "Only admins can manage team members"
  ON public.team_members
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Initial Seed Data: Founding Leadership and Core Members (Idempotent)
INSERT INTO public.team_members (
  full_name, email, role_title, department, is_lead, bio, display_order, is_active
)
SELECT 'KOLLOJU RAVI CHARAN', 'ravicharan@aiconekt.org', 'Founder & Chief Executive Officer', 'Executive Council', TRUE,
       'Leading strategic vision, organizational architecture, and cross-disciplinary innovation at AICONEKT TECHNOLOGIES.', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = 'ravicharan@aiconekt.org');

INSERT INTO public.team_members (
  full_name, email, role_title, department, is_lead, bio, display_order, is_active
)
SELECT 'VOORE YASHWANTH', 'yashwanth@aiconekt.org', 'Co-Founder & Chief Manager', 'Software & Web Development', TRUE,
       'Directing engineering operations, full-stack systems infrastructure, and technical initiatives.', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = 'yashwanth@aiconekt.org');

-- Additional Department Leads
INSERT INTO public.team_members (
  full_name, email, role_title, department, is_lead, bio, display_order, is_active
)
SELECT 'AI Research Lead', 'ai-lead@aiconekt.org', 'AI / ML Department Lead', 'AI & Machine Learning', TRUE,
       'Leading neural network research, computer vision pipelines, and multimodal model experiments.', 3, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = 'ai-lead@aiconekt.org');

INSERT INTO public.team_members (
  full_name, email, role_title, department, is_lead, bio, display_order, is_active
)
SELECT 'Cloud Architect Lead', 'cloud-lead@aiconekt.org', 'Cloud & Systems Lead', 'Cloud & Database Engineering', TRUE,
       'Architecting distributed systems, serverless infrastructure, and high-availability database clusters.', 4, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = 'cloud-lead@aiconekt.org');

INSERT INTO public.team_members (
  full_name, email, role_title, department, is_lead, bio, display_order, is_active
)
SELECT 'UI/UX Interactive Lead', 'design-lead@aiconekt.org', 'Creative & 3D Interactive Lead', 'UI/UX & 3D Interactive', TRUE,
       'Engineering immersive spatial 3D web experiences, design systems, and responsive user interfaces.', 5, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.team_members WHERE email = 'design-lead@aiconekt.org');
