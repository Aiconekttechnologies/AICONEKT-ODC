import crypto from 'node:crypto';
import express from 'express';
import {
  AccessStatus,
  DashboardRole,
  DelegatableRole,
  OFFICIAL_CEO_EMAIL,
  PermissionKey,
  sanitizePermissionsForRole,
} from '../../src/types/rbac.js';
import {
  createRequestSupabaseClient,
  getSupabaseServiceClient,
  isServerSupabaseConfigured,
  isServiceRoleConfigured,
} from '../lib/supabaseAdmin.js';

export interface ServerAccessMemberRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: DashboardRole;
  access_status: AccessStatus;
  is_active: boolean;
  permissions: PermissionKey[];
  invited_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  registered_at: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}

export interface ServerInvitationRow {
  id: string;
  email: string;
  full_name: string | null;
  role: DelegatableRole;
  permissions: PermissionKey[];
  require_manual_approval: boolean;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invited_by: string | null;
  accepted_user_id?: string | null;
  expires_at: string;
  created_at: string;
}

export interface CreateInvitationResult {
  invitation: ServerInvitationRow;
  authEmailDispatched: boolean;
  memberActivatedImmediately: boolean;
}

export interface AdminAccessDependencies {
  isConfigured: () => boolean;
  hasServiceRole: () => boolean;
  getBootstrapSecret: () => string;
  verifyCaller: (
    accessToken: string
  ) => Promise<{ id: string; email: string } | null>;
  getAccessRecord: (
    userId: string,
    accessToken: string
  ) => Promise<ServerAccessMemberRow | null>;
  hasExistingOwner: () => Promise<boolean>;
  bootstrapInitialCeo: () => Promise<ServerAccessMemberRow>;
  listTeamDirectory: (accessToken: string) => Promise<{
    members: ServerAccessMemberRow[];
    invitations: ServerInvitationRow[];
  }>;
  createInvitation: (
    ceoUserId: string,
    accessToken: string,
    input: {
      email: string;
      full_name: string | null;
      role: DelegatableRole;
      permissions: PermissionKey[];
      require_manual_approval: boolean;
      redirectTo?: string;
    }
  ) => Promise<CreateInvitationResult>;
  updateMemberAccess: (
    ceoUserId: string,
    accessToken: string,
    targetUserId: string,
    updates: {
      role: DashboardRole;
      access_status: AccessStatus;
      permissions: PermissionKey[];
    }
  ) => Promise<ServerAccessMemberRow>;
  revokeInvitation: (
    ceoUserId: string,
    accessToken: string,
    invitationId: string
  ) => Promise<void>;
}

const VALID_DELEGATABLE_ROLES = new Set<string>([
  'admin',
  'project_editor',
  'event_manager',
  'viewer',
]);

const VALID_NON_OWNER_ROLES = new Set<string>([
  'admin',
  'project_editor',
  'event_manager',
  'viewer',
  'none',
]);

const VALID_ACCESS_STATUSES = new Set<string>([
  'pending',
  'active',
  'suspended',
  'revoked',
]);

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function buildDefaultDependencies(): AdminAccessDependencies {
  return {
    isConfigured: isServerSupabaseConfigured,
    hasServiceRole: isServiceRoleConfigured,
    getBootstrapSecret: () => process.env.CEO_BOOTSTRAP_SECRET?.trim() || '',

    async verifyCaller(accessToken: string) {
      // Prefer caller-scoped client so JWT verification works with or without service_role
      const client =
        createRequestSupabaseClient(accessToken) || getSupabaseServiceClient();
      if (!client) return null;

      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data?.user?.id) return null;
      return {
        id: data.user.id,
        email: (data.user.email || '').trim().toLowerCase(),
      };
    },

    async getAccessRecord(userId: string, accessToken: string) {
      // Always prefer caller-scoped RLS client so PostgreSQL RLS verifies self/CEO access directly
      const rlsClient = createRequestSupabaseClient(accessToken);
      const serviceClient = getSupabaseServiceClient();
      const primaryClient = rlsClient || serviceClient;
      if (!primaryClient) return null;

      const { data, error } = await primaryClient
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        return data as ServerAccessMemberRow;
      }

      if (serviceClient && primaryClient !== serviceClient) {
        const fallback = await serviceClient
          .from('admin_users')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (!fallback.error && fallback.data) {
          return fallback.data as ServerAccessMemberRow;
        }
      }

      return null;
    },

    async hasExistingOwner() {
      const serviceClient = getSupabaseServiceClient();
      if (!serviceClient) return false;
      const { data } = await serviceClient
        .from('admin_users')
        .select('user_id')
        .eq('role', 'owner')
        .maybeSingle();
      return Boolean(data?.user_id);
    },

    async bootstrapInitialCeo() {
      const serviceClient = getSupabaseServiceClient();
      if (!serviceClient) {
        throw new Error(
          'A valid SUPABASE_SERVICE_ROLE_KEY is required on the server to run HTTP CEO bootstrap.'
        );
      }

      const { data, error } = await serviceClient.rpc(
        'bootstrap_initial_ceo_owner'
      );
      if (error) {
        throw new Error(error.message);
      }
      return data as ServerAccessMemberRow;
    },

    async listTeamDirectory(accessToken: string) {
      const rlsClient = createRequestSupabaseClient(accessToken);
      const serviceClient = getSupabaseServiceClient();
      const dbClient = rlsClient || serviceClient;
      if (!dbClient) {
        throw new Error('Supabase server configuration is unavailable.');
      }

      const [membersRes, invitesRes] = await Promise.all([
        dbClient
          .from('admin_users')
          .select('*')
          .order('registered_at', { ascending: false }),
        dbClient
          .from('team_invitations')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (membersRes.error) throw new Error(membersRes.error.message);
      if (invitesRes.error) throw new Error(invitesRes.error.message);

      let members = (membersRes.data || []) as ServerAccessMemberRow[];

      // Enrich with Supabase Auth verification & sign-in metadata ONLY when a valid service_role key exists
      if (serviceClient) {
        try {
          const { data: usersPage, error: listErr } =
            await serviceClient.auth.admin.listUsers({
              page: 1,
              perPage: 200,
            });
          if (!listErr && usersPage?.users) {
            const authMap = new Map(usersPage.users.map((u) => [u.id, u]));
            const knownIds = new Set(members.map((m) => m.user_id));

            members = members.map((m) => {
              const authUser = authMap.get(m.user_id);
              return {
                ...m,
                email_confirmed_at: authUser?.email_confirmed_at || null,
                last_sign_in_at:
                  authUser?.last_sign_in_at || m.last_sign_in_at || null,
              };
            });

            for (const authUser of usersPage.users) {
              if (!knownIds.has(authUser.id) && authUser.email) {
                members.push({
                  user_id: authUser.id,
                  email: authUser.email.toLowerCase(),
                  full_name:
                    (authUser.user_metadata?.full_name as string | undefined) ||
                    null,
                  role: 'none',
                  access_status: 'pending',
                  is_active: false,
                  permissions: [],
                  registered_at: authUser.created_at,
                  last_sign_in_at: authUser.last_sign_in_at || null,
                  email_confirmed_at: authUser.email_confirmed_at || null,
                });
              }
            }
          }
        } catch {
          // Non-fatal: directory still returns authoritative PostgreSQL records
        }
      }

      return {
        members,
        invitations: (invitesRes.data || []) as ServerInvitationRow[],
      };
    },

    async createInvitation(ceoUserId, accessToken, input) {
      const rlsClient = createRequestSupabaseClient(accessToken);
      const serviceClient = getSupabaseServiceClient();
      const dbClient = rlsClient || serviceClient;
      if (!dbClient) {
        throw new Error('Supabase server configuration is unavailable.');
      }

      const normalizedEmail = input.email.trim().toLowerCase();

      // 1. Check whether this email already belongs to a registered user in public.admin_users
      const { data: existingMember, error: memberCheckErr } = await dbClient
        .from('admin_users')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (memberCheckErr) {
        throw new Error(memberCheckErr.message);
      }

      if (existingMember && existingMember.role === 'owner') {
        throw new Error('This email belongs to the CEO owner account.');
      }

      // 2. Check for any existing pending invitation for this email in public.team_invitations
      const { data: existingPending, error: pendingCheckErr } = await dbClient
        .from('team_invitations')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingCheckErr) {
        throw new Error(pendingCheckErr.message);
      }

      if (existingPending) {
        const expMs = Date.parse(existingPending.expires_at);
        if (!Number.isNaN(expMs) && expMs <= Date.now()) {
          // Automatically mark expired pending row as 'expired' so a fresh invite can be saved cleanly
          const { error: expireErr } = await dbClient
            .from('team_invitations')
            .update({ status: 'expired' })
            .eq('id', existingPending.id);
          if (expireErr) {
            throw new Error(expireErr.message);
          }
        } else {
          throw new Error(
            `A pending invitation already exists for ${normalizedEmail}. Revoke the existing invitation first if you want to issue a new one.`
          );
        }
      }

      const shouldActivateExistingNow = Boolean(
        existingMember && !input.require_manual_approval
      );

      // 3. Persist the invitation to public.team_invitations and verify the saved row
      const { data: invRow, error: invErr } = await dbClient
        .from('team_invitations')
        .insert({
          email: normalizedEmail,
          full_name: input.full_name,
          role: input.role,
          permissions: input.permissions,
          require_manual_approval: input.require_manual_approval,
          status: shouldActivateExistingNow ? 'accepted' : 'pending',
          invited_by: ceoUserId,
          ...(shouldActivateExistingNow && existingMember
            ? { accepted_user_id: existingMember.user_id }
            : {}),
        })
        .select('*')
        .single();

      if (invErr || !invRow?.id) {
        throw new Error(
          invErr?.message ||
            'Database did not confirm saving the invitation to public.team_invitations.'
        );
      }

      // 4. If the teammate has ALREADY registered in public.admin_users, apply the CEO-assigned role & permissions
      let memberActivatedImmediately = false;
      if (existingMember) {
        const nextStatus: AccessStatus = input.require_manual_approval
          ? 'pending'
          : 'active';
        const nextActive = !input.require_manual_approval;

        const updatePayload: Record<string, unknown> = {
          role: input.role,
          access_status: nextStatus,
          is_active: nextActive,
          permissions: input.permissions,
          invited_by: ceoUserId,
          ...(input.full_name && !existingMember.full_name
            ? { full_name: input.full_name }
            : {}),
          ...(nextActive
            ? {
                approved_by: ceoUserId,
                approved_at: new Date().toISOString(),
              }
            : {}),
        };

        const { error: updateMemberErr } = await dbClient
          .from('admin_users')
          .update(updatePayload)
          .eq('user_id', existingMember.user_id);

        if (updateMemberErr) {
          throw new Error(updateMemberErr.message);
        }

        memberActivatedImmediately = nextActive;
      }

      // 5. Dispatch Supabase Auth invite email ONLY if a real service_role client is configured and user isn't registered yet
      let authEmailDispatched = false;
      if (!existingMember && serviceClient) {
        try {
          const inviteRes = await serviceClient.auth.admin.inviteUserByEmail(
            normalizedEmail,
            {
              data: input.full_name ? { full_name: input.full_name } : undefined,
              redirectTo: input.redirectTo,
            }
          );
          if (!inviteRes.error) {
            authEmailDispatched = true;
          }
        } catch {
          authEmailDispatched = false;
        }
      }

      return {
        invitation: invRow as ServerInvitationRow,
        authEmailDispatched,
        memberActivatedImmediately,
      };
    },

    async updateMemberAccess(ceoUserId, accessToken, targetUserId, updates) {
      const rlsClient = createRequestSupabaseClient(accessToken);
      const serviceClient = getSupabaseServiceClient();
      const dbClient = rlsClient || serviceClient;
      if (!dbClient) {
        throw new Error('Supabase server configuration is unavailable.');
      }

      const isActive =
        updates.access_status === 'active' && updates.role !== 'none';

      const payload: Record<string, unknown> = {
        role: updates.role,
        access_status: updates.access_status,
        is_active: isActive,
        permissions: updates.permissions,
      };

      if (isActive) {
        payload.approved_by = ceoUserId;
        payload.approved_at = new Date().toISOString();
      }

      const { data, error } = await dbClient
        .from('admin_users')
        .update(payload)
        .eq('user_id', targetUserId)
        .select('*')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as ServerAccessMemberRow;
    },

    async revokeInvitation(_ceoUserId, accessToken, invitationId) {
      const dbClient =
        createRequestSupabaseClient(accessToken) || getSupabaseServiceClient();
      if (!dbClient) {
        throw new Error('Supabase server configuration is unavailable.');
      }

      const { error } = await dbClient
        .from('team_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}

export function createAdminAccessRouter(
  customDeps?: Partial<AdminAccessDependencies>
): express.Router {
  const deps: AdminAccessDependencies = {
    ...buildDefaultDependencies(),
    ...customDeps,
  };

  const router = express.Router();

  function extractBearerToken(req: express.Request): string | null {
    const header = req.headers.authorization || '';
    if (!header.toLowerCase().startsWith('bearer ')) return null;
    const token = header.slice(7).trim();
    return token || null;
  }

  // Server-side CEO authentication & database-backed owner verification middleware
  const requireAuthenticatedCeo: express.RequestHandler = async (
    req,
    res,
    next
  ) => {
    if (!deps.isConfigured()) {
      res.status(503).json({
        error:
          'Supabase server environment variables are not configured yet.',
      });
      return;
    }

    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Authentication required. Provide a valid Supabase Bearer token.',
      });
      return;
    }

    const caller = await deps.verifyCaller(token);
    if (!caller) {
      res.status(401).json({
        error: 'Invalid or expired Supabase session token.',
      });
      return;
    }

    // CRITICAL: Authorization comes strictly from the database access record (never email alone!)
    const accessRecord = await deps.getAccessRecord(caller.id, token);
    if (
      !accessRecord ||
      accessRecord.role !== 'owner' ||
      accessRecord.access_status !== 'active' ||
      accessRecord.is_active !== true
    ) {
      res.status(403).json({
        error:
          'Forbidden. Only the verified active CEO / Owner account in public.admin_users can manage team access.',
      });
      return;
    }

    (req as any).ceoAuth = {
      userId: caller.id,
      email: caller.email,
      token,
    };
    next();
  };

  // Public-safe capability status (exposes zero secrets)
  router.get('/status', async (_req, res) => {
    const serverAdminConfigured = deps.hasServiceRole();
    let ceoBootstrapped = false;
    if (serverAdminConfigured) {
      ceoBootstrapped = await deps.hasExistingOwner().catch(() => false);
    }
    res.json({
      serverAdminConfigured,
      ceoBootstrapped,
    });
  });

  // Controlled one-time server-side CEO bootstrap endpoint
  router.post('/bootstrap-ceo', async (req, res) => {
    if (!deps.hasServiceRole()) {
      res.status(503).json({
        error:
          'A valid SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Run SELECT public.bootstrap_initial_ceo_owner(); in the Supabase SQL Editor instead.',
      });
      return;
    }

    const expectedSecret = deps.getBootstrapSecret();
    const providedSecret = String(
      req.headers['x-ceo-bootstrap-secret'] || ''
    ).trim();

    if (!expectedSecret || !timingSafeCompare(providedSecret, expectedSecret)) {
      res.status(403).json({
        error:
          'Forbidden. Valid x-ceo-bootstrap-secret header matching CEO_BOOTSTRAP_SECRET is required.',
      });
      return;
    }

    const requestedEmail = String(req.body?.email || OFFICIAL_CEO_EMAIL)
      .trim()
      .toLowerCase();
    if (requestedEmail !== OFFICIAL_CEO_EMAIL) {
      res.status(403).json({
        error: `Forbidden. Initial CEO owner role is strictly restricted to ${OFFICIAL_CEO_EMAIL}.`,
      });
      return;
    }

    if (await deps.hasExistingOwner()) {
      res.status(409).json({
        error:
          'Initial CEO owner account is already established. One-time bootstrap is permanently locked.',
      });
      return;
    }

    try {
      const ownerRecord = await deps.bootstrapInitialCeo();
      res.status(201).json({ owner: ownerRecord });
    } catch (err: unknown) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to bootstrap initial CEO owner.',
      });
    }
  });

  // CEO-only: List all registered users & pending invitations
  router.get('/team', requireAuthenticatedCeo, async (req, res) => {
    try {
      const { token } = (req as any).ceoAuth;
      const directory = await deps.listTeamDirectory(token);
      res.json({
        ...directory,
        authInviteSupported: deps.hasServiceRole(),
      });
    } catch (err: unknown) {
      res.status(400).json({
        error:
          err instanceof Error ? err.message : 'Unable to load team directory.',
      });
    }
  });

  // CEO-only: Invite a teammate or student with a restricted role & explicit permissions
  router.post('/invitations', requireAuthenticatedCeo, async (req, res) => {
    const { userId, token } = (req as any).ceoAuth;
    const rawEmail = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const rawName = req.body?.full_name
      ? String(req.body.full_name).trim()
      : null;
    const rawRole = String(req.body?.role || '').trim();
    const rawPerms = Array.isArray(req.body?.permissions)
      ? req.body.permissions
      : [];
    const requireManualApproval = Boolean(req.body?.require_manual_approval);
    const redirectTo =
      typeof req.body?.redirectTo === 'string'
        ? req.body.redirectTo.trim()
        : undefined;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    if (rawEmail === OFFICIAL_CEO_EMAIL) {
      res.status(400).json({
        error: 'The CEO owner email does not require a team invitation.',
      });
      return;
    }

    if (rawRole === 'owner') {
      res.status(403).json({
        error: 'Assigning the Owner / CEO role via team invitations is prohibited.',
      });
      return;
    }

    if (!VALID_DELEGATABLE_ROLES.has(rawRole)) {
      res.status(400).json({
        error:
          'Select a valid restricted role: admin, project_editor, event_manager, or viewer.',
      });
      return;
    }

    const role = rawRole as DelegatableRole;
    const permissions = sanitizePermissionsForRole(role, rawPerms);
    if (permissions.length === 0) {
      res.status(400).json({
        error: 'Select at least one permission to grant for this invitation.',
      });
      return;
    }

    try {
      const result = await deps.createInvitation(userId, token, {
        email: rawEmail,
        full_name: rawName,
        role,
        permissions,
        require_manual_approval: requireManualApproval,
        redirectTo,
      });
      res.status(201).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        error:
          err instanceof Error ? err.message : 'Failed to create team invitation.',
      });
    }
  });

  // CEO-only: Approve user, change restricted role, update granular permissions, suspend/reactivate/revoke
  router.patch(
    '/members/:targetUserId',
    requireAuthenticatedCeo,
    async (req, res) => {
      const { userId: ceoUserId, token } = (req as any).ceoAuth;
      const targetUserId = String(req.params.targetUserId || '').trim();

      if (!targetUserId) {
        res.status(400).json({ error: 'Target user ID is required.' });
        return;
      }

      if (targetUserId === ceoUserId) {
        res.status(403).json({
          error:
            'The CEO owner account cannot modify or suspend its own role or permissions.',
        });
        return;
      }

      const rawRole = String(req.body?.role || '').trim();
      const rawStatus = String(req.body?.access_status || '').trim();
      const rawPerms = Array.isArray(req.body?.permissions)
        ? req.body.permissions
        : [];

      if (rawRole === 'owner') {
        res.status(403).json({
          error: 'Promoting another user to Owner / CEO is prohibited.',
        });
        return;
      }

      if (!VALID_NON_OWNER_ROLES.has(rawRole)) {
        res.status(400).json({ error: 'Invalid role specified.' });
        return;
      }

      if (!VALID_ACCESS_STATUSES.has(rawStatus)) {
        res.status(400).json({ error: 'Invalid access_status specified.' });
        return;
      }

      const role = rawRole as DashboardRole;
      const access_status =
        role === 'none' && rawStatus === 'active'
          ? 'revoked'
          : (rawStatus as AccessStatus);
      const permissions = sanitizePermissionsForRole(role, rawPerms);

      if (access_status === 'active' && role !== 'none' && permissions.length === 0) {
        res.status(400).json({
          error:
            'Active dashboard members must be granted at least one explicit permission.',
        });
        return;
      }

      try {
        const updated = await deps.updateMemberAccess(
          ceoUserId,
          token,
          targetUserId,
          {
            role,
            access_status,
            permissions,
          }
        );
        res.json({ member: updated });
      } catch (err: unknown) {
        res.status(400).json({
          error:
            err instanceof Error
              ? err.message
              : 'Failed to update member access.',
        });
      }
    }
  );

  // CEO-only: Revoke/cancel a pending invitation
  router.delete(
    '/invitations/:invitationId',
    requireAuthenticatedCeo,
    async (req, res) => {
      const { userId: ceoUserId, token } = (req as any).ceoAuth;
      const invitationId = String(req.params.invitationId || '').trim();

      if (!invitationId) {
        res.status(400).json({ error: 'Invitation ID is required.' });
        return;
      }

      try {
        await deps.revokeInvitation(ceoUserId, token, invitationId);
        res.json({ revoked: true });
      } catch (err: unknown) {
        res.status(400).json({
          error:
            err instanceof Error
              ? err.message
              : 'Failed to revoke team invitation.',
        });
      }
    }
  );

  return router;
}

export default createAdminAccessRouter();
