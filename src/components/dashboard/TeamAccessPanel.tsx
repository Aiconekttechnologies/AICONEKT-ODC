import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ALL_PERMISSIONS,
  AccessStatus,
  DashboardRole,
  DelegatableRole,
  PermissionKey,
  ROLE_ALLOWED_PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_RECOMMENDED_DEFAULTS,
  sanitizePermissionsForRole,
} from '../../types/rbac';
import {
  AdminUserRecord,
  CreateCeoInvitationResponse,
  TeamInvitationRecord,
  createCeoTeamInvitation,
  fetchTeamDirectory,
  revokeCeoTeamInvitation,
  updateCeoTeamMemberAccess,
} from '../../services/supabaseService';
import {
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Ban,
  Settings2,
  RefreshCw,
  Mail,
  Clock,
  Copy,
  Check,
  X,
} from 'lucide-react';

interface TeamAccessPanelProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

function buildTeammateSignupUrl(email: string, fullName?: string | null): string {
  if (typeof window === 'undefined') return '/login';
  const params = new URLSearchParams({ invite: email });
  if (fullName?.trim()) {
    params.set('name', fullName.trim());
  }
  return `${window.location.origin}/login?${params.toString()}`;
}

export const TeamAccessPanel: React.FC<TeamAccessPanelProps> = ({ onNotify }) => {
  const { isCeo } = useAuth();

  const [members, setMembers] = useState<AdminUserRecord[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Invite Form State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<DelegatableRole>('project_editor');
  const [invitePermissions, setInvitePermissions] = useState<PermissionKey[]>([
    ...ROLE_RECOMMENDED_DEFAULTS.project_editor,
  ]);
  const [requireManualApproval, setRequireManualApproval] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteFormError, setInviteFormError] = useState<string | null>(null);
  const [savedInviteSummary, setSavedInviteSummary] =
    useState<CreateCeoInvitationResponse | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Edit / Approve Member Modal State
  const [editingMember, setEditingMember] = useState<AdminUserRecord | null>(null);
  const [editRole, setEditRole] = useState<Exclude<DashboardRole, 'owner'>>('viewer');
  const [editStatus, setEditStatus] = useState<AccessStatus>('active');
  const [editPermissions, setEditPermissions] = useState<PermissionKey[]>([]);
  const [savingMember, setSavingMember] = useState(false);

  // Confirmation Dialog for Immediate Revocation
  const [revokeTarget, setRevokeTarget] = useState<AdminUserRecord | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadDirectory = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      setLoadError(null);
      const data = await fetchTeamDirectory();
      setMembers(data.members);
      setInvitations(data.invitations);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load Team Access directory.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isCeo) {
      setLoading(false);
      return;
    }
    void loadDirectory(true);
  }, [isCeo, loadDirectory]);

  if (!isCeo) {
    return (
      <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2">
        <AlertCircle className="w-7 h-7 text-rose-400 mx-auto" />
        <h3 className="font-display font-bold text-lg text-white">CEO Access Required</h3>
        <p className="text-xs font-mono text-rose-200">
          Only the verified CEO / Owner account can view or manage team invitations and roles.
        </p>
      </div>
    );
  }

  const handleCopySignupLink = async (key: string, email: string, fullName?: string | null) => {
    const url = buildTeammateSignupUrl(email, fullName);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(key);
      window.setTimeout(() => {
        setCopiedLinkId((prev) => (prev === key ? null : prev));
      }, 2500);
    } catch {
      onNotify('error', `Unable to copy automatically. Share this URL: ${url}`);
    }
  };

  const handleSelectInviteRole = (nextRole: DelegatableRole) => {
    setInviteRole(nextRole);
    setInvitePermissions([...ROLE_RECOMMENDED_DEFAULTS[nextRole]]);
    setInviteFormError(null);
  };

  const toggleInvitePermission = (perm: PermissionKey) => {
    setInviteFormError(null);
    setInvitePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviting) return;

    setInviteFormError(null);
    setSavedInviteSummary(null);
    setInviting(true);

    try {
      const result = await createCeoTeamInvitation({
        email: inviteEmail,
        full_name: inviteName,
        role: inviteRole,
        permissions: invitePermissions,
        require_manual_approval: requireManualApproval,
      });

      // Only show success after verifying a persisted invitation ID was returned from public.team_invitations
      if (!result?.invitation?.id) {
        throw new Error(
          'Invitation could not be verified in public.team_invitations.'
        );
      }

      setInviteEmail('');
      setInviteName('');
      setRequireManualApproval(false);
      setIsInviteOpen(false);
      setSavedInviteSummary(result);

      const successMessage = result.memberActivatedImmediately
        ? `Invitation saved to team_invitations and ${ROLE_LABELS[result.invitation.role]} permissions activated immediately for ${result.invitation.email}.`
        : result.authEmailDispatched
        ? `Invitation saved to team_invitations and Supabase setup email sent to ${result.invitation.email}.`
        : `Invitation saved to team_invitations for ${result.invitation.email} (${ROLE_LABELS[result.invitation.role]}).`;

      onNotify('success', successMessage);
      await loadDirectory(false);
    } catch (err: unknown) {
      const realError =
        err instanceof Error ? err.message : 'Failed to save teammate invitation.';
      setInviteFormError(realError);
      onNotify('error', realError);
    } finally {
      setInviting(false);
    }
  };

  const openMemberAccessEditor = (member: AdminUserRecord, approvingPending = false) => {
    setEditingMember(member);
    const initialRole: DelegatableRole =
      member.role === 'owner'
        ? 'admin'
        : member.role === 'none'
        ? 'viewer'
        : member.role;

    setEditRole(initialRole);
    setEditStatus(
      approvingPending
        ? 'active'
        : member.access_status === 'pending'
        ? 'active'
        : member.access_status
    );

    if (member.permissions.length > 0 && member.role !== 'none') {
      setEditPermissions(sanitizePermissionsForRole(initialRole, member.permissions));
    } else {
      setEditPermissions([...ROLE_RECOMMENDED_DEFAULTS[initialRole]]);
    }
  };

  const handleChangeEditRole = (nextRole: Exclude<DashboardRole, 'owner'>) => {
    setEditRole(nextRole);
    if (nextRole === 'none') {
      setEditPermissions([]);
      setEditStatus('revoked');
      return;
    }
    setEditPermissions((prev) => {
      const sanitized = sanitizePermissionsForRole(nextRole, prev);
      return sanitized.length > 0 ? sanitized : [...ROLE_RECOMMENDED_DEFAULTS[nextRole]];
    });
  };

  const toggleEditPermission = (perm: PermissionKey) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveMemberChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || savingMember) return;
    setSavingMember(true);

    try {
      await updateCeoTeamMemberAccess(editingMember.user_id, {
        role: editRole,
        access_status: editStatus,
        permissions: editPermissions,
      });
      onNotify(
        'success',
        `Updated role (${ROLE_LABELS[editRole]}) and permissions for ${editingMember.email}.`
      );
      setEditingMember(null);
      await loadDirectory(false);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to update member access.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleQuickSuspendOrReactivate = async (member: AdminUserRecord) => {
    if (member.role === 'owner') return;
    const nextStatus: AccessStatus =
      member.access_status === 'active' ? 'suspended' : 'active';
    const nextRole: Exclude<DashboardRole, 'owner'> =
      member.role === 'none' ? 'viewer' : member.role;
    const nextPerms =
      member.permissions.length > 0
        ? member.permissions
        : [...ROLE_RECOMMENDED_DEFAULTS[nextRole]];

    try {
      await updateCeoTeamMemberAccess(member.user_id, {
        role: nextRole,
        access_status: nextStatus,
        permissions: nextPerms,
      });
      onNotify(
        'success',
        nextStatus === 'suspended'
          ? `Suspended dashboard access for ${member.email}.`
          : `Reactivated dashboard access for ${member.email}.`
      );
      await loadDirectory(false);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to update access status.');
    }
  };

  const confirmImmediateRevoke = async () => {
    if (!revokeTarget || revoking) return;
    setRevoking(true);

    try {
      await updateCeoTeamMemberAccess(revokeTarget.user_id, {
        role: 'none',
        access_status: 'revoked',
        permissions: [],
      });
      onNotify(
        'success',
        `Immediately revoked all dashboard access and database permissions for ${revokeTarget.email}.`
      );
      setRevokeTarget(null);
      await loadDirectory(false);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to revoke access.');
    } finally {
      setRevoking(false);
    }
  };

  const handleCancelInvitation = async (inv: TeamInvitationRecord) => {
    try {
      await revokeCeoTeamInvitation(inv.id);
      if (savedInviteSummary?.invitation.id === inv.id) {
        setSavedInviteSummary(null);
      }
      onNotify('success', `Revoked pending invitation for ${inv.email}.`);
      await loadDirectory(false);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to revoke invitation.');
    }
  };

  const pendingRegistrations = members.filter(
    (m) => m.role !== 'owner' && m.access_status === 'pending'
  );
  const pendingInvitations = invitations.filter((i) => i.status === 'pending');
  const activeMembersCount = members.filter(
    (m) => m.access_status === 'active' && m.role !== 'none'
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">
            Team Access Management (CEO Control)
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Invite teammates, approve registered accounts, delegate least-privilege permissions, or revoke access immediately.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadDirectory(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInviteFormError(null);
              setIsInviteOpen((prev) => !prev);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Teammate</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-xs font-mono text-slate-400">Active Authorized Users</div>
          <div className="font-display font-bold text-2xl text-white mt-1 tabular-nums">
            {activeMembersCount}
          </div>
        </div>
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-xs font-mono text-slate-400">Pending User Approvals</div>
          <div className="font-display font-bold text-2xl text-amber-300 mt-1 tabular-nums">
            {pendingRegistrations.length}
          </div>
        </div>
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-xs font-mono text-slate-400">Pending Invitations</div>
          <div className="font-display font-bold text-2xl text-cyan-300 mt-1 tabular-nums">
            {pendingInvitations.length}
          </div>
        </div>
      </div>

      {/* Verified Saved Invitation Confirmation Banner */}
      {savedInviteSummary && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs font-mono text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-white">
                  Invitation Saved for {savedInviteSummary.invitation.email} (
                  {ROLE_LABELS[savedInviteSummary.invitation.role]})
                </div>
                <p className="text-emerald-200/90 leading-relaxed">
                  {savedInviteSummary.memberActivatedImmediately
                    ? 'This email already has a registered account—their assigned role and permissions are now active immediately.'
                    : savedInviteSummary.authEmailDispatched
                    ? 'Invitation recorded in public.team_invitations and a Supabase setup email has been sent.'
                    : 'Invitation recorded in public.team_invitations. Share the signup link below with your teammate—once they register and confirm their email at /login, these permissions activate automatically.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSavedInviteSummary(null)}
              className="text-slate-400 hover:text-white"
              aria-label="Dismiss invitation confirmation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!savedInviteSummary.memberActivatedImmediately &&
            !savedInviteSummary.authEmailDispatched && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono">
                <span className="text-cyan-300 truncate">
                  {buildTeammateSignupUrl(
                    savedInviteSummary.invitation.email,
                    savedInviteSummary.invitation.full_name
                  )}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopySignupLink(
                      `summary-${savedInviteSummary.invitation.id}`,
                      savedInviteSummary.invitation.email,
                      savedInviteSummary.invitation.full_name
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 font-semibold shrink-0"
                >
                  {copiedLinkId === `summary-${savedInviteSummary.invitation.id}` ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Signup Link</span>
                    </>
                  )}
                </button>
              </div>
            )}
        </div>
      )}

      {/* Invite Teammate Drawer */}
      {isInviteOpen && (
        <form
          onSubmit={handleCreateInvitation}
          className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-display font-bold text-lg text-white">
                Invite Teammate or Student
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Assign a restricted role and select only the exact permissions this teammate needs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setInviteFormError(null);
                setIsInviteOpen(false);
              }}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {inviteFormError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs font-mono text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{inviteFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Teammate Email *
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  if (inviteFormError) setInviteFormError(null);
                }}
                placeholder="teammate@campus.edu"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Restricted Role *
              </label>
              <select
                value={inviteRole}
                onChange={(e) => handleSelectInviteRole(e.target.value as DelegatableRole)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="project_editor">Project Editor</option>
                <option value="event_manager">Event Manager</option>
                <option value="viewer">Viewer (Read-Only)</option>
                <option value="admin">Admin / Manager (Delegated)</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {ROLE_DESCRIPTIONS[inviteRole]}
          </div>

          {/* Granular Permission Checkboxes */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-slate-300 font-semibold">
              Explicitly Delegated Permissions ({invitePermissions.length} selected)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ALL_PERMISSIONS.filter((p) =>
                ROLE_ALLOWED_PERMISSIONS[inviteRole].includes(p.key)
              ).map((perm) => {
                const checked = invitePermissions.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleInvitePermission(perm.key)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500"
                    />
                    <div className="text-xs">
                      <div className="font-mono font-semibold">{perm.label}</div>
                      <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                        {perm.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={requireManualApproval}
              onChange={(e) => setRequireManualApproval(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-cyan-500"
            />
            <span>Require final manual CEO approval even after teammate verifies email</span>
          </label>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setInviteFormError(null);
                setIsInviteOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider disabled:opacity-50"
            >
              {inviting ? 'Saving Invitation...' : 'Authorize & Invite'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-slate-400">
          Loading team directory and authorization records...
        </div>
      ) : loadError ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-400 mx-auto" />
          <p className="text-xs font-mono text-rose-200">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadDirectory(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <>
          {/* Pending Registered Users Queue */}
          {pendingRegistrations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display font-bold text-lg text-amber-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Registered Accounts Pending CEO Approval ({pendingRegistrations.length})</span>
              </h3>
              <div className="space-y-2.5">
                {pendingRegistrations.map((reg) => (
                  <div
                    key={reg.user_id}
                    className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="font-display font-bold text-white text-base">
                        {reg.full_name || 'Unnamed Registrant'}{' '}
                        <span className="font-mono text-xs text-cyan-300">
                          &lt;{reg.email}&gt;
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        Registered: {formatDateLabel(reg.registered_at)} · Current Role:{' '}
                        <span className="text-amber-300">No Dashboard Access</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openMemberAccessEditor(reg, true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-mono font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Assign Role</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRevokeTarget(reg)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-rose-950/50 border border-slate-800 text-rose-400 text-xs font-mono"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Deny Access</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span>Pending Invitations ({pendingInvitations.length})</span>
              </h3>
              <div className="space-y-2.5">
                {pendingInvitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="font-mono text-sm text-white font-semibold">
                        {inv.email}{' '}
                        {inv.full_name ? (
                          <span className="text-slate-400 font-normal">({inv.full_name})</span>
                        ) : null}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        Assigned Role:{' '}
                        <span className="text-cyan-300">{ROLE_LABELS[inv.role]}</span> ·{' '}
                        {inv.permissions.length} permission(s) · Expires{' '}
                        {formatDateLabel(inv.expires_at)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopySignupLink(inv.id, inv.email, inv.full_name)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-xs font-mono"
                      >
                        {copiedLinkId === inv.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied Link</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Signup Link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleCancelInvitation(inv)}
                        className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/40 border border-slate-800 text-rose-400 text-xs font-mono"
                      >
                        Revoke Invite
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete Team Access Directory */}
          <div className="space-y-3">
            <h3 className="font-display font-bold text-lg text-white">
              Registered Accounts & Access Directory ({members.length})
            </h3>

            {members.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs font-mono text-slate-400">
                No registered accounts found.
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => {
                  const isOwner = member.role === 'owner';
                  return (
                    <div
                      key={member.user_id}
                      className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                            <span
                              className={
                                isOwner
                                  ? 'text-amber-300 font-bold'
                                  : member.access_status === 'active' && member.role !== 'none'
                                  ? 'text-emerald-400 font-semibold'
                                  : member.access_status === 'suspended'
                                  ? 'text-amber-400'
                                  : member.access_status === 'revoked'
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }
                            >
                              {ROLE_LABELS[member.role]} · {member.access_status.toUpperCase()}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400">
                              Registered {formatDateLabel(member.registered_at)}
                            </span>
                            {member.last_sign_in_at && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="text-slate-500">
                                  Last sign-in {formatDateLabel(member.last_sign_in_at)}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="font-display font-bold text-base text-white">
                            {member.full_name || member.email.split('@')[0]}{' '}
                            <span className="font-mono text-xs text-cyan-300 font-normal">
                              &lt;{member.email}&gt;
                            </span>
                          </div>
                        </div>

                        {isOwner ? (
                          <div className="text-xs font-mono text-amber-300/90">
                            Protected Initial CEO Owner
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openMemberAccessEditor(member)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-xs font-mono"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                              <span>Role & Permissions</span>
                            </button>

                            {member.role !== 'none' && (
                              <button
                                type="button"
                                onClick={() => void handleQuickSuspendOrReactivate(member)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-300 text-xs font-mono"
                              >
                                {member.access_status === 'active' ? (
                                  <>
                                    <PauseCircle className="w-3.5 h-3.5" />
                                    <span>Suspend</span>
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    <span>Reactivate</span>
                                  </>
                                )}
                              </button>
                            )}

                            {(member.role !== 'none' || member.access_status !== 'revoked') && (
                              <button
                                type="button"
                                onClick={() => setRevokeTarget(member)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-rose-400 text-xs font-mono"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Revoke</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Granted Permissions Summary */}
                      <div className="pt-2 border-t border-slate-800/70 text-xs font-mono text-slate-400">
                        {isOwner ? (
                          <span className="text-emerald-400">
                            Full Owner Authority (All content, inbox, roster, and team access permissions)
                          </span>
                        ) : member.permissions.length === 0 || member.role === 'none' ? (
                          <span className="text-slate-500">Zero dashboard permissions granted</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {member.permissions.map((perm) => (
                              <span
                                key={perm}
                                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Role & Granular Permissions Editor Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <form
            onSubmit={handleSaveMemberChanges}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-display font-bold text-xl text-white">
                  Configure Access for {editingMember.full_name || editingMember.email}
                </h3>
                <p className="text-xs font-mono text-cyan-300 mt-0.5">{editingMember.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Assigned Role *
                </label>
                <select
                  value={editRole}
                  onChange={(e) =>
                    handleChangeEditRole(e.target.value as Exclude<DashboardRole, 'owner'>)
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="admin">Admin / Manager (Delegated)</option>
                  <option value="project_editor">Project Editor</option>
                  <option value="event_manager">Event Manager</option>
                  <option value="viewer">Viewer (Read-Only)</option>
                  <option value="none">No Dashboard Access</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Access Status *
                </label>
                <select
                  value={editStatus}
                  disabled={editRole === 'none'}
                  onChange={(e) => setEditStatus(e.target.value as AccessStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending Approval</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </div>

            <div className="text-xs font-mono text-slate-400">
              {ROLE_DESCRIPTIONS[editRole]}
            </div>

            {editRole !== 'none' && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-slate-300 font-semibold">
                  Granted Permissions ({editPermissions.length} selected)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_PERMISSIONS.filter((p) =>
                    ROLE_ALLOWED_PERMISSIONS[editRole].includes(p.key)
                  ).map((perm) => {
                    const checked = editPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEditPermission(perm.key)}
                          className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500"
                        />
                        <div className="text-xs">
                          <div className="font-mono font-semibold">{perm.label}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {perm.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                disabled={savingMember}
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingMember}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider disabled:opacity-50"
              >
                {savingMember ? 'Saving...' : 'Save Access Policy'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Immediate Access Revocation Confirmation Modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="space-y-2">
              <h4 className="font-display font-bold text-xl text-white">
                Revoke Dashboard Access Immediately
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Revoke all dashboard roles and permissions for{' '}
                <strong className="text-white font-mono">{revokeTarget.email}</strong>? PostgreSQL
                Row-Level Security will immediately block all subsequent dashboard reads and mutations
                from this account.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={revoking}
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={() => void confirmImmediateRevoke()}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs font-mono disabled:opacity-50"
              >
                {revoking ? 'Revoking...' : 'Revoke Access Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
