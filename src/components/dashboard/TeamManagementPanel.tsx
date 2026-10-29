import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TeamMemberRecord,
  fetchTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from '../../services/supabaseService';
import {
  Users,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Crown,
  CheckCircle2,
  AlertCircle,
  Globe,
  Search,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  UserCheck,
  UserMinus,
  LayoutGrid,
  UserCog,
  Info,
  FolderPlus,
} from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../common/SocialIcons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepartmentEntry {
  name: string;
  description: string;
}

// ─── Default Departments (seed) ───────────────────────────────────────────────

const DEFAULT_DEPARTMENTS: DepartmentEntry[] = [
  {
    name: 'AI & Machine Learning',
    description: 'Multimodal neural architectures, quantized edge models, and computer vision pipelines.',
  },
  {
    name: 'Software & Web Development',
    description: 'High-throughput full-stack platforms, distributed services, and low-latency state machines.',
  },
  {
    name: 'Cloud & Database Engineering',
    description: 'Fault-tolerant distributed storage, Kubernetes orchestration, and telemetry pipelines.',
  },
  {
    name: 'UI/UX & 3D Interactive',
    description: 'Spatial WebGL engineering, Three.js 3D shaders, and systematic visual brand design.',
  },
  {
    name: 'Security & Systems R&D',
    description: 'Vulnerability research, penetration testing, embedded systems hardening.',
  },
  {
    name: 'Executive Council',
    description: 'Founding directors, strategic planning, and cross-department coordination.',
  },
];

const LS_KEY = 'aiconekt_departments_v1';

function loadDepartments(): DepartmentEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DepartmentEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_DEPARTMENTS;
}

function saveDepartments(depts: DepartmentEntry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(depts));
  } catch {
    // ignore storage errors
  }
}

type SubView =
  | 'overview'
  | 'assign-lead'
  | 'assign-teammates'
  | 'edit-member'
  | 'add-member'
  | 'department-detail'
  | 'create-department';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyForm(firstDept = 'Software & Web Development', isLead = false) {
  return {
    full_name: '',
    email: '',
    role_title: isLead ? 'Department Lead' : 'Engineering Member',
    department: firstDept,
    is_lead: isLead,
    lead_id: '',
    bio: '',
    avatar_url: '',
    github_url: '',
    linkedin_url: '',
    portfolio_url: '',
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const TeamManagementPanel: React.FC = () => {
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dynamic departments state (persisted to localStorage)
  const [departments, setDepartments] = useState<DepartmentEntry[]>(loadDepartments);

  const deptNames = useMemo(() => departments.map((d) => d.name), [departments]);

  // Navigation state
  const [view, setView] = useState<SubView>('overview');
  const [selectedDeptName, setSelectedDeptName] = useState<string>('');
  const [editingMember, setEditingMember] = useState<TeamMemberRecord | null>(null);

  // Assign-lead flow
  const [assignLeadDept, setAssignLeadDept] = useState<string>('');
  const [assignLeadSearch, setAssignLeadSearch] = useState('');
  const [assignLeadConfirm, setAssignLeadConfirm] = useState<TeamMemberRecord | null>(null);
  const [assignLeadBusy, setAssignLeadBusy] = useState(false);

  // Assign-teammates flow
  const [assignTeamDept, setAssignTeamDept] = useState<string>('');
  const [assignTeamSearch, setAssignTeamSearch] = useState('');
  const [assignTeamBusy, setAssignTeamBusy] = useState<string | null>(null);

  // Member form (add / edit)
  const [formData, setFormData] = useState(() => emptyForm(loadDepartments()[0]?.name ?? 'Software & Web Development'));
  const [formBusy, setFormBusy] = useState(false);

  // Create-department form
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [deptFormError, setDeptFormError] = useState('');

  // ─── Data ───────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTeamMembers();
      setMembers(data);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load team roster.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Derived Data ────────────────────────────────────────────────────────────

  const activeMembers = useMemo(() => members.filter((m) => m.is_active), [members]);
  const leads = useMemo(() => activeMembers.filter((m) => m.is_lead), [activeMembers]);

  function deptLead(deptName: string): TeamMemberRecord | undefined {
    return leads.find((l) => l.department === deptName);
  }
  function deptMembers(deptName: string): TeamMemberRecord[] {
    return activeMembers.filter((m) => m.department === deptName && !m.is_lead);
  }
  function membersUnderLead(leadId: string): TeamMemberRecord[] {
    return activeMembers.filter((m) => m.lead_id === leadId);
  }

  // ─── Handlers: Assign Lead ───────────────────────────────────────────────────

  const handleConfirmAssignLead = async () => {
    if (!assignLeadConfirm || !assignLeadDept) return;
    setAssignLeadBusy(true);
    try {
      const oldLead = deptLead(assignLeadDept);
      if (oldLead && oldLead.id !== assignLeadConfirm.id) {
        await updateTeamMember(oldLead.id, {
          is_lead: false,
          role_title: 'Engineering Member',
          lead_id: null,
        });
      }
      await updateTeamMember(assignLeadConfirm.id, {
        is_lead: true,
        department: assignLeadDept,
        role_title: `${assignLeadDept} Lead`,
        lead_id: null,
      });
      showToast('success', `${assignLeadConfirm.full_name} appointed as ${assignLeadDept} Lead.`);
      setAssignLeadConfirm(null);
      setView('overview');
      await loadData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to appoint lead.');
    } finally {
      setAssignLeadBusy(false);
    }
  };

  const handleRevokeLead = async (lead: TeamMemberRecord) => {
    if (!window.confirm(`Revoke ${lead.full_name}'s lead designation for ${lead.department}? Their profile stays active as a member.`)) return;
    try {
      await updateTeamMember(lead.id, {
        is_lead: false,
        role_title: 'Engineering Member',
      });
      showToast('success', `Revoked ${lead.full_name}'s lead role.`);
      await loadData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to revoke lead.');
    }
  };

  // ─── Handlers: Assign Teammates ───────────────────────────────────────────────

  const handleAssignToDept = async (member: TeamMemberRecord, targetDept: string) => {
    setAssignTeamBusy(member.id);
    const lead = deptLead(targetDept);
    try {
      await updateTeamMember(member.id, {
        department: targetDept,
        lead_id: lead ? lead.id : null,
      });
      showToast('success', `${member.full_name} assigned to ${targetDept}.`);
      await loadData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Assignment failed.');
    } finally {
      setAssignTeamBusy(null);
    }
  };

  const handleRemoveFromDept = async (member: TeamMemberRecord) => {
    if (!window.confirm(`Remove ${member.full_name} from ${member.department}? Their account remains active.`)) return;
    try {
      await updateTeamMember(member.id, { department: '', lead_id: null });
      showToast('success', `Removed ${member.full_name} from ${member.department}.`);
      await loadData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Removal failed.');
    }
  };

  // ─── Handlers: Add / Edit Member ─────────────────────────────────────────────

  const openAddMember = () => {
    setEditingMember(null);
    setFormData(emptyForm());
    setView('add-member');
  };

  const openEditMember = (m: TeamMemberRecord) => {
    setEditingMember(m);
    setFormData({
      full_name: m.full_name,
      email: m.email,
      role_title: m.role_title,
      department: m.department,
      is_lead: m.is_lead,
      lead_id: m.lead_id || '',
      bio: m.bio || '',
      avatar_url: m.avatar_url || '',
      github_url: m.github_url || '',
      linkedin_url: m.linkedin_url || '',
      portfolio_url: m.portfolio_url || '',
    });
    setView('edit-member');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.email.trim()) {
      showToast('error', 'Full name and email are required.');
      return;
    }
    setFormBusy(true);
    try {
      if (editingMember) {
        await updateTeamMember(editingMember.id, {
          full_name: formData.full_name.trim(),
          email: formData.email.trim().toLowerCase(),
          role_title: formData.role_title.trim(),
          department: formData.department.trim(),
          is_lead: formData.is_lead,
          lead_id: formData.lead_id || null,
          bio: formData.bio.trim() || null,
          avatar_url: formData.avatar_url.trim() || null,
          github_url: formData.github_url.trim() || null,
          linkedin_url: formData.linkedin_url.trim() || null,
          portfolio_url: formData.portfolio_url.trim() || null,
        });
        showToast('success', `Updated profile for ${formData.full_name}.`);
      } else {
        await createTeamMember({
          full_name: formData.full_name.trim(),
          email: formData.email.trim().toLowerCase(),
          role_title: formData.role_title.trim(),
          department: formData.department.trim(),
          is_lead: formData.is_lead,
          lead_id: formData.lead_id || null,
          bio: formData.bio.trim() || null,
          avatar_url: formData.avatar_url.trim() || null,
          github_url: formData.github_url.trim() || null,
          linkedin_url: formData.linkedin_url.trim() || null,
          portfolio_url: formData.portfolio_url.trim() || null,
        });
        showToast('success', `${formData.full_name} added to team roster.`);
      }
      setView('overview');
      await loadData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeleteMember = async (member: TeamMemberRecord) => {
    if (!window.confirm(`Permanently remove ${member.full_name} from the active roster?`)) return;
    try {
      await deleteTeamMember(member.id);
      showToast('success', `Removed ${member.full_name}.`);
      if (view === 'department-detail' || view === 'edit-member') setView('overview');
      await loadData();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  // ─── Handlers: Create & Delete Department ──────────────────────────────────

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newDeptName.trim();
    const trimmedDesc = newDeptDesc.trim();

    if (!trimmedName) {
      setDeptFormError('Department name is required.');
      return;
    }

    if (departments.some((d) => d.name.toLowerCase() === trimmedName.toLowerCase())) {
      setDeptFormError('A department with this name already exists.');
      return;
    }

    const nextDepts = [
      ...departments,
      {
        name: trimmedName,
        description: trimmedDesc || 'Strategic and technical engineering operations.',
      },
    ];

    setDepartments(nextDepts);
    saveDepartments(nextDepts);
    showToast('success', `Department "${trimmedName}" created successfully.`);
    setNewDeptName('');
    setNewDeptDesc('');
    setDeptFormError('');
    setView('overview');
  };

  const handleDeleteDepartment = (deptName: string) => {
    const assignedMembers = activeMembers.filter((m) => m.department === deptName);
    const confirmMessage = assignedMembers.length > 0
      ? `Are you sure you want to delete "${deptName}"? ${assignedMembers.length} active member(s) are currently assigned to it and will have their department cleared.`
      : `Are you sure you want to delete the department "${deptName}"?`;

    if (!window.confirm(confirmMessage)) return;

    // Unassign affected members in Supabase/state
    if (assignedMembers.length > 0) {
      void Promise.all(
        assignedMembers.map((m) =>
          updateTeamMember(m.id, { department: '', is_lead: false, lead_id: null })
        )
      ).then(() => {
        void loadData();
      }).catch((err) => {
        console.warn('Failed to unassign some members:', err);
      });
    }

    const nextDepts = departments.filter((d) => d.name !== deptName);
    setDepartments(nextDepts);
    saveDepartments(nextDepts);
    showToast('success', `Department "${deptName}" deleted.`);

    if (selectedDeptName === deptName) {
      setSelectedDeptName('');
      setView('overview');
    }
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────────

  const Breadcrumb: React.FC<{ label: string }> = ({ label }) => (
    <button
      type="button"
      onClick={() => setView('overview')}
      className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors mb-4"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Team Management</span>
      <ChevronRight className="w-3 h-3 text-slate-600" />
      <span className="text-slate-300">{label}</span>
    </button>
  );

  const ToastBanner = () =>
    toast ? (
      <div
        className={`p-4 rounded-xl border text-xs font-mono flex items-center gap-2 mb-4 ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}
      >
        {toast.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        ) : (
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
        )}
        <span>{toast.message}</span>
      </div>
    ) : null;

  const SocialLinks: React.FC<{ member: TeamMemberRecord }> = ({ member }) => (
    <div className="flex items-center gap-2">
      {member.github_url && (
        <a href={member.github_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">
          <GithubIcon className="w-3.5 h-3.5" />
        </a>
      )}
      {member.linkedin_url && (
        <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-cyan-400">
          <LinkedinIcon className="w-3.5 h-3.5" />
        </a>
      )}
      {member.portfolio_url && (
        <a href={member.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400">
          <Globe className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );

  // ─── View: Overview ───────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
            <span>CEO AUTHORIZED — TEAM & DEPARTMENT MANAGEMENT</span>
          </div>
          <h2 className="font-display font-bold text-2xl text-white mt-1">Organization Structure</h2>
          <p className="text-slate-400 text-xs mt-1">
            Appoint department leads, assign teammates, and manage member profiles across all departments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadData()}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Refresh roster"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setNewDeptName('');
              setNewDeptDesc('');
              setDeptFormError('');
              setView('create-department');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs uppercase tracking-wider hover:border-cyan-500 hover:text-cyan-300 transition-all"
          >
            <FolderPlus className="w-4 h-4 text-cyan-400" />
            <span>Create Dept</span>
          </button>
          <button
            type="button"
            onClick={openAddMember}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Members', value: activeMembers.length, icon: <Users className="w-3.5 h-3.5 text-cyan-400" /> },
          { label: 'Appointed Leads', value: leads.length, icon: <Crown className="w-3.5 h-3.5 text-amber-400" /> },
          { label: 'Departments', value: departments.length, icon: <LayoutGrid className="w-3.5 h-3.5 text-violet-400" /> },
          { label: 'Allocated', value: activeMembers.filter((m) => m.lead_id).length, icon: <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
            <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">{icon} {label}</div>
            <div className="font-display font-bold text-3xl text-white mt-2 tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => { setAssignLeadDept(''); setAssignLeadSearch(''); setAssignLeadConfirm(null); setView('assign-lead'); }}
          className="flex items-center gap-3 p-5 rounded-2xl bg-slate-900 border border-amber-500/30 hover:border-amber-400/60 text-left transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm group-hover:text-amber-300 transition-colors">Assign Department Lead</div>
            <div className="text-xs text-slate-400 mt-0.5">Appoint or change a lead</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => { setAssignTeamDept(''); setAssignTeamSearch(''); setView('assign-teammates'); }}
          className="flex items-center gap-3 p-5 rounded-2xl bg-slate-900 border border-cyan-500/30 hover:border-cyan-400/60 text-left transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm group-hover:text-cyan-300 transition-colors">Assign Teammates</div>
            <div className="text-xs text-slate-400 mt-0.5">Move members to depts</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setNewDeptName('');
            setNewDeptDesc('');
            setDeptFormError('');
            setView('create-department');
          }}
          className="flex items-center gap-3 p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 hover:border-emerald-400/60 text-left transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <FolderPlus className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm group-hover:text-emerald-300 transition-colors">Create Department</div>
            <div className="text-xs text-slate-400 mt-0.5">Add a new technical division</div>
          </div>
        </button>
        <button
          type="button"
          onClick={openAddMember}
          className="flex items-center gap-3 p-5 rounded-2xl bg-slate-900 border border-violet-500/30 hover:border-violet-400/60 text-left transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm group-hover:text-violet-300 transition-colors">Add Team Member</div>
            <div className="text-xs text-slate-400 mt-0.5">Register a new profile</div>
          </div>
        </button>
      </div>

      {/* Department Grid */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-widest mb-4">
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>DEPARTMENT OVERVIEW</span>
          <span className="ml-2 text-[10px] text-slate-500">— click any card to manage</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {departments.map((dept) => {
            const lead = deptLead(dept.name);
            const teammates = deptMembers(dept.name);
            const totalInDept = lead ? teammates.length + 1 : teammates.length;
            return (
              <div
                key={dept.name}
                className="bg-slate-950/70 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-5 flex flex-col gap-4 transition-all cursor-pointer group relative"
                onClick={() => { setSelectedDeptName(dept.name); setView('department-detail'); }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-display font-bold text-sm text-white group-hover:text-cyan-300 transition-colors leading-tight">{dept.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{dept.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 tabular-nums whitespace-nowrap">
                      {totalInDept} {totalInDept === 1 ? 'member' : 'members'}
                    </span>
                    <button
                      type="button"
                      title={`Delete ${dept.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDepartment(dept.name);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Department Lead</div>
                  {lead ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                          <Crown className="w-3 h-3" /> {lead.full_name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{lead.role_title}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleRevokeLead(lead); }}
                        className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-mono border border-rose-500/30 transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 italic">Lead not assigned</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignLeadDept(dept.name);
                          setAssignLeadSearch('');
                          setAssignLeadConfirm(null);
                          setView('assign-lead');
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30 transition-colors"
                      >
                        Assign Lead
                      </button>
                    </div>
                  )}
                </div>

                {teammates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {teammates.slice(0, 4).map((m) => (
                      <span key={m.id} className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                        {m.full_name.split(' ')[0]}
                      </span>
                    ))}
                    {teammates.length > 4 && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-400">
                        +{teammates.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── View: Department Detail ──────────────────────────────────────────────────

  const renderDeptDetail = () => {
    const dept = departments.find((d) => d.name === selectedDeptName);
    if (!dept) return null;
    const lead = deptLead(dept.name);
    const teammates = deptMembers(dept.name);
    const underLead = lead ? membersUnderLead(lead.id) : [];

    return (
      <div className="space-y-6">
        <Breadcrumb label={dept.name} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-2xl text-white">{dept.name}</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-xl">{dept.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setAssignLeadDept(dept.name); setAssignLeadSearch(''); setAssignLeadConfirm(null); setView('assign-lead'); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono hover:bg-amber-500/20 transition-all"
            >
              <Crown className="w-3.5 h-3.5" /> {lead ? 'Change Lead' : 'Assign Lead'}
            </button>
            <button
              type="button"
              onClick={() => { setAssignTeamDept(dept.name); setAssignTeamSearch(''); setView('assign-teammates'); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 text-xs font-mono hover:bg-cyan-500/20 transition-all"
            >
              <UserCheck className="w-3.5 h-3.5" /> Assign Teammates
            </button>
            <button
              type="button"
              onClick={() => handleDeleteDepartment(dept.name)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-mono hover:bg-rose-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Dept
            </button>
          </div>
        </div>

        {/* Lead Card */}
        <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5">
          <div className="text-[10px] font-mono text-amber-400 uppercase mb-3 flex items-center gap-1.5">
            <Crown className="w-3 h-3" /> Department Lead
          </div>
          {lead ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-bold text-lg text-white">{lead.full_name}</div>
                <div className="text-xs font-mono text-amber-300/90">{lead.role_title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{lead.email}</div>
                {lead.bio && <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">{lead.bio}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SocialLinks member={lead} />
                <button type="button" onClick={() => openEditMember(lead)} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => void handleRevokeLead(lead)} className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono hover:bg-rose-500/20">
                  Revoke Lead
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm italic">Lead not assigned for this department.</span>
              <button
                type="button"
                onClick={() => { setAssignLeadDept(dept.name); setView('assign-lead'); }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono"
              >
                <Crown className="w-3.5 h-3.5" /> Assign Now
              </button>
            </div>
          )}
        </div>

        {/* Team Members */}
        <div>
          <div className="text-[10px] font-mono text-slate-400 uppercase mb-3 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Team Members ({teammates.length})
          </div>
          {teammates.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-xl text-slate-500 text-xs font-mono">
              No members assigned to this department yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              {teammates.map((m) => (
                <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white text-sm">{m.full_name}</div>
                    <div className="text-[11px] text-cyan-400/90">{m.role_title}</div>
                    <div className="text-[10px] text-slate-500">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SocialLinks member={m} />
                    <button type="button" onClick={() => openEditMember(m)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => void handleRemoveFromDept(m)} className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20" title="Remove from dept">
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => void handleDeleteMember(m)} className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {lead && underLead.length > 0 && (
          <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs font-mono text-cyan-300 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{underLead.length} member(s) directly linked under {lead.full_name} via lead_id field.</span>
          </div>
        )}
      </div>
    );
  };

  // ─── View: Assign Lead ────────────────────────────────────────────────────────

  const renderAssignLead = () => {
    const filteredCandidates = activeMembers.filter((m) => {
      const q = assignLeadSearch.toLowerCase();
      return (
        !q ||
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        <Breadcrumb label="Assign Department Lead" />
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-1">
            <Crown className="w-4 h-4" /> <span>CEO ACTION — APPOINT DEPARTMENT LEAD</span>
          </div>
          <h3 className="font-display font-bold text-2xl text-white">Assign Department Lead</h3>
          <p className="text-slate-400 text-xs mt-1">
            Select a department, then choose a registered member. Any existing lead is reverted to member status (profile preserved).
          </p>
        </div>

        {/* Step 1: Pick Department */}
        <div className="space-y-3">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Step 1 — Select Department</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {departments.map((dept) => {
              const lead = deptLead(dept.name);
              const isSelected = assignLeadDept === dept.name;
              return (
                <button
                  key={dept.name}
                  type="button"
                  onClick={() => { setAssignLeadDept(dept.name); setAssignLeadConfirm(null); }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-amber-400/60 bg-amber-500/10 ring-1 ring-amber-400/40'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold text-sm text-white">{dept.name}</div>
                  {lead ? (
                    <div className="text-[11px] mt-1 text-amber-300 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" /> {lead.full_name}
                    </div>
                  ) : (
                    <div className="text-[11px] mt-1 text-slate-500 italic">No lead assigned</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Pick Member */}
        {assignLeadDept && !assignLeadConfirm && (
          <div className="space-y-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Step 2 — Select Member to Lead "{assignLeadDept}"
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={assignLeadSearch}
                onChange={(e) => setAssignLeadSearch(e.target.value)}
                placeholder="Search by name, email, or department..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-slate-950/60">
              {filteredCandidates.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs font-mono">No members match the search.</div>
              ) : (
                filteredCandidates.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAssignLeadConfirm(m)}
                    className="w-full text-left p-4 hover:bg-slate-900 transition-colors flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-semibold text-white text-sm flex items-center gap-2">
                        {m.full_name}
                        {m.is_lead && (
                          <span className="text-amber-400 text-[10px] font-mono">[Lead: {m.department}]</span>
                        )}
                      </div>
                      <div className="text-[11px] text-cyan-400/90">{m.role_title} · {m.department}</div>
                      <div className="text-[10px] text-slate-500">{m.email}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {assignLeadConfirm && (
          <div className="bg-amber-500/5 border border-amber-500/40 rounded-2xl p-6 space-y-4">
            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">Step 3 — Confirm Appointment</div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-white">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <strong>{assignLeadConfirm.full_name}</strong>
                <span className="text-slate-400">→ appointed as</span>
                <strong className="text-amber-300">{assignLeadDept} Lead</strong>
              </div>
              {deptLead(assignLeadDept) && deptLead(assignLeadDept)!.id !== assignLeadConfirm.id && (
                <div className="text-xs text-slate-400 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Existing lead <strong className="text-white">{deptLead(assignLeadDept)!.full_name}</strong> will be reverted to Engineering Member. Profile remains active.
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAssignLeadConfirm(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={assignLeadBusy}
                onClick={() => void handleConfirmAssignLead()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 disabled:opacity-50"
              >
                {assignLeadBusy ? 'Appointing...' : 'Confirm Appointment'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── View: Assign Teammates ───────────────────────────────────────────────────

  const renderAssignTeammates = () => {
    const candidates = activeMembers.filter((m) => {
      const q = assignTeamSearch.toLowerCase();
      return !q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });

    return (
      <div className="space-y-6">
        <Breadcrumb label="Assign Teammates" />
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <UserCheck className="w-4 h-4" /> <span>CEO ACTION — DEPARTMENT ASSIGNMENT</span>
          </div>
          <h3 className="font-display font-bold text-2xl text-white">Assign Teammates to Department</h3>
          <p className="text-slate-400 text-xs mt-1">
            Pick a target department below, then use the Assign / Remove actions to manage members.
          </p>
        </div>

        {/* Department Selector */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Target Department</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {departments.map((dept) => (
              <button
                key={dept.name}
                type="button"
                onClick={() => setAssignTeamDept(dept.name)}
                className={`text-left px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                  assignTeamDept === dept.name
                    ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {dept.name}
              </button>
            ))}
          </div>
        </div>

        {assignTeamDept && (
          <>
            {/* Current members in dept */}
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">
                Current Members in "{assignTeamDept}"
              </div>
              {(() => {
                const current = activeMembers.filter((m) => m.department === assignTeamDept);
                return current.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-4 border border-slate-800 rounded-xl bg-slate-950/40 text-center">
                    No members currently in this department.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                    {current.map((m) => (
                      <div key={m.id} className="p-3.5 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            {m.full_name}
                            {m.is_lead && <span className="text-[10px] text-amber-400 font-mono">[Lead]</span>}
                          </div>
                          <div className="text-[11px] text-slate-400">{m.role_title}</div>
                        </div>
                        {!m.is_lead && (
                          <button
                            type="button"
                            disabled={assignTeamBusy === m.id}
                            onClick={() => void handleRemoveFromDept(m)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            {assignTeamBusy === m.id ? '...' : 'Remove'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Add from search */}
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                Add Members to "{assignTeamDept}"
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assignTeamSearch}
                  onChange={(e) => setAssignTeamSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-slate-950/50">
                {candidates.filter((m) => m.department !== assignTeamDept).length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs font-mono">
                    All members are already in this department, or no results.
                  </div>
                ) : (
                  candidates
                    .filter((m) => m.department !== assignTeamDept)
                    .map((m) => (
                      <div key={m.id} className="p-3.5 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            {m.full_name}
                            {m.is_lead && <span className="text-[10px] text-amber-400 font-mono">[Lead: {m.department}]</span>}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {m.role_title} · Currently: <span className="text-slate-300">{m.department || 'Unassigned'}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={assignTeamBusy === m.id}
                          onClick={() => void handleAssignToDept(m, assignTeamDept)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono hover:bg-cyan-500/20 disabled:opacity-50"
                        >
                          {assignTeamBusy === m.id ? 'Assigning...' : 'Assign'}
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── View: Add / Edit Member Form ─────────────────────────────────────────────

  const renderMemberForm = () => {
    const isEdit = view === 'edit-member';
    const leadsList = activeMembers.filter((m) => m.is_lead);

    return (
      <div className="space-y-6 max-w-2xl">
        <Breadcrumb label={isEdit ? `Edit: ${editingMember?.full_name ?? ''}` : 'Add Team Member'} />
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-violet-400 mb-1">
            <UserCog className="w-4 h-4" /> <span>CEO ACTION — {isEdit ? 'EDIT PROFILE' : 'ADD MEMBER'}</span>
          </div>
          <h3 className="font-display font-bold text-2xl text-white">
            {isEdit ? 'Edit Team Member Profile' : 'Add Team Member'}
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            {isEdit
              ? 'Update credentials, department assignment, leadership status, and profile links.'
              : 'Register a new team member profile and assign them to an existing department.'}
          </p>
        </div>

        <form onSubmit={(e) => void handleFormSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Full Name *</label>
              <input type="text" required value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Email Address *</label>
              <input type="email" required value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="member@aiconekt.org"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Department</label>
              <select value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Designation / Role Title</label>
              <input type="text" required value={formData.role_title}
                onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                placeholder="e.g. Lead Systems Engineer"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-400" /> Designate as Department Lead
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Leads are shown on the Leads page with their supervised department.</div>
            </div>
            <input type="checkbox" checked={formData.is_lead}
              onChange={(e) => setFormData({ ...formData, is_lead: e.target.checked })}
              className="w-5 h-5 accent-cyan-500 rounded"
            />
          </div>

          {!formData.is_lead && (
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Assign Under Team Lead (Optional)</label>
              <select value={formData.lead_id}
                onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">No Direct Lead (Independent)</option>
                {leadsList.map((l) => (
                  <option key={l.id} value={l.id}>{l.full_name} ({l.department})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">Biography</label>
            <textarea rows={3} value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Background, domain expertise, key achievements..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="text-xs font-mono text-cyan-400 uppercase">Profile & Social URLs</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: 'github_url', label: 'GitHub URL', placeholder: 'https://github.com/...' },
                { key: 'linkedin_url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
                { key: 'portfolio_url', label: 'Portfolio URL', placeholder: 'https://...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">{label}</label>
                  <input type="url" value={formData[key as keyof typeof formData] as string}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setView('overview')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs">
              Cancel
            </button>
            {isEdit && editingMember && (
              <button type="button" onClick={() => void handleDeleteMember(editingMember)}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-mono text-xs flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete Member
              </button>
            )}
            <button type="submit" disabled={formBusy}
              className="ml-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider hover:opacity-95 disabled:opacity-50">
              {formBusy ? 'Saving...' : isEdit ? 'Update Profile' : 'Save Member'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // ─── View: Create Department Form ───────────────────────────────────────────

  const renderCreateDepartment = () => {
    return (
      <div className="space-y-6 max-w-xl">
        <Breadcrumb label="Create Department" />
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <FolderPlus className="w-4 h-4" /> <span>CEO ACTION — CREATE DEPARTMENT</span>
          </div>
          <h3 className="font-display font-bold text-2xl text-white">Create New Department</h3>
          <p className="text-slate-400 text-xs mt-1">
            Establish a new technical or strategic division. You can appoint a lead and assign teammates immediately after creating it.
          </p>
        </div>

        {deptFormError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{deptFormError}</span>
          </div>
        )}

        <form onSubmit={handleCreateDepartment} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">Department Name *</label>
            <input
              type="text"
              required
              value={newDeptName}
              onChange={(e) => {
                setNewDeptName(e.target.value);
                setDeptFormError('');
              }}
              placeholder="e.g. Autonomous Robotics & Drone Lab"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">Description & Focus Areas</label>
            <textarea
              rows={3}
              value={newDeptDesc}
              onChange={(e) => setNewDeptDesc(e.target.value)}
              placeholder="Key mission, research directions, tech stack, and deliverable scope..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setView('overview')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ml-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider hover:opacity-95 shadow-md shadow-emerald-500/20"
            >
              Create Department
            </button>
          </div>
        </form>
      </div>
    );
  };

  // ─── Loading ──────────────────────────────────────────────────────────────────

  if (loading && members.length === 0) {
    return (
      <div className="p-16 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
        <span>Fetching team roster from Supabase...</span>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <ToastBanner />
      {view === 'overview' && renderOverview()}
      {view === 'department-detail' && renderDeptDetail()}
      {view === 'assign-lead' && renderAssignLead()}
      {view === 'assign-teammates' && renderAssignTeammates()}
      {view === 'create-department' && renderCreateDepartment()}
      {(view === 'add-member' || view === 'edit-member') && renderMemberForm()}
    </div>
  );
};

export default TeamManagementPanel;
