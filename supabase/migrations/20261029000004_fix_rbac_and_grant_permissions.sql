-- ============================================================================
-- AICONEXT / AICONEKT TECHNOLOGIES — Forward Corrective Migration
-- Migration: 20261029000004_fix_rbac_and_grant_permissions.sql
-- ============================================================================
-- IDEMPOTENT & SAFE TO RUN MULTIPLE TIMES:
-- 1. Ensures set_updated_at helper function exists
-- 2. Ensures public.is_admin() and public.is_ceo() authorization functions exist
-- 3. Ensures public.team_members exists with all expected columns & RLS
-- 4. Ensures public.event_participants exists with all expected columns & RLS
-- 5. Ensures public.admin_users has all RBAC columns & RLS
-- 6. Ensures public.team_invitations exists with all columns & RLS
-- 7. Explicitly grants SELECT to authenticated users on admin_users & team_invitations
-- 8. Reloads PostgREST schema cache to immediately resolve PGRST205 errors
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Ensure set_updated_at helper function exists
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
-- 2. Ensure Authorization Helper Functions Exist Before Policies Reference Them
-- ----------------------------------------------------------------------------
-- Non-recursive Security Definer helper: is_admin()
-- Checks if caller is active in public.admin_users and has an approved role
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
      AND (
        role IN ('owner', 'admin', 'Founder', 'Administrator')
        OR access_status = 'active'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Non-recursive Security Definer helper: is_ceo()
-- Checks if caller is the active CEO/owner in public.admin_users
CREATE OR REPLACE FUNCTION public.is_ceo()
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
      AND role = 'owner'
      AND access_status = 'active'
      AND is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_ceo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ceo() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Repair & Complete public.team_members Table
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

GRANT SELECT ON public.team_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.team_members TO authenticated;

-- Public read for active members or admin
DROP POLICY IF EXISTS "Public read for active team members" ON public.team_members;
CREATE POLICY "Public read for active team members"
  ON public.team_members
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE OR public.is_admin());

-- CEO / Administrator management policy
DROP POLICY IF EXISTS "Only admins can manage team members" ON public.team_members;
CREATE POLICY "Only admins can manage team members"
  ON public.team_members
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. Repair & Complete public.event_participants Table
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

GRANT SELECT, INSERT ON public.event_participants TO anon, authenticated;
GRANT UPDATE, DELETE ON public.event_participants TO authenticated;

DROP POLICY IF EXISTS "Public read or admin view on event participants" ON public.event_participants;
CREATE POLICY "Public read or admin view on event participants"
  ON public.event_participants
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_admin() OR user_id = auth.uid() OR auth.role() = 'anon'
  );

DROP POLICY IF EXISTS "Public can register interest for events" ON public.event_participants;
CREATE POLICY "Public can register interest for events"
  ON public.event_participants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Only admins can delete or manage participants" ON public.event_participants;
CREATE POLICY "Only admins can delete or manage participants"
  ON public.event_participants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Helper count function
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
-- 5. Grant Table Permissions for admin_users & team_invitations
-- ----------------------------------------------------------------------------
-- PostgreSQL GRANT statements are required so PostgREST allows the authenticated role
-- to query these tables under their RLS policies.
GRANT SELECT ON public.admin_users TO authenticated;
GRANT SELECT ON public.team_invitations TO authenticated;

-- Ensure RLS policies are up-to-date
DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_self_or_ceo" ON public.admin_users;
CREATE POLICY "admin_users_select_self_or_ceo"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_ceo());

DROP POLICY IF EXISTS "team_invitations_ceo_select" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_select"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (public.is_ceo());

-- ----------------------------------------------------------------------------
-- 6. Notify PostgREST to Refresh Its Schema Cache
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
