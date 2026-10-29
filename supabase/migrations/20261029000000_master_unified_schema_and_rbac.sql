-- ============================================================================
-- AICONEXT / AICONEKT TECHNOLOGIES — Master Unified Schema & RBAC Recovery
-- File: supabase/migrations/20261029000000_master_unified_schema_and_rbac.sql
-- ============================================================================
-- Complete, self-contained, idempotent SQL script that sets up the full
-- database schema, functions, triggers, and RLS policies in strict dependency order.
-- Preserves existing tables (such as public.profiles) and all existing data.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Utility Trigger Function: Timestamp Management
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
-- 2. Core RBAC Helper: validate_permission_list
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_permission_list(
  perms TEXT[],
  target_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  p TEXT;
  all_valid CONSTANT TEXT[] := ARRAY[
    'dashboard.overview.view',
    'projects.view', 'projects.create', 'projects.edit', 'projects.publish', 'projects.delete',
    'events.view', 'events.create', 'events.edit', 'events.publish', 'events.delete',
    'inquiries.view', 'inquiries.manage',
    'applications.view', 'applications.manage'
  ];
  project_editor_allowed CONSTANT TEXT[] := ARRAY[
    'dashboard.overview.view',
    'projects.view', 'projects.create', 'projects.edit', 'projects.publish', 'projects.delete'
  ];
  event_manager_allowed CONSTANT TEXT[] := ARRAY[
    'dashboard.overview.view',
    'events.view', 'events.create', 'events.edit', 'events.publish', 'events.delete'
  ];
  viewer_allowed CONSTANT TEXT[] := ARRAY[
    'dashboard.overview.view',
    'projects.view', 'events.view', 'inquiries.view', 'applications.view'
  ];
BEGIN
  IF perms IS NULL THEN
    RETURN FALSE;
  END IF;

  IF target_role = 'none' THEN
    RETURN cardinality(perms) = 0;
  END IF;

  FOREACH p IN ARRAY perms LOOP
    IF NOT (p = ANY(all_valid)) THEN
      RETURN FALSE;
    END IF;

    IF target_role = 'project_editor' AND NOT (p = ANY(project_editor_allowed)) THEN
      RETURN FALSE;
    END IF;

    IF target_role = 'event_manager' AND NOT (p = ANY(event_manager_allowed)) THEN
      RETURN FALSE;
    END IF;

    IF target_role = 'viewer' AND NOT (p = ANY(viewer_allowed)) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Administrator & RBAC Authorization Table (public.admin_users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'none',
  access_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  permissions TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  last_sign_in_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure all RBAC columns exist if the table was previously created with minimal columns
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- Drop legacy constraints
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check,
  DROP CONSTRAINT IF EXISTS admin_users_rbac_role_check,
  DROP CONSTRAINT IF EXISTS admin_users_access_status_check,
  DROP CONSTRAINT IF EXISTS admin_users_permissions_ceiling_check;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_rbac_role_check
  CHECK (role IN ('owner', 'admin', 'project_editor', 'event_manager', 'viewer', 'none', 'Founder', 'Administrator'));

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_access_status_check
  CHECK (access_status IN ('pending', 'active', 'suspended', 'revoked'));

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_permissions_ceiling_check
  CHECK (public.validate_permission_list(permissions, role));

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_single_owner
  ON public.admin_users ((1))
  WHERE role = 'owner';

CREATE INDEX IF NOT EXISTS idx_admin_users_email_lower
  ON public.admin_users (lower(email));

CREATE INDEX IF NOT EXISTS idx_admin_users_access_status
  ON public.admin_users (access_status, role);

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. RBAC Authorization Functions
-- ----------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.has_dashboard_access()
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
      AND access_status = 'active'
      AND is_active = TRUE
      AND role <> 'none'
      AND (role = 'owner' OR cardinality(permissions) > 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(required_perm TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  u_role TEXT;
  u_status TEXT;
  u_active BOOLEAN;
  u_perms TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role, access_status, is_active, permissions
    INTO u_role, u_status, u_active, u_perms
  FROM public.admin_users
  WHERE user_id = auth.uid();

  IF NOT FOUND OR u_active IS NOT TRUE OR u_status <> 'active' OR u_role = 'none' THEN
    RETURN FALSE;
  END IF;

  IF u_role = 'owner' THEN
    RETURN TRUE;
  END IF;

  IF required_perm = 'team.manage' THEN
    RETURN FALSE;
  END IF;

  IF NOT public.validate_permission_list(ARRAY[required_perm], u_role) THEN
    RETURN FALSE;
  END IF;

  RETURN required_perm = ANY(u_perms);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_dashboard_access();
$$;

REVOKE ALL ON FUNCTION public.is_ceo() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_dashboard_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_ceo() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_dashboard_access() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Trigger: Enforce admin_users Security Constraints
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_admin_users_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  is_trusted_system BOOLEAN;
BEGIN
  NEW.email := lower(btrim(NEW.email));
  NEW.is_active := (NEW.access_status = 'active' AND NEW.role <> 'none');

  is_trusted_system := (
    current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
    OR session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
    OR COALESCE(auth.role(), '') = 'service_role'
  );

  IF NEW.role = 'owner' AND (TG_OP = 'INSERT' OR OLD.role <> 'owner') THEN
    IF NOT is_trusted_system THEN
      RAISE EXCEPTION 'Owner role can only be established via controlled server/database bootstrap.';
    END IF;
    IF NEW.email <> 'aiconekttechnologies@gmail.com' THEN
      RAISE EXCEPTION 'Initial owner role is restricted exclusively to aiconekttechnologies@gmail.com.';
    END IF;
    NEW.access_status := 'active';
    NEW.is_active := TRUE;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' THEN
    IF NEW.role <> 'owner' OR NEW.access_status <> 'active' OR NEW.is_active <> TRUE THEN
      RAISE EXCEPTION 'The CEO owner account cannot be demoted, suspended, or deactivated.';
    END IF;
  END IF;

  IF NOT is_trusted_system AND auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Users are prohibited from modifying their own role, permissions, or access status.';
  END IF;

  IF NEW.role = 'none' THEN
    NEW.permissions := '{}'::TEXT[];
    NEW.is_active := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_users_security ON public.admin_users;
CREATE TRIGGER trg_enforce_admin_users_security
  BEFORE INSERT OR UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_admin_users_security();

CREATE OR REPLACE FUNCTION public.prevent_owner_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    RAISE EXCEPTION 'The CEO owner record cannot be deleted from public.admin_users.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_owner_deletion ON public.admin_users;
CREATE TRIGGER trg_prevent_owner_deletion
  BEFORE DELETE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_deletion();

-- ----------------------------------------------------------------------------
-- 6. Team Invitations Table (public.team_invitations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name TEXT CHECK (full_name IS NULL OR char_length(btrim(full_name)) <= 120),
  role TEXT NOT NULL CHECK (role IN ('admin', 'project_editor', 'event_manager', 'viewer')),
  permissions TEXT[] NOT NULL DEFAULT '{}'::TEXT[] CHECK (public.validate_permission_list(permissions, role)),
  require_manual_approval BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()) + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_pending_email
  ON public.team_invitations (lower(email))
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS trg_team_invitations_updated_at ON public.team_invitations;
CREATE TRIGGER trg_team_invitations_updated_at
  BEFORE UPDATE ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. Controlled One-Time Initial CEO Bootstrap Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_initial_ceo_owner()
RETURNS public.admin_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ceo_auth_user RECORD;
  result_row public.admin_users;
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE role = 'owner') THEN
    RAISE EXCEPTION 'An initial CEO owner account has already been established.';
  END IF;

  SELECT id, email, raw_user_meta_data, email_confirmed_at, created_at, last_sign_in_at
    INTO ceo_auth_user
  FROM auth.users
  WHERE lower(btrim(email)) = 'aiconekttechnologies@gmail.com'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supabase Auth user for aiconekttechnologies@gmail.com does not exist yet. Create and verify the user in Supabase Auth first.';
  END IF;

  IF ceo_auth_user.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'aiconekttechnologies@gmail.com must have a verified email address in Supabase Auth before owner bootstrap.';
  END IF;

  INSERT INTO public.admin_users (
    user_id,
    email,
    full_name,
    role,
    access_status,
    is_active,
    permissions,
    approved_by,
    approved_at,
    registered_at,
    last_sign_in_at
  )
  VALUES (
    ceo_auth_user.id,
    lower(btrim(ceo_auth_user.email)),
    COALESCE(NULLIF(btrim(ceo_auth_user.raw_user_meta_data->>'full_name'), ''), 'Kolloju Ravi Charan'),
    'owner',
    'active',
    TRUE,
    ARRAY[
      'dashboard.overview.view',
      'projects.view', 'projects.create', 'projects.edit', 'projects.publish', 'projects.delete',
      'events.view', 'events.create', 'events.edit', 'events.publish', 'events.delete',
      'inquiries.view', 'inquiries.manage',
      'applications.view', 'applications.manage'
    ],
    ceo_auth_user.id,
    timezone('utc', now()),
    COALESCE(ceo_auth_user.created_at, timezone('utc', now())),
    ceo_auth_user.last_sign_in_at
  )
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'owner',
        access_status = 'active',
        is_active = TRUE,
        approved_by = EXCLUDED.user_id,
        approved_at = timezone('utc', now())
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_initial_ceo_owner() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Sync auth.users Registrations
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  norm_email TEXT;
  display_name TEXT;
  inv RECORD;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  norm_email := lower(btrim(NEW.email));
  display_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(norm_email, '@', 1)
  );

  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = NEW.id) THEN
    UPDATE public.admin_users
    SET email = norm_email,
        last_sign_in_at = COALESCE(NEW.last_sign_in_at, last_sign_in_at)
    WHERE user_id = NEW.id;
  ELSE
    SELECT *
      INTO inv
    FROM public.team_invitations
    WHERE lower(btrim(email)) = norm_email
      AND status = 'pending'
      AND expires_at > timezone('utc', now())
    LIMIT 1;

    IF FOUND AND NEW.email_confirmed_at IS NOT NULL THEN
      INSERT INTO public.admin_users (
        user_id, email, full_name, role, access_status, is_active,
        permissions, invited_by, approved_by, approved_at, registered_at, last_sign_in_at
      )
      VALUES (
        NEW.id,
        norm_email,
        COALESCE(inv.full_name, display_name),
        inv.role,
        CASE WHEN inv.require_manual_approval THEN 'pending' ELSE 'active' END,
        NOT inv.require_manual_approval,
        inv.permissions,
        inv.invited_by,
        CASE WHEN inv.require_manual_approval THEN NULL ELSE inv.invited_by END,
        CASE WHEN inv.require_manual_approval THEN NULL ELSE timezone('utc', now()) END,
        COALESCE(NEW.created_at, timezone('utc', now())),
        NEW.last_sign_in_at
      );

      UPDATE public.team_invitations
      SET status = 'accepted', accepted_user_id = NEW.id
      WHERE id = inv.id;
    ELSE
      INSERT INTO public.admin_users (
        user_id, email, full_name, role, access_status, is_active,
        permissions, registered_at, last_sign_in_at
      )
      VALUES (
        NEW.id,
        norm_email,
        display_name,
        'none',
        'pending',
        FALSE,
        '{}'::TEXT[],
        COALESCE(NEW.created_at, timezone('utc', now())),
        NEW.last_sign_in_at
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_sync ON auth.users;
CREATE TRIGGER trg_on_auth_user_sync
  AFTER INSERT OR UPDATE OF email_confirmed_at, last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_sync();

-- ----------------------------------------------------------------------------
-- 9. Projects Table (public.projects)
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects (slug);
CREATE INDEX IF NOT EXISTS idx_projects_published_status ON public.projects (is_published, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects (category);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. Flagship Events Table (public.events)
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
  location TEXT NOT NULL DEFAULT 'Virtual',
  is_virtual BOOLEAN NOT NULL DEFAULT TRUE,
  registration_url TEXT CHECK (registration_url IS NULL OR registration_url ~* '^https?://'),
  image_url TEXT CHECK (image_url IS NULL OR image_url ~* '^https?://'),
  prize_pool TEXT CHECK (prize_pool IS NULL OR char_length(prize_pool) <= 120),
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'ongoing', 'past', 'cancelled', 'archived')),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events (slug);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_published_status ON public.events (is_published, status, event_date ASC);

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 11. Contact Inquiries Table (public.contact_inquiries)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject TEXT NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 2 AND 180),
  message TEXT NOT NULL CHECK (char_length(btrim(message)) >= 10),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 40),
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived', 'replied')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON public.contact_inquiries (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER trg_contact_inquiries_updated_at
  BEFORE UPDATE ON public.contact_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. Career / Roster Applications Table (public.career_applications)
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

CREATE INDEX IF NOT EXISTS idx_career_applications_submitted ON public.career_applications (submitted_at DESC);

-- ----------------------------------------------------------------------------
-- 13. Team Members & Leads Table (public.team_members)
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

-- ----------------------------------------------------------------------------
-- 14. Event Participation Table (public.event_participants)
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
-- 15. Row Level Security & Access Policies
-- ----------------------------------------------------------------------------

-- Enable RLS across all tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Grant baseline PostgreSQL permissions to client roles
GRANT SELECT ON public.admin_users TO authenticated;
GRANT SELECT ON public.team_invitations TO authenticated;
GRANT SELECT ON public.projects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT ON public.events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT INSERT ON public.contact_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_inquiries TO authenticated;
GRANT INSERT ON public.career_applications TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.career_applications TO authenticated;
GRANT SELECT ON public.team_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT ON public.event_participants TO anon, authenticated;
GRANT UPDATE, DELETE ON public.event_participants TO authenticated;

-- Policies: admin_users
DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_self_or_ceo" ON public.admin_users;
CREATE POLICY "admin_users_select_self_or_ceo"
  ON public.admin_users FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_ceo());

DROP POLICY IF EXISTS "admin_users_ceo_insert" ON public.admin_users;
CREATE POLICY "admin_users_ceo_insert"
  ON public.admin_users FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo() AND role <> 'owner' AND user_id <> auth.uid());

DROP POLICY IF EXISTS "admin_users_ceo_update" ON public.admin_users;
CREATE POLICY "admin_users_ceo_update"
  ON public.admin_users FOR UPDATE TO authenticated
  USING (public.is_ceo() AND user_id <> auth.uid() AND role <> 'owner')
  WITH CHECK (public.is_ceo() AND user_id <> auth.uid() AND role <> 'owner');

DROP POLICY IF EXISTS "admin_users_ceo_delete" ON public.admin_users;
CREATE POLICY "admin_users_ceo_delete"
  ON public.admin_users FOR DELETE TO authenticated
  USING (public.is_ceo() AND user_id <> auth.uid() AND role <> 'owner');

-- Policies: team_invitations
DROP POLICY IF EXISTS "team_invitations_ceo_select" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_select"
  ON public.team_invitations FOR SELECT TO authenticated
  USING (public.is_ceo());

DROP POLICY IF EXISTS "team_invitations_ceo_insert" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_insert"
  ON public.team_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo() AND role IN ('admin', 'project_editor', 'event_manager', 'viewer'));

DROP POLICY IF EXISTS "team_invitations_ceo_update" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_update"
  ON public.team_invitations FOR UPDATE TO authenticated
  USING (public.is_ceo())
  WITH CHECK (public.is_ceo() AND role IN ('admin', 'project_editor', 'event_manager', 'viewer'));

DROP POLICY IF EXISTS "team_invitations_ceo_delete" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_delete"
  ON public.team_invitations FOR DELETE TO authenticated
  USING (public.is_ceo());

-- Policies: projects
DROP POLICY IF EXISTS "projects_public_read_published" ON public.projects;
CREATE POLICY "projects_public_read_published"
  ON public.projects FOR SELECT TO anon, authenticated
  USING (is_published = TRUE AND status = 'published');

DROP POLICY IF EXISTS "projects_admin_read_all" ON public.projects;
CREATE POLICY "projects_admin_read_all"
  ON public.projects FOR SELECT TO authenticated
  USING (public.has_permission('projects.view') OR public.has_permission('projects.create'));

DROP POLICY IF EXISTS "projects_admin_insert" ON public.projects;
CREATE POLICY "projects_admin_insert"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('projects.create') AND (is_published = FALSE OR public.has_permission('projects.publish')));

DROP POLICY IF EXISTS "projects_admin_update" ON public.projects;
CREATE POLICY "projects_admin_update"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.has_permission('projects.edit') OR public.has_permission('projects.publish'));

DROP POLICY IF EXISTS "projects_admin_delete" ON public.projects;
CREATE POLICY "projects_admin_delete"
  ON public.projects FOR DELETE TO authenticated
  USING (public.has_permission('projects.delete'));

-- Policies: events
DROP POLICY IF EXISTS "events_public_read_published" ON public.events;
CREATE POLICY "events_public_read_published"
  ON public.events FOR SELECT TO anon, authenticated
  USING (is_published = TRUE AND status IN ('upcoming', 'ongoing', 'past'));

DROP POLICY IF EXISTS "events_admin_read_all" ON public.events;
CREATE POLICY "events_admin_read_all"
  ON public.events FOR SELECT TO authenticated
  USING (public.has_permission('events.view') OR public.has_permission('events.create'));

DROP POLICY IF EXISTS "events_admin_insert" ON public.events;
CREATE POLICY "events_admin_insert"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('events.create') AND (is_published = FALSE OR public.has_permission('events.publish')));

DROP POLICY IF EXISTS "events_admin_update" ON public.events;
CREATE POLICY "events_admin_update"
  ON public.events FOR UPDATE TO authenticated
  USING (public.has_permission('events.edit') OR public.has_permission('events.publish'));

DROP POLICY IF EXISTS "events_admin_delete" ON public.events;
CREATE POLICY "events_admin_delete"
  ON public.events FOR DELETE TO authenticated
  USING (public.has_permission('events.delete'));

-- Policies: contact_inquiries
DROP POLICY IF EXISTS "contact_inquiries_public_insert" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_public_insert"
  ON public.contact_inquiries FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "contact_inquiries_admin_select" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_select"
  ON public.contact_inquiries FOR SELECT TO authenticated
  USING (public.has_permission('inquiries.view'));

DROP POLICY IF EXISTS "contact_inquiries_admin_update" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_update"
  ON public.contact_inquiries FOR UPDATE TO authenticated
  USING (public.has_permission('inquiries.manage'))
  WITH CHECK (public.has_permission('inquiries.manage'));

DROP POLICY IF EXISTS "contact_inquiries_admin_delete" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_delete"
  ON public.contact_inquiries FOR DELETE TO authenticated
  USING (public.has_permission('inquiries.manage'));

-- Policies: career_applications
DROP POLICY IF EXISTS "career_applications_public_insert" ON public.career_applications;
CREATE POLICY "career_applications_public_insert"
  ON public.career_applications FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "career_applications_admin_select" ON public.career_applications;
CREATE POLICY "career_applications_admin_select"
  ON public.career_applications FOR SELECT TO authenticated
  USING (public.has_permission('applications.view'));

DROP POLICY IF EXISTS "career_applications_admin_update" ON public.career_applications;
CREATE POLICY "career_applications_admin_update"
  ON public.career_applications FOR UPDATE TO authenticated
  USING (public.has_permission('applications.manage'))
  WITH CHECK (public.has_permission('applications.manage'));

DROP POLICY IF EXISTS "career_applications_admin_delete" ON public.career_applications;
CREATE POLICY "career_applications_admin_delete"
  ON public.career_applications FOR DELETE TO authenticated
  USING (public.has_permission('applications.manage'));

-- Policies: team_members
DROP POLICY IF EXISTS "Public read for active team members" ON public.team_members;
CREATE POLICY "Public read for active team members"
  ON public.team_members FOR SELECT TO anon, authenticated
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can manage team members" ON public.team_members;
CREATE POLICY "Only admins can manage team members"
  ON public.team_members FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policies: event_participants
DROP POLICY IF EXISTS "Public read or admin view on event participants" ON public.event_participants;
CREATE POLICY "Public read or admin view on event participants"
  ON public.event_participants FOR SELECT TO anon, authenticated
  USING (public.is_admin() OR user_id = auth.uid() OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Public can register interest for events" ON public.event_participants;
CREATE POLICY "Public can register interest for events"
  ON public.event_participants FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Only admins can delete or manage participants" ON public.event_participants;
CREATE POLICY "Only admins can delete or manage participants"
  ON public.event_participants FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 16. Refresh Schema Cache
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
