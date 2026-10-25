-- ============================================================================
-- AICONEXT / AICONEKT TECHNOLOGIES — CEO-Owned Dashboard RBAC & Team Access
-- Migration: 20261025000002_ceo_rbac_and_team_access.sql
-- ============================================================================
-- Upgrades public.admin_users into a least-privilege RBAC & approval directory,
-- adds public.team_invitations for CEO-controlled invitations, syncs newly
-- registered auth.users with zero default privileges, and enforces granular
-- permission checks across all PostgreSQL Row-Level Security policies.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Permission Ceiling Validator (Immutable SQL Helper)
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
    'projects.view',
    'projects.create',
    'projects.edit',
    'projects.publish',
    'projects.delete',
    'events.view',
    'events.create',
    'events.edit',
    'events.publish',
    'events.delete',
    'inquiries.view',
    'inquiries.manage',
    'applications.view',
    'applications.manage'
  ];
  project_editor_allowed CONSTANT TEXT[] := ARRAY[
    'dashboard.overview.view',
    'projects.view',
    'projects.create',
    'projects.edit',
    'projects.publish',
    'projects.delete'
  ];
  event_manager_allowed CONSTANT TEXT[] := ARRAY[
    'dashboard.overview.view',
    'events.view',
    'events.create',
    'events.edit',
    'events.publish',
    'events.delete'
  ];
  viewer_allowed CONSTANT TEXT[] := ARRAY[
    'dashboard.overview.view',
    'projects.view',
    'events.view',
    'inquiries.view',
    'applications.view'
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
-- 2. Upgrade public.admin_users Table for CEO RBAC & Approval Workflow
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- Drop legacy role check constraint from migration 0001 if present
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Safely migrate any legacy rows if migration 0001 was already applied
UPDATE public.admin_users
SET
  role = CASE
    WHEN role = 'Founder' AND lower(btrim(email)) = 'aiconekttechnologies@gmail.com' THEN 'owner'
    WHEN role IN ('Founder', 'Administrator') THEN 'admin'
    WHEN role IN ('owner', 'admin', 'project_editor', 'event_manager', 'viewer', 'none') THEN role
    ELSE 'none'
  END,
  access_status = CASE
    WHEN is_active = TRUE THEN 'active'
    ELSE 'revoked'
  END
WHERE role IN ('Founder', 'Administrator')
   OR access_status NOT IN ('pending', 'active', 'suspended', 'revoked');

ALTER TABLE public.admin_users
  ALTER COLUMN role SET DEFAULT 'none',
  ALTER COLUMN is_active SET DEFAULT FALSE;

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_rbac_role_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_rbac_role_check
  CHECK (role IN ('owner', 'admin', 'project_editor', 'event_manager', 'viewer', 'none'));

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_access_status_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_access_status_check
  CHECK (access_status IN ('pending', 'active', 'suspended', 'revoked'));

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_permissions_ceiling_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_permissions_ceiling_check
  CHECK (public.validate_permission_list(permissions, role));

-- Guarantee at most ONE CEO/owner record can ever exist in the database
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_single_owner
  ON public.admin_users ((1))
  WHERE role = 'owner';

CREATE INDEX IF NOT EXISTS idx_admin_users_email_lower
  ON public.admin_users (lower(email));

CREATE INDEX IF NOT EXISTS idx_admin_users_access_status
  ON public.admin_users (access_status, role);

-- ----------------------------------------------------------------------------
-- 3. Trigger: Prevent Self-Promotion, Unauthorized Owner Creation, & Lockout
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
  -- Synchronize is_active strictly with access_status and non-'none' role
  NEW.is_active := (NEW.access_status = 'active' AND NEW.role <> 'none');

  is_trusted_system := (
    current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
    OR session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
    OR COALESCE(auth.role(), '') = 'service_role'
  );

  -- Rule A: Block assigning 'owner' from any client session or for any email other than official CEO email
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

  -- Rule B: Protect existing CEO owner account from accidental demotion or suspension
  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' THEN
    IF NEW.role <> 'owner' OR NEW.access_status <> 'active' OR NEW.is_active <> TRUE THEN
      RAISE EXCEPTION 'The CEO owner account cannot be demoted, suspended, or deactivated.';
    END IF;
  END IF;

  -- Rule C: Users can NEVER update or escalate their own role, permissions, or access_status
  IF NOT is_trusted_system AND auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Users are prohibited from modifying their own role, permissions, or access status.';
  END IF;

  -- Rule D: Clear permissions automatically if role is set to 'none'
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

DROP TRIGGER IF EXISTS trg_prevent_owner_deletion ON public.admin_users;
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

CREATE TRIGGER trg_prevent_owner_deletion
  BEFORE DELETE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_deletion();

-- ----------------------------------------------------------------------------
-- 4. CEO-Controlled Team Invitations Table (public.team_invitations)
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
-- 5. Security Definer Authorization & Permission Functions
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

-- Keep public.is_admin() mapped to active dashboard access for compatibility
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
-- 6. Controlled One-Time Initial CEO Bootstrap Function (Server / SQL Only)
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

-- Strictly prohibit client roles from executing bootstrap_initial_ceo_owner()
REVOKE ALL ON FUNCTION public.bootstrap_initial_ceo_owner() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Sync auth.users Registrations (Zero Default Access; Honor Valid CEO Invites)
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

  -- Check if an admin_users directory row already exists
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = NEW.id) THEN
    UPDATE public.admin_users
    SET email = norm_email,
        last_sign_in_at = COALESCE(NEW.last_sign_in_at, last_sign_in_at)
    WHERE user_id = NEW.id;
  ELSE
    -- Look up a valid, non-expired CEO invitation ONLY if email is verified
    SELECT *
      INTO inv
    FROM public.team_invitations
    WHERE lower(btrim(email)) = norm_email
      AND status = 'pending'
      AND expires_at > timezone('utc', now())
    LIMIT 1;

    IF FOUND AND NEW.email_confirmed_at IS NOT NULL THEN
      INSERT INTO public.admin_users (
        user_id,
        email,
        full_name,
        role,
        access_status,
        is_active,
        permissions,
        invited_by,
        approved_by,
        approved_at,
        registered_at,
        last_sign_in_at
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
      SET status = 'accepted',
          accepted_user_id = NEW.id
      WHERE id = inv.id;
    ELSE
      -- Default for ALL newly registered accounts (including CEO email prior to controlled bootstrap):
      -- role = 'none', access_status = 'pending', is_active = FALSE, zero permissions.
      INSERT INTO public.admin_users (
        user_id,
        email,
        full_name,
        role,
        access_status,
        is_active,
        permissions,
        registered_at,
        last_sign_in_at
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

  -- If an existing pending user just verified their email and has a pending CEO invite, apply it
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    SELECT *
      INTO inv
    FROM public.team_invitations
    WHERE lower(btrim(email)) = norm_email
      AND status = 'pending'
      AND expires_at > timezone('utc', now())
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.admin_users
      SET role = inv.role,
          permissions = inv.permissions,
          invited_by = inv.invited_by,
          access_status = CASE WHEN inv.require_manual_approval THEN 'pending' ELSE 'active' END,
          is_active = NOT inv.require_manual_approval,
          approved_by = CASE WHEN inv.require_manual_approval THEN NULL ELSE inv.invited_by END,
          approved_at = CASE WHEN inv.require_manual_approval THEN NULL ELSE timezone('utc', now()) END
      WHERE user_id = NEW.id
        AND role = 'none';

      UPDATE public.team_invitations
      SET status = 'accepted',
          accepted_user_id = NEW.id
      WHERE id = inv.id;
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

-- Backfill any existing auth.users not yet listed in public.admin_users with role='none', access_status='pending'
INSERT INTO public.admin_users (user_id, email, full_name, role, access_status, is_active, permissions, registered_at, last_sign_in_at)
SELECT
  u.id,
  lower(btrim(u.email)),
  COALESCE(NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(lower(btrim(u.email)), '@', 1)),
  'none',
  'pending',
  FALSE,
  '{}'::TEXT[],
  COALESCE(u.created_at, timezone('utc', now())),
  u.last_sign_in_at
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id);

-- ----------------------------------------------------------------------------
-- 8. Row-Level Security on admin_users & team_invitations (CEO-Only Mutation)
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_users FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;

DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_self_or_ceo" ON public.admin_users;
CREATE POLICY "admin_users_select_self_or_ceo"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_ceo());

DROP POLICY IF EXISTS "admin_users_ceo_insert" ON public.admin_users;
CREATE POLICY "admin_users_ceo_insert"
  ON public.admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_ceo()
    AND role <> 'owner'
    AND user_id <> auth.uid()
  );

DROP POLICY IF EXISTS "admin_users_ceo_update" ON public.admin_users;
CREATE POLICY "admin_users_ceo_update"
  ON public.admin_users
  FOR UPDATE
  TO authenticated
  USING (
    public.is_ceo()
    AND user_id <> auth.uid()
    AND role <> 'owner'
  )
  WITH CHECK (
    public.is_ceo()
    AND user_id <> auth.uid()
    AND role <> 'owner'
  );

DROP POLICY IF EXISTS "admin_users_ceo_delete" ON public.admin_users;
CREATE POLICY "admin_users_ceo_delete"
  ON public.admin_users
  FOR DELETE
  TO authenticated
  USING (
    public.is_ceo()
    AND user_id <> auth.uid()
    AND role <> 'owner'
  );

REVOKE ALL ON public.team_invitations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;

DROP POLICY IF EXISTS "team_invitations_ceo_select" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_select"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (public.is_ceo());

DROP POLICY IF EXISTS "team_invitations_ceo_insert" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_insert"
  ON public.team_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_ceo()
    AND role IN ('admin', 'project_editor', 'event_manager', 'viewer')
  );

DROP POLICY IF EXISTS "team_invitations_ceo_update" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_update"
  ON public.team_invitations
  FOR UPDATE
  TO authenticated
  USING (public.is_ceo())
  WITH CHECK (
    public.is_ceo()
    AND role IN ('admin', 'project_editor', 'event_manager', 'viewer')
  );

DROP POLICY IF EXISTS "team_invitations_ceo_delete" ON public.team_invitations;
CREATE POLICY "team_invitations_ceo_delete"
  ON public.team_invitations
  FOR DELETE
  TO authenticated
  USING (public.is_ceo());

-- ----------------------------------------------------------------------------
-- 9. Granular Content Permissions on Projects, Events, Inquiries, Applications
-- ----------------------------------------------------------------------------

-- Field-level update enforcement on public.projects (separates projects.edit from projects.publish)
CREATE OR REPLACE FUNCTION public.enforce_project_mutation_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  is_trusted_system BOOLEAN;
  content_changed BOOLEAN;
  publish_changed BOOLEAN;
BEGIN
  is_trusted_system := (
    current_user IN ('postgres', 'supabase_admin')
    OR session_user IN ('postgres', 'supabase_admin')
    OR COALESCE(auth.role(), '') = 'service_role'
  );

  IF is_trusted_system OR public.is_ceo() THEN
    RETURN NEW;
  END IF;

  content_changed := (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.slug IS DISTINCT FROM OLD.slug OR
    NEW.tagline IS DISTINCT FROM OLD.tagline OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.image_url IS DISTINCT FROM OLD.image_url OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.technologies IS DISTINCT FROM OLD.technologies OR
    NEW.live_url IS DISTINCT FROM OLD.live_url OR
    NEW.source_url IS DISTINCT FROM OLD.source_url
  );

  publish_changed := (
    NEW.is_published IS DISTINCT FROM OLD.is_published OR
    NEW.status IS DISTINCT FROM OLD.status
  );

  IF content_changed AND NOT public.has_permission('projects.edit') THEN
    RAISE EXCEPTION 'Missing required permission: projects.edit';
  END IF;

  IF publish_changed AND NOT public.has_permission('projects.publish') THEN
    RAISE EXCEPTION 'Missing required permission: projects.publish';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_mutation_permissions ON public.projects;
CREATE TRIGGER trg_enforce_project_mutation_permissions
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_mutation_permissions();

DROP POLICY IF EXISTS "projects_admin_read_all" ON public.projects;
CREATE POLICY "projects_admin_read_all"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('projects.view')
    OR public.has_permission('projects.create')
    OR public.has_permission('projects.edit')
    OR public.has_permission('projects.publish')
    OR public.has_permission('projects.delete')
  );

DROP POLICY IF EXISTS "projects_admin_insert" ON public.projects;
CREATE POLICY "projects_admin_insert"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('projects.create')
    AND (is_published = FALSE OR public.has_permission('projects.publish'))
  );

DROP POLICY IF EXISTS "projects_admin_update" ON public.projects;
CREATE POLICY "projects_admin_update"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('projects.edit')
    OR public.has_permission('projects.publish')
  )
  WITH CHECK (
    (public.has_permission('projects.edit') OR public.has_permission('projects.publish'))
    AND (is_published = FALSE OR public.has_permission('projects.publish'))
  );

DROP POLICY IF EXISTS "projects_admin_delete" ON public.projects;
CREATE POLICY "projects_admin_delete"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (public.has_permission('projects.delete'));

-- Field-level update enforcement on public.events (separates events.edit from events.publish)
CREATE OR REPLACE FUNCTION public.enforce_event_mutation_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  is_trusted_system BOOLEAN;
  content_changed BOOLEAN;
  publish_changed BOOLEAN;
BEGIN
  is_trusted_system := (
    current_user IN ('postgres', 'supabase_admin')
    OR session_user IN ('postgres', 'supabase_admin')
    OR COALESCE(auth.role(), '') = 'service_role'
  );

  IF is_trusted_system OR public.is_ceo() THEN
    RETURN NEW;
  END IF;

  content_changed := (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.slug IS DISTINCT FROM OLD.slug OR
    NEW.tagline IS DISTINCT FROM OLD.tagline OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.event_date IS DISTINCT FROM OLD.event_date OR
    NEW.end_date IS DISTINCT FROM OLD.end_date OR
    NEW.location IS DISTINCT FROM OLD.location OR
    NEW.is_virtual IS DISTINCT FROM OLD.is_virtual OR
    NEW.registration_url IS DISTINCT FROM OLD.registration_url OR
    NEW.image_url IS DISTINCT FROM OLD.image_url OR
    NEW.prize_pool IS DISTINCT FROM OLD.prize_pool OR
    NEW.tags IS DISTINCT FROM OLD.tags
  );

  publish_changed := (
    NEW.is_published IS DISTINCT FROM OLD.is_published OR
    NEW.status IS DISTINCT FROM OLD.status
  );

  IF content_changed AND NOT public.has_permission('events.edit') THEN
    RAISE EXCEPTION 'Missing required permission: events.edit';
  END IF;

  IF publish_changed AND NOT public.has_permission('events.publish') THEN
    RAISE EXCEPTION 'Missing required permission: events.publish';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_mutation_permissions ON public.events;
CREATE TRIGGER trg_enforce_event_mutation_permissions
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_mutation_permissions();

DROP POLICY IF EXISTS "events_admin_read_all" ON public.events;
CREATE POLICY "events_admin_read_all"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('events.view')
    OR public.has_permission('events.create')
    OR public.has_permission('events.edit')
    OR public.has_permission('events.publish')
    OR public.has_permission('events.delete')
  );

DROP POLICY IF EXISTS "events_admin_insert" ON public.events;
CREATE POLICY "events_admin_insert"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('events.create')
    AND (is_published = FALSE OR public.has_permission('events.publish'))
  );

DROP POLICY IF EXISTS "events_admin_update" ON public.events;
CREATE POLICY "events_admin_update"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('events.edit')
    OR public.has_permission('events.publish')
  )
  WITH CHECK (
    (public.has_permission('events.edit') OR public.has_permission('events.publish'))
    AND (is_published = FALSE OR public.has_permission('events.publish'))
  );

DROP POLICY IF EXISTS "events_admin_delete" ON public.events;
CREATE POLICY "events_admin_delete"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (public.has_permission('events.delete'));

-- Contact Inquiries Policies
DROP POLICY IF EXISTS "contact_inquiries_admin_select" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_select"
  ON public.contact_inquiries
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('inquiries.view')
    OR public.has_permission('inquiries.manage')
  );

DROP POLICY IF EXISTS "contact_inquiries_admin_update" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_update"
  ON public.contact_inquiries
  FOR UPDATE
  TO authenticated
  USING (public.has_permission('inquiries.manage'))
  WITH CHECK (public.has_permission('inquiries.manage'));

DROP POLICY IF EXISTS "contact_inquiries_admin_delete" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_admin_delete"
  ON public.contact_inquiries
  FOR DELETE
  TO authenticated
  USING (public.has_permission('inquiries.manage'));

-- Career / Roster Applications Policies
DROP POLICY IF EXISTS "career_applications_admin_select" ON public.career_applications;
CREATE POLICY "career_applications_admin_select"
  ON public.career_applications
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('applications.view')
    OR public.has_permission('applications.manage')
  );

DROP POLICY IF EXISTS "career_applications_admin_update" ON public.career_applications;
CREATE POLICY "career_applications_admin_update"
  ON public.career_applications
  FOR UPDATE
  TO authenticated
  USING (public.has_permission('applications.manage'))
  WITH CHECK (public.has_permission('applications.manage'));

DROP POLICY IF EXISTS "career_applications_admin_delete" ON public.career_applications;
CREATE POLICY "career_applications_admin_delete"
  ON public.career_applications
  FOR DELETE
  TO authenticated
  USING (public.has_permission('applications.manage'));

-- Add admin_users & team_invitations to Realtime so revoked/updated permissions take effect live
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_users'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_users;
    END IF;
  END IF;
END
$$;

-- ============================================================================
-- ONE-TIME INITIAL CEO BOOTSTRAP (RUN IN SUPABASE SQL EDITOR AFTER CREATING
-- AND VERIFYING aiconekttechnologies@gmail.com IN SUPABASE AUTH):
--
--   SELECT public.bootstrap_initial_ceo_owner();
-- ============================================================================
