import { supabase, isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';
import {
  AccessStatus,
  DashboardRole,
  DelegatableRole,
  OFFICIAL_CEO_EMAIL,
  PermissionKey,
  sanitizePermissionsForRole,
} from '../types/rbac';

export type ProjectStatus = 'draft' | 'published' | 'archived';

export interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  tagline: string | null;
  description: string;
  image_url: string | null;
  category: string;
  technologies: string[];
  live_url: string | null;
  source_url: string | null;
  status: ProjectStatus;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'past' | 'cancelled' | 'archived';

export interface EventRecord {
  id: string;
  title: string;
  slug: string | null;
  tagline: string | null;
  category: string;
  description: string;
  event_date: string;
  end_date: string | null;
  location: string;
  is_virtual: boolean;
  registration_url: string | null;
  image_url: string | null;
  prize_pool: string | null;
  tags: string[];
  status: EventStatus;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRecord {
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
  created_at?: string;
}

export interface TeamInvitationRecord {
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

export interface ContactInquiryRecord {
  id: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  status: 'New' | 'Read' | 'In Progress' | 'Responded' | 'Closed';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareerApplicationRecord {
  id: string;
  applicant_name: string;
  applicant_email: string;
  department_name: string;
  skills: string | null;
  cover_note: string | null;
  portfolio_url: string | null;
  status: 'pending' | 'reviewing' | 'accepted' | 'declined';
  submitted_at: string;
}

export interface EventParticipantRecord {
  id: string;
  event_id: string;
  event_title?: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  college?: string | null;
  branch?: string | null;
  roll_number?: string | null;
  created_at: string;
  status: 'registered' | 'withdrawn' | 'confirmed' | 'attended' | 'cancelled';
}

export interface TeamMemberRecord {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  role_title: string;
  department: string;
  is_lead: boolean;
  lead_id: string | null;
  bio: string | null;
  avatar_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type ServiceErrorKind =
  | 'missing_configuration'
  | 'permission_denied'
  | 'session_expired'
  | 'schema_missing'
  | 'duplicate'
  | 'validation'
  | 'network'
  | 'database';

export class AppServiceError extends Error {
  public readonly kind: ServiceErrorKind;
  public readonly code?: string;

  constructor(message: string, kind: ServiceErrorKind, code?: string) {
    super(message);
    this.name = 'AppServiceError';
    this.kind = kind;
    this.code = code;
  }
}

const CONTENT_UPDATED_EVENT = 'aiconext:content-updated';

export function emitContentUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONTENT_UPDATED_EVENT));
  }
}

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new AppServiceError(
      supabaseConfigError ||
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      'missing_configuration'
    );
  }
  return supabase;
}

export function translateSupabaseError(err: any, fallbackMessage: string): AppServiceError {
  if (err instanceof AppServiceError) return err;

  const code = err?.code || err?.status?.toString();
  const rawMessage = String(err?.message || err?.error_description || '');
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return new AppServiceError(
      'Network error while communicating with Supabase. Verify your internet connection and VITE_SUPABASE_URL.',
      'network',
      code
    );
  }

  if (code === 'PGRST301' || lower.includes('jwt expired') || lower.includes('invalid jwt')) {
    return new AppServiceError(
      'Your session has expired. Please sign in again.',
      'session_expired',
      code
    );
  }

  if (
    code === '42501' ||
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('missing required permission') ||
    lower.includes('prohibited')
  ) {
    return new AppServiceError(
      rawMessage && lower.includes('missing required permission')
        ? rawMessage
        : 'Permission denied by database security policy. Your account does not hold the required permission for this action.',
      'permission_denied',
      code
    );
  }

  if (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST205' ||
    lower.includes('does not exist') ||
    lower.includes('schema cache')
  ) {
    // Provide a precise, actionable diagnostics message identifying the missing database structure
    let specificDetail = '';
    if (lower.includes('admin_users')) {
      specificDetail = 'table "public.admin_users"';
    } else if (lower.includes('team_invitations')) {
      specificDetail = 'table "public.team_invitations"';
    } else if (lower.includes('team_members')) {
      specificDetail = 'table "public.team_members"';
    } else if (lower.includes('event_participants')) {
      specificDetail = 'table "public.event_participants"';
    } else if (lower.includes('projects')) {
      specificDetail = 'table "public.projects"';
    } else if (lower.includes('events')) {
      specificDetail = 'table "public.events"';
    } else if (lower.includes('contact_inquiries')) {
      specificDetail = 'table "public.contact_inquiries"';
    } else if (lower.includes('career_applications')) {
      specificDetail = 'table "public.career_applications"';
    } else if (rawMessage) {
      specificDetail = `schema requirement (${rawMessage})`;
    }

    const message = specificDetail
      ? `Database setup required: Supabase ${specificDetail} was not found. Please apply the migration scripts (20261025000001, 20261025000002, and 20261027000003) in your Supabase SQL Editor.`
      : 'Required Supabase RBAC tables or columns were not found. Apply migrations 20261025000001, 20261025000002, and 20261027000003 in your Supabase SQL Editor.';

    return new AppServiceError(message, 'schema_missing', code);
  }

  if (code === '23505' || lower.includes('duplicate key')) {
    if (lower.includes('idx_team_invitations_pending_email')) {
      return new AppServiceError(
        'A pending invitation already exists for this email address. Revoke the existing invitation first if you want to issue a new one.',
        'duplicate',
        code
      );
    }
    return new AppServiceError(
      rawMessage || 'A duplicate record already exists.',
      'duplicate',
      code
    );
  }

  return new AppServiceError(rawMessage || fallbackMessage, 'database', code);
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function validateOptionalHttpUrl(
  url: string | null | undefined,
  fieldLabel: string
): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new AppServiceError(`${fieldLabel} must start with https:// or http://.`, 'validation');
    }
    return parsed.toString();
  } catch (err) {
    if (err instanceof AppServiceError) throw err;
    throw new AppServiceError(`${fieldLabel} is not a valid URL.`, 'validation');
  }
}

export function isEventCurrentlyUpcoming(
  evt: Pick<EventRecord, 'event_date' | 'end_date' | 'status' | 'is_published'>
): boolean {
  if (!evt.is_published) return false;
  if (evt.status !== 'upcoming' && evt.status !== 'ongoing') return false;
  const cutoffIso = evt.end_date || evt.event_date;
  const cutoffMs = Date.parse(cutoffIso);
  if (Number.isNaN(cutoffMs)) return false;
  return cutoffMs >= Date.now();
}

export function formatCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    'ai-ml': 'AI & Machine Learning',
    fullstack: 'Full-Stack Systems',
    'cloud-devops': 'Cloud & Infrastructure',
    research: 'Simulation & R&D',
  };
  return map[category] || category;
}

// ============================================================================
// Realtime Subscriptions (Public Content + Live Access Revocation Sync)
// ============================================================================

export function subscribeToPublicContent(
  tables: ('projects' | 'events')[],
  onChange: () => void
): () => void {
  const handleLocalUpdate = () => onChange();
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') onChange();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(CONTENT_UPDATED_EVENT, handleLocalUpdate);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  let cleanupRealtime: (() => void) | null = null;
  if (isSupabaseConfigured && supabase) {
    const client = supabase;
    const channelName = `public-sync-${tables.join('-')}-${Math.random().toString(36).slice(2, 8)}`;
    let channel = client.channel(channelName);
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => onChange()
      );
    }
    channel.subscribe();
    cleanupRealtime = () => {
      void client.removeChannel(channel);
    };
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(CONTENT_UPDATED_EVENT, handleLocalUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    if (cleanupRealtime) cleanupRealtime();
  };
}

export function subscribeToUserAccessChanges(
  userId: string,
  onChange: () => void
): () => void {
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') onChange();
  };

  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  let cleanupRealtime: (() => void) | null = null;
  if (isSupabaseConfigured && supabase) {
    const client = supabase;
    const channel = client
      .channel(`access-watch-${userId}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_users',
          filter: `user_id=eq.${userId}`,
        },
        () => onChange()
      )
      .subscribe();

    cleanupRealtime = () => {
      void client.removeChannel(channel);
    };
  }

  return () => {
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    if (cleanupRealtime) cleanupRealtime();
  };
}

// ============================================================================
// Database-Backed Access Record Lookup
// ============================================================================

function normalizeAdminRecord(raw: any): AdminUserRecord {
  const rawRole = String(raw.role || 'none');
  const validRoles: DashboardRole[] = [
    'owner',
    'admin',
    'project_editor',
    'event_manager',
    'viewer',
    'none',
  ];
  const role: DashboardRole = validRoles.includes(rawRole as DashboardRole)
    ? (rawRole as DashboardRole)
    : 'none';

  const rawStatus = String(raw.access_status || (raw.is_active ? 'active' : 'pending'));
  const validStatuses: AccessStatus[] = ['pending', 'active', 'suspended', 'revoked'];
  const access_status: AccessStatus = validStatuses.includes(rawStatus as AccessStatus)
    ? (rawStatus as AccessStatus)
    : 'pending';

  const is_active = Boolean(raw.is_active) && access_status === 'active' && role !== 'none';
  const permissions = sanitizePermissionsForRole(
    role,
    Array.isArray(raw.permissions) ? raw.permissions : []
  );

  return {
    user_id: String(raw.user_id),
    email: String(raw.email || '').toLowerCase(),
    full_name: raw.full_name || null,
    role,
    access_status,
    is_active,
    permissions,
    invited_by: raw.invited_by || null,
    approved_by: raw.approved_by || null,
    approved_at: raw.approved_at || null,
    registered_at: raw.registered_at || raw.created_at || new Date().toISOString(),
    last_sign_in_at: raw.last_sign_in_at || null,
    email_confirmed_at: raw.email_confirmed_at || null,
    created_at: raw.created_at,
  };
}

export async function fetchCurrentAdminRecord(userId: string): Promise<AdminUserRecord | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('admin_users')
    .select(
      'user_id, email, full_name, role, access_status, is_active, permissions, invited_by, approved_by, approved_at, registered_at, last_sign_in_at, created_at'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw translateSupabaseError(error, 'Failed to verify dashboard access authorization.');
  }
  return data ? normalizeAdminRecord(data) : null;
}

// ============================================================================
// CEO-Controlled Team Access Management API (Server Admin API + RLS Enforcement)
// ============================================================================

async function getActiveSessionToken(): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new AppServiceError(
      'Your session has expired. Please sign in again.',
      'session_expired'
    );
  }
  return data.session.access_token;
}

export interface TeamDirectoryResponse {
  members: AdminUserRecord[];
  invitations: TeamInvitationRecord[];
  authInviteSupported: boolean;
}

export async function fetchTeamDirectory(): Promise<TeamDirectoryResponse> {
  const token = await getActiveSessionToken();

  // Attempt server-side CEO Admin endpoint first (provides enriched auth.users metadata)
  try {
    const res = await fetch('/api/admin/team', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      return {
        members: ((json.members || []) as any[]).map(normalizeAdminRecord),
        invitations: (json.invitations || []) as TeamInvitationRecord[],
        authInviteSupported: Boolean(json.authInviteSupported),
      };
    }

    if (res.status === 401 || res.status === 403) {
      const errBody = await res.json().catch(() => ({}));
      throw new AppServiceError(
        errBody.error || 'Only the CEO owner account can access Team Management.',
        res.status === 401 ? 'session_expired' : 'permission_denied'
      );
    }
    // If 503 or 404 (static deployment without Node service_role), fall through to direct PostgreSQL RLS
  } catch (err) {
    if (err instanceof AppServiceError) throw err;
  }

  // Direct PostgreSQL RLS fallback (strictly protected by public.is_ceo() policy)
  const client = requireClient();
  const [membersRes, invitesRes] = await Promise.all([
    client.from('admin_users').select('*').order('registered_at', { ascending: false }),
    client.from('team_invitations').select('*').order('created_at', { ascending: false }),
  ]);

  if (membersRes.error) {
    throw translateSupabaseError(membersRes.error, 'Failed to load team access directory.');
  }
  if (invitesRes.error) {
    throw translateSupabaseError(invitesRes.error, 'Failed to load team invitations.');
  }

  return {
    members: ((membersRes.data || []) as any[]).map(normalizeAdminRecord),
    invitations: (invitesRes.data || []) as TeamInvitationRecord[],
    authInviteSupported: false,
  };
}

const ALLOWED_INVITE_ROLES: DelegatableRole[] = [
  'admin',
  'project_editor',
  'event_manager',
  'viewer',
];

export interface CreateCeoInvitationResponse {
  invitation: TeamInvitationRecord;
  authEmailDispatched: boolean;
  memberActivatedImmediately: boolean;
}

export async function createCeoTeamInvitation(input: {
  email: string;
  full_name?: string;
  role: DelegatableRole;
  permissions: PermissionKey[];
  require_manual_approval?: boolean;
}): Promise<CreateCeoInvitationResponse> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AppServiceError('Please enter a valid teammate email address.', 'validation');
  }

  if (email === OFFICIAL_CEO_EMAIL) {
    throw new AppServiceError(
      'The CEO owner email does not require a team invitation.',
      'validation'
    );
  }

  if (!ALLOWED_INVITE_ROLES.includes(input.role)) {
    throw new AppServiceError(
      'Select a valid restricted role: Admin, Project Editor, Event Manager, or Viewer.',
      'validation'
    );
  }

  const sanitizedPerms = sanitizePermissionsForRole(input.role, input.permissions);
  if (sanitizedPerms.length === 0) {
    throw new AppServiceError(
      'Select at least one permission to grant for this invitation.',
      'validation'
    );
  }

  const client = requireClient();
  const { data: sessionData, error: sessionErr } = await client.auth.getSession();
  if (sessionErr || !sessionData.session?.access_token || !sessionData.session.user?.id) {
    throw new AppServiceError(
      'Your session has expired. Please sign in again.',
      'session_expired'
    );
  }

  const token = sessionData.session.access_token;
  const callerUserId = sessionData.session.user.id;
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

  try {
    const res = await fetch('/api/admin/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email,
        full_name: input.full_name?.trim() || null,
        role: input.role,
        permissions: sanitizedPerms,
        require_manual_approval: Boolean(input.require_manual_approval),
        redirectTo,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (!json?.invitation?.id) {
        throw new AppServiceError(
          'Server response did not include a saved invitation record.',
          'database'
        );
      }
      return {
        invitation: json.invitation as TeamInvitationRecord,
        authEmailDispatched: Boolean(json.authEmailDispatched),
        memberActivatedImmediately: Boolean(json.memberActivatedImmediately),
      };
    }

    if (res.status !== 503 && res.status !== 404) {
      const errBody = await res.json().catch(() => ({}));
      throw new AppServiceError(
        errBody.error || `Failed to save team invitation (HTTP ${res.status}).`,
        res.status === 401
          ? 'session_expired'
          : res.status === 403
          ? 'permission_denied'
          : 'validation'
      );
    }
  } catch (err) {
    if (err instanceof AppServiceError) throw err;
  }

  // Direct PostgreSQL RLS fallback (for static deployments without Express; strictly enforced by public.is_ceo())
  const callerRecord = await fetchCurrentAdminRecord(callerUserId);
  if (
    !callerRecord ||
    callerRecord.role !== 'owner' ||
    callerRecord.access_status !== 'active' ||
    !callerRecord.is_active
  ) {
    throw new AppServiceError(
      'Forbidden. Only the verified active CEO / Owner account can invite teammates.',
      'permission_denied'
    );
  }

  const { data: existingMember, error: memberCheckErr } = await client
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (memberCheckErr) {
    throw translateSupabaseError(memberCheckErr, 'Failed to check existing team directory.');
  }
  if (existingMember?.role === 'owner') {
    throw new AppServiceError('This email belongs to the CEO owner account.', 'validation');
  }

  const { data: existingPending, error: pendingCheckErr } = await client
    .from('team_invitations')
    .select('*')
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (pendingCheckErr) {
    throw translateSupabaseError(pendingCheckErr, 'Failed to check pending invitations.');
  }

  if (existingPending) {
    const expMs = Date.parse(existingPending.expires_at);
    if (!Number.isNaN(expMs) && expMs <= Date.now()) {
      const { error: expireErr } = await client
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', existingPending.id);
      if (expireErr) {
        throw translateSupabaseError(expireErr, 'Failed to expire previous invitation.');
      }
    } else {
      throw new AppServiceError(
        `A pending invitation already exists for ${email}. Revoke the existing invitation first if you want to issue a new one.`,
        'duplicate'
      );
    }
  }

  const requireManual = Boolean(input.require_manual_approval);
  const shouldActivateNow = Boolean(existingMember && !requireManual);

  const { data, error } = await client
    .from('team_invitations')
    .insert({
      email,
      full_name: input.full_name?.trim() || null,
      role: input.role,
      permissions: sanitizedPerms,
      require_manual_approval: requireManual,
      status: shouldActivateNow ? 'accepted' : 'pending',
      invited_by: callerUserId,
      ...(shouldActivateNow && existingMember
        ? { accepted_user_id: existingMember.user_id }
        : {}),
    })
    .select('*')
    .single();

  if (error || !data?.id) {
    throw translateSupabaseError(
      error || new Error('Invitation was not persisted to public.team_invitations.'),
      'Failed to save team invitation to public.team_invitations.'
    );
  }

  let memberActivatedImmediately = false;
  if (existingMember) {
    const nextActive = !requireManual;
    const { error: updateErr } = await client
      .from('admin_users')
      .update({
        role: input.role,
        access_status: nextActive ? 'active' : 'pending',
        is_active: nextActive,
        permissions: sanitizedPerms,
        invited_by: callerUserId,
        ...(nextActive
          ? { approved_by: callerUserId, approved_at: new Date().toISOString() }
          : {}),
      })
      .eq('user_id', existingMember.user_id);

    if (updateErr) {
      throw translateSupabaseError(
        updateErr,
        'Invitation was recorded, but updating existing member permissions failed.'
      );
    }
    memberActivatedImmediately = nextActive;
  }

  return {
    invitation: data as TeamInvitationRecord,
    authEmailDispatched: false,
    memberActivatedImmediately,
  };
}

export async function updateCeoTeamMemberAccess(
  targetUserId: string,
  updates: {
    role: Exclude<DashboardRole, 'owner'>;
    access_status: AccessStatus;
    permissions: PermissionKey[];
  }
): Promise<AdminUserRecord> {
  const sanitizedPerms = sanitizePermissionsForRole(updates.role, updates.permissions);
  if (
    updates.access_status === 'active' &&
    updates.role !== 'none' &&
    sanitizedPerms.length === 0
  ) {
    throw new AppServiceError(
      'Select at least one explicit permission when activating dashboard access.',
      'validation'
    );
  }

  const token = await getActiveSessionToken();

  try {
    const res = await fetch(`/api/admin/members/${encodeURIComponent(targetUserId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: updates.role,
        access_status: updates.access_status,
        permissions: sanitizedPerms,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      return normalizeAdminRecord(json.member);
    }

    if (res.status !== 503 && res.status !== 404) {
      const errBody = await res.json().catch(() => ({}));
      throw new AppServiceError(
        errBody.error || 'Failed to update member access.',
        res.status === 403 ? 'permission_denied' : 'validation'
      );
    }
  } catch (err) {
    if (err instanceof AppServiceError) throw err;
  }

  // Direct PostgreSQL RLS fallback (enforced by admin_users_ceo_update & security trigger)
  const client = requireClient();
  const isActive = updates.access_status === 'active' && updates.role !== 'none';

  const { data, error } = await client
    .from('admin_users')
    .update({
      role: updates.role,
      access_status: updates.access_status,
      is_active: isActive,
      permissions: sanitizedPerms,
      ...(isActive ? { approved_at: new Date().toISOString() } : {}),
    })
    .eq('user_id', targetUserId)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to update member access.');
  }

  return normalizeAdminRecord(data);
}

export async function revokeCeoTeamInvitation(invitationId: string): Promise<void> {
  const token = await getActiveSessionToken();

  try {
    const res = await fetch(`/api/admin/invitations/${encodeURIComponent(invitationId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) return;

    if (res.status !== 503 && res.status !== 404) {
      const errBody = await res.json().catch(() => ({}));
      throw new AppServiceError(
        errBody.error || 'Failed to revoke invitation.',
        res.status === 403 ? 'permission_denied' : 'validation'
      );
    }
  } catch (err) {
    if (err instanceof AppServiceError) throw err;
  }

  const client = requireClient();
  const { error } = await client
    .from('team_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);

  if (error) {
    throw translateSupabaseError(error, 'Failed to revoke invitation.');
  }
}

// ============================================================================
// Public Website Read Queries (Read-Only, Published Records Only)
// ============================================================================

export async function fetchPublishedProjects(): Promise<ProjectRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('is_published', true)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    throw translateSupabaseError(error, 'Unable to load published projects.');
  }

  return ((data || []) as ProjectRecord[]).filter(
    (p) => p.is_published === true && p.status === 'published'
  );
}

export async function fetchPublishedUpcomingEvents(): Promise<EventRecord[]> {
  const client = requireClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await client
    .from('events')
    .select('*')
    .eq('is_published', true)
    .in('status', ['upcoming', 'ongoing'])
    .or(`end_date.gte.${nowIso},and(end_date.is.null,event_date.gte.${nowIso})`)
    .order('event_date', { ascending: true });

  if (error) {
    throw translateSupabaseError(error, 'Unable to load upcoming flagship events.');
  }

  return ((data || []) as EventRecord[]).filter(isEventCurrentlyUpcoming);
}

export async function fetchPublishedPastEvents(): Promise<EventRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('events')
    .select('*')
    .eq('is_published', true)
    .eq('status', 'past')
    .order('event_date', { ascending: false });

  if (error) {
    throw translateSupabaseError(error, 'Unable to load past events.');
  }

  return (data || []) as EventRecord[];
}

// ============================================================================
// Authorized Dashboard CRUD — Projects (Enforced by Granular RLS + Triggers)
// ============================================================================

export interface ProjectUpsertInput {
  title: string;
  slug?: string;
  tagline?: string | null;
  description: string;
  image_url?: string | null;
  category: string;
  technologies: string[];
  live_url?: string | null;
  source_url?: string | null;
  publish: boolean;
}

function validateAndBuildProjectPayload(input: ProjectUpsertInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  const category = input.category.trim() || 'ai-ml';

  if (title.length < 2) {
    throw new AppServiceError('Project title must be at least 2 characters.', 'validation');
  }
  if (description.length < 10) {
    throw new AppServiceError('Project description must be at least 10 characters.', 'validation');
  }

  const slug = input.slug ? input.slug.trim().toLowerCase() : generateSlug(title);
  if (!slug || !isValidSlug(slug)) {
    throw new AppServiceError(
      'Project slug must contain only lowercase letters, numbers, and single hyphens.',
      'validation'
    );
  }

  const image_url = validateOptionalHttpUrl(input.image_url, 'Project thumbnail URL');
  const live_url = validateOptionalHttpUrl(input.live_url, 'Live demo URL');
  const source_url = validateOptionalHttpUrl(input.source_url, 'Source code URL');

  const technologies = Array.from(
    new Set(
      (input.technologies || [])
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );

  const is_published = Boolean(input.publish);
  const status: ProjectStatus = is_published ? 'published' : 'draft';

  return {
    title,
    slug,
    tagline: input.tagline?.trim() || null,
    description,
    image_url,
    category,
    technologies,
    live_url,
    source_url,
    status,
    is_published,
  };
}

export async function fetchAdminProjects(): Promise<ProjectRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw translateSupabaseError(error, 'Failed to load projects for dashboard.');
  }
  return (data || []) as ProjectRecord[];
}

export async function createAdminProject(input: ProjectUpsertInput): Promise<ProjectRecord> {
  const client = requireClient();
  const payload = validateAndBuildProjectPayload(input);

  const { data, error } = await client
    .from('projects')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to create project.');
  }
  emitContentUpdated();
  return data as ProjectRecord;
}

export async function updateAdminProject(
  id: string,
  input: ProjectUpsertInput,
  includePublishState = true
): Promise<ProjectRecord> {
  const client = requireClient();
  const fullPayload = validateAndBuildProjectPayload(input);
  const { status, is_published, ...contentOnly } = fullPayload;
  const payload = includePublishState ? fullPayload : contentOnly;

  const { data, error } = await client
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to update project.');
  }
  emitContentUpdated();
  return data as ProjectRecord;
}

export async function setAdminProjectPublication(
  id: string,
  publish: boolean
): Promise<ProjectRecord> {
  const client = requireClient();
  const updateData = publish
    ? { is_published: true, status: 'published' as ProjectStatus }
    : { is_published: false, status: 'draft' as ProjectStatus };

  const { data, error } = await client
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(
      error,
      publish ? 'Failed to publish project.' : 'Failed to unpublish project.'
    );
  }
  emitContentUpdated();
  return data as ProjectRecord;
}

export async function archiveAdminProject(id: string): Promise<ProjectRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .update({ is_published: false, status: 'archived' as ProjectStatus })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to archive project.');
  }
  emitContentUpdated();
  return data as ProjectRecord;
}

export async function deleteAdminProject(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('projects').delete().eq('id', id);
  if (error) {
    throw translateSupabaseError(error, 'Failed to delete project.');
  }
  emitContentUpdated();
}

// ============================================================================
// Authorized Dashboard CRUD — Events (Enforced by Granular RLS + Triggers)
// ============================================================================

export interface EventUpsertInput {
  title: string;
  tagline?: string | null;
  category: string;
  description: string;
  event_date: string;
  end_date?: string | null;
  location: string;
  is_virtual?: boolean;
  registration_url?: string | null;
  image_url?: string | null;
  prize_pool?: string | null;
  tags?: string[];
  status: EventStatus;
  is_published: boolean;
}

function validateAndBuildEventPayload(input: EventUpsertInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  const location = input.location.trim();
  const category = input.category.trim() || 'Hackathon';

  if (title.length < 2) {
    throw new AppServiceError('Event title must be at least 2 characters.', 'validation');
  }
  if (description.length < 10) {
    throw new AppServiceError('Event description must be at least 10 characters.', 'validation');
  }
  if (!location) {
    throw new AppServiceError('Event venue or online location is required.', 'validation');
  }

  const startMs = Date.parse(input.event_date);
  if (Number.isNaN(startMs)) {
    throw new AppServiceError('Please enter a valid event date and time.', 'validation');
  }
  const event_date = new Date(startMs).toISOString();

  let end_date: string | null = null;
  if (input.end_date && input.end_date.trim()) {
    const endMs = Date.parse(input.end_date);
    if (Number.isNaN(endMs)) {
      throw new AppServiceError('Please enter a valid event end date and time.', 'validation');
    }
    if (endMs < startMs) {
      throw new AppServiceError(
        'Event end date/time cannot be earlier than the start date/time.',
        'validation'
      );
    }
    end_date = new Date(endMs).toISOString();
  }

  const registration_url = validateOptionalHttpUrl(input.registration_url, 'Registration URL');
  const image_url = validateOptionalHttpUrl(input.image_url, 'Cover image URL');

  let status: EventStatus = input.status;
  const is_published = Boolean(input.is_published);

  if (is_published && (status === 'draft' || status === 'cancelled' || status === 'archived')) {
    status = 'upcoming';
  }
  if (!is_published && status !== 'cancelled' && status !== 'archived' && status !== 'past') {
    status = 'draft';
  }

  const tags = Array.from(
    new Set(
      (input.tags || [])
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );

  const baseSlug = generateSlug(title);
  const slug = baseSlug ? `${baseSlug}-${startMs.toString(36).slice(-4)}` : null;

  return {
    title,
    slug,
    tagline: input.tagline?.trim() || null,
    category,
    description,
    event_date,
    end_date,
    location,
    is_virtual: Boolean(input.is_virtual),
    registration_url,
    image_url,
    prize_pool: input.prize_pool?.trim() || null,
    tags,
    status,
    is_published,
  };
}

export async function fetchAdminEvents(): Promise<EventRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('events')
    .select('*')
    .order('event_date', { ascending: true });

  if (error) {
    throw translateSupabaseError(error, 'Failed to load events for dashboard.');
  }
  return (data || []) as EventRecord[];
}

export async function createAdminEvent(input: EventUpsertInput): Promise<EventRecord> {
  const client = requireClient();
  const payload = validateAndBuildEventPayload(input);

  const { data, error } = await client
    .from('events')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to create event.');
  }
  emitContentUpdated();
  return data as EventRecord;
}

export async function updateAdminEvent(
  id: string,
  input: EventUpsertInput,
  includePublishState = true
): Promise<EventRecord> {
  const client = requireClient();
  const payload = validateAndBuildEventPayload(input);
  const { slug: _ignoredSlug, status, is_published, ...contentFields } = payload;
  const updateFields = includePublishState
    ? { ...contentFields, status, is_published }
    : contentFields;

  const { data, error } = await client
    .from('events')
    .update(updateFields)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to update event.');
  }
  emitContentUpdated();
  return data as EventRecord;
}

export async function setAdminEventPublication(
  id: string,
  publish: boolean,
  currentStatus: EventStatus
): Promise<EventRecord> {
  const client = requireClient();
  const nextStatus: EventStatus = publish
    ? currentStatus === 'past' || currentStatus === 'ongoing'
      ? currentStatus
      : 'upcoming'
    : 'draft';

  const { data, error } = await client
    .from('events')
    .update({
      is_published: publish,
      status: nextStatus,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(
      error,
      publish ? 'Failed to publish event.' : 'Failed to unpublish event.'
    );
  }
  emitContentUpdated();
  return data as EventRecord;
}

export async function deleteAdminEvent(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('events').delete().eq('id', id);
  if (error) {
    throw translateSupabaseError(error, 'Failed to delete event.');
  }
  emitContentUpdated();
}

// ============================================================================
// Contact Inquiries & Roster Applications
// ============================================================================

export async function submitPublicContactInquiry(input: {
  name: string;
  email: string;
  subject?: string;
  category?: string;
  message: string;
}): Promise<void> {
  const client = requireClient();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const message = input.message.trim();

  if (name.length < 2) {
    throw new AppServiceError('Please enter your full name.', 'validation');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AppServiceError('Please enter a valid email address.', 'validation');
  }
  if (message.length < 5) {
    throw new AppServiceError('Please provide a message of at least 5 characters.', 'validation');
  }

  const { error } = await client.from('contact_inquiries').insert({
    name,
    email,
    subject: input.subject?.trim() || 'General Inquiry',
    category: input.category || 'General Inquiry',
    message,
    status: 'New',
  });

  if (error) {
    throw translateSupabaseError(error, 'Failed to submit contact inquiry.');
  }
}

export async function fetchAdminInquiries(): Promise<ContactInquiryRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('contact_inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw translateSupabaseError(error, 'Failed to load inbound inquiries.');
  }
  return (data || []) as ContactInquiryRecord[];
}

export async function updateAdminInquiryStatus(
  id: string,
  status: ContactInquiryRecord['status']
): Promise<ContactInquiryRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('contact_inquiries')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to update inquiry status.');
  }
  return data as ContactInquiryRecord;
}

export async function deleteAdminInquiry(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('contact_inquiries').delete().eq('id', id);
  if (error) {
    throw translateSupabaseError(error, 'Failed to delete inquiry.');
  }
}

export async function submitPublicRosterApplication(input: {
  applicant_name: string;
  applicant_email: string;
  department_name?: string;
  skills?: string;
  cover_note?: string;
  portfolio_url?: string;
}): Promise<void> {
  const client = requireClient();
  const applicant_name = input.applicant_name.trim();
  const applicant_email = input.applicant_email.trim().toLowerCase();

  if (applicant_name.length < 2) {
    throw new AppServiceError('Please enter your full name.', 'validation');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(applicant_email)) {
    throw new AppServiceError('Please enter a valid email address.', 'validation');
  }

  const portfolio_url = validateOptionalHttpUrl(input.portfolio_url, 'Portfolio URL');

  const { error } = await client.from('career_applications').insert({
    applicant_name,
    applicant_email,
    department_name: input.department_name?.trim() || 'AI & Machine Learning',
    skills: input.skills?.trim() || null,
    cover_note: input.cover_note?.trim() || null,
    portfolio_url,
    status: 'pending',
  });

  if (error) {
    throw translateSupabaseError(error, 'Failed to submit membership application.');
  }
}

export async function fetchAdminApplications(): Promise<CareerApplicationRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('career_applications')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    throw translateSupabaseError(error, 'Failed to load roster applications.');
  }
  return (data || []) as CareerApplicationRecord[];
}

export async function updateAdminApplicationStatus(
  id: string,
  status: CareerApplicationRecord['status']
): Promise<CareerApplicationRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('career_applications')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to update application status.');
  }
  return data as CareerApplicationRecord;
}

// ----------------------------------------------------------------------------
// Event Participation (5-minute self-withdrawal rule & participant listing)
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Event Participation (Free Local File & Direct Server Workflow - Zero Supabase Needed)
// ----------------------------------------------------------------------------

const LOCAL_STORAGE_KEY_PARTICIPANTS = 'aiconekt_local_participants';

function getLocalStoredParticipants(): EventParticipantRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStoredParticipants(list: EventParticipantRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PARTICIPANTS, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function fetchEventParticipants(eventId: string): Promise<EventParticipantRecord[]> {
  try {
    const res = await fetch(`/api/events/participants?event_id=${encodeURIComponent(eventId)}`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // fallback to localStorage
  }
  return getLocalStoredParticipants().filter((p) => p.event_id === eventId);
}

export async function fetchAllEventParticipants(): Promise<EventParticipantRecord[]> {
  try {
    const res = await fetch('/api/events/participants');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // fallback to localStorage
  }
  return getLocalStoredParticipants();
}

export async function registerEventInterest(input: {
  event_id: string;
  event_title?: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  college?: string | null;
  branch?: string | null;
  roll_number?: string | null;
}): Promise<EventParticipantRecord> {
  const payload = {
    event_id: input.event_id,
    event_title: input.event_title || 'AICONEKT Event',
    name: input.full_name,
    email: input.email.toLowerCase(),
    phone: input.phone || null,
    college: input.college || null,
    branch: input.branch || null,
    roll_number: input.roll_number || null,
  };

  try {
    const res = await fetch('/api/events/participate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const json = await res.json();
      return json.participant as EventParticipantRecord;
    }

    // If server responded with a deliberate JSON error (e.g. 400 validation or duplicate check)
    if (contentType.includes('application/json')) {
      const errJson = await res.json().catch(() => ({}));
      if (res.status === 400 && errJson.error?.includes('already registered')) {
        throw new AppServiceError(errJson.error, 'duplicate');
      }
      if (errJson.error) {
        throw new AppServiceError(errJson.error, 'database');
      }
    }

    // If response was not JSON (e.g. 404 HTML fallback from Vite dev server / GitHub Pages), fall through to localStorage fallback
  } catch (err: any) {
    if (err instanceof AppServiceError) throw err;
    // Network errors or non-JSON errors proceed to local storage fallback
  }

  // Direct Browser Client Storage (Always works for free without backend / Supabase)
  const list = getLocalStoredParticipants();
  const existing = list.find(
    (p) => p.event_id === input.event_id && p.email?.toLowerCase() === input.email.toLowerCase()
  );
  if (existing) {
    throw new AppServiceError('You have already registered your interest for this event with this email.', 'duplicate');
  }

  const newRecord: EventParticipantRecord = {
    id: 'reg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    event_id: input.event_id,
    event_title: input.event_title || 'AICONEKT Event',
    full_name: input.full_name,
    email: input.email.toLowerCase(),
    phone: input.phone || null,
    college: input.college || null,
    branch: input.branch || null,
    roll_number: input.roll_number || null,
    created_at: new Date().toISOString(),
    status: 'registered',
  };

  list.unshift(newRecord);
  saveLocalStoredParticipants(list);
  return newRecord;
}

export async function adminRemoveParticipant(participationId: string): Promise<void> {
  try {
    await fetch(`/api/events/participants/${encodeURIComponent(participationId)}`, {
      method: 'DELETE',
    });
  } catch {
    // fallback
  }

  const list = getLocalStoredParticipants().filter((p) => p.id !== participationId);
  saveLocalStoredParticipants(list);
}

// ----------------------------------------------------------------------------
// Team Roster & Team Lead Management
// ----------------------------------------------------------------------------

export async function fetchTeamMembers(): Promise<TeamMemberRecord[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('team_members')
    .select('*')
    .order('display_order', { ascending: true })
    .order('full_name', { ascending: true });

  if (error) {
    console.warn('Could not fetch team members from Supabase, using mock fallback:', error.message);
    // Return fallback initial team roster
    return [
      {
        id: 'tm-1',
        user_id: null,
        full_name: 'KOLLOJU RAVI CHARAN',
        email: 'ravicharan@aiconekt.org',
        role_title: 'Founder & Chief Executive Officer',
        department: 'Executive Council',
        is_lead: true,
        lead_id: null,
        bio: 'Leading strategic vision, organizational architecture, and cross-disciplinary innovation at AICONEKT TECHNOLOGIES.',
        avatar_url: null,
        github_url: 'https://github.com/Aiconekttechnologies',
        linkedin_url: 'https://linkedin.com/company/aiconekt',
        portfolio_url: null,
        is_active: true,
        display_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tm-2',
        user_id: null,
        full_name: 'VOORE YASHWANTH',
        email: 'yashwanth@aiconekt.org',
        role_title: 'Co-Founder & Chief Manager',
        department: 'Software & Web Development',
        is_lead: true,
        lead_id: null,
        bio: 'Directing engineering operations, full-stack systems infrastructure, and technical initiatives.',
        avatar_url: null,
        github_url: 'https://github.com/Aiconekttechnologies',
        linkedin_url: 'https://linkedin.com/company/aiconekt',
        portfolio_url: null,
        is_active: true,
        display_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }
  return (data || []) as TeamMemberRecord[];
}

export async function createTeamMember(input: {
  full_name: string;
  email: string;
  role_title: string;
  department: string;
  is_lead: boolean;
  lead_id?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
}): Promise<TeamMemberRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('team_members')
    .insert({
      full_name: input.full_name.trim(),
      email: input.email.trim().toLowerCase(),
      role_title: input.role_title.trim(),
      department: input.department.trim(),
      is_lead: input.is_lead,
      lead_id: input.lead_id || null,
      bio: input.bio?.trim() || null,
      avatar_url: input.avatar_url?.trim() || null,
      github_url: input.github_url?.trim() || null,
      linkedin_url: input.linkedin_url?.trim() || null,
      portfolio_url: input.portfolio_url?.trim() || null,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to create team member.');
  }
  return data as TeamMemberRecord;
}

export async function updateTeamMember(
  id: string,
  updates: Partial<Omit<TeamMemberRecord, 'id' | 'created_at' | 'updated_at'>>
): Promise<TeamMemberRecord> {
  const client = requireClient();
  const { data, error } = await client
    .from('team_members')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw translateSupabaseError(error, 'Failed to update team member.');
  }
  return data as TeamMemberRecord;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('team_members')
    .delete()
    .eq('id', id);

  if (error) {
    throw translateSupabaseError(error, 'Failed to delete team member.');
  }
}

