import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../brand/BrandLogo';
import { ProjectCard } from '../projects/ProjectCard';
import { TeamAccessPanel } from './TeamAccessPanel';
import { TeamManagementPanel } from './TeamManagementPanel';
import {
  AppServiceError,
  CareerApplicationRecord,
  ContactInquiryRecord,
  EventRecord,
  EventStatus,
  EventUpsertInput,
  ProjectRecord,
  ProjectUpsertInput,
  archiveAdminProject,
  createAdminEvent,
  createAdminProject,
  deleteAdminEvent,
  deleteAdminInquiry,
  deleteAdminProject,
  fetchAdminApplications,
  fetchAdminEvents,
  fetchAdminInquiries,
  fetchAdminProjects,
  formatCategoryLabel,
  generateSlug,
  isEventCurrentlyUpcoming,
  setAdminEventPublication,
  setAdminProjectPublication,
  updateAdminApplicationStatus,
  updateAdminEvent,
  updateAdminInquiryStatus,
  updateAdminProject,
  fetchAllEventParticipants,
  adminRemoveParticipant,
  EventParticipantRecord,
} from '../../services/supabaseService';
import {
  LayoutDashboard,
  Users,
  Trophy,
  Inbox,
  FolderGit2,
  CheckCircle2,
  LogOut,
  Mail,
  Trash2,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Archive,
  RefreshCw,
  Calendar,
  MapPin,
  X,
  Globe,
  Lock,
  Crown,
} from 'lucide-react';

interface DashboardProps {
  onLogout: () => void;
}

interface ConfirmDialogState {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'danger' | 'warning';
  onConfirm: () => Promise<void>;
}

interface ProjectFormState {
  id: string | null;
  title: string;
  slug: string;
  slugTouched: boolean;
  tagline: string;
  category: string;
  description: string;
  technologiesText: string;
  image_url: string;
  live_url: string;
  source_url: string;
}

interface EventFormState {
  id: string | null;
  title: string;
  tagline: string;
  category: string;
  description: string;
  event_date: string;
  end_date: string;
  location: string;
  is_virtual: boolean;
  registration_url: string;
  image_url: string;
  prize_pool: string;
  tagsText: string;
  status: EventStatus;
  is_published: boolean;
}

const EMPTY_PROJECT_FORM: ProjectFormState = {
  id: null,
  title: '',
  slug: '',
  slugTouched: false,
  tagline: '',
  category: 'ai-ml',
  description: '',
  technologiesText: '',
  image_url: '',
  live_url: '',
  source_url: '',
};

function defaultEventDateLocal(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function createEmptyEventForm(): EventFormState {
  return {
    id: null,
    title: '',
    tagline: '',
    category: 'Hackathon',
    description: '',
    event_date: defaultEventDateLocal(),
    end_date: '',
    location: '',
    is_virtual: false,
    registration_url: '',
    image_url: '',
    prize_pool: '',
    tagsText: '',
    status: 'upcoming',
    is_published: false,
  };
}

function formatShortTimestamp(iso: string): string {
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

type DashboardTabId =
  | 'overview'
  | 'team-access'
  | 'team-management'
  | 'projects'
  | 'events'
  | 'inbox'
  | 'applications';

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const { user, isCeo, hasPermission } = useAuth();

  // Granular capability evaluation (Owner/CEO holds all; teammates hold only CEO-granted permissions)
  const canViewOverview = isCeo || hasPermission('dashboard.overview.view');
  const canManageTeamAccess = isCeo;

  const canCreateProject = isCeo || hasPermission('projects.create');
  const canEditProject = isCeo || hasPermission('projects.edit');
  const canPublishProject = isCeo || hasPermission('projects.publish');
  const canDeleteProject = isCeo || hasPermission('projects.delete');
  const canAccessProjects =
    isCeo ||
    hasPermission('projects.view') ||
    canCreateProject ||
    canEditProject ||
    canPublishProject ||
    canDeleteProject;

  const canCreateEvent = isCeo || hasPermission('events.create');
  const canEditEvent = isCeo || hasPermission('events.edit');
  const canPublishEvent = isCeo || hasPermission('events.publish');
  const canDeleteEvent = isCeo || hasPermission('events.delete');
  const canAccessEvents =
    isCeo ||
    hasPermission('events.view') ||
    canCreateEvent ||
    canEditEvent ||
    canPublishEvent ||
    canDeleteEvent;

  const canManageInbox = isCeo || hasPermission('inquiries.manage');
  const canAccessInbox = isCeo || hasPermission('inquiries.view') || canManageInbox;

  const canManageApplications = isCeo || hasPermission('applications.manage');
  const canAccessApplications =
    isCeo || hasPermission('applications.view') || canManageApplications;

  const [activeTab, setActiveTab] = useState<DashboardTabId>('overview');

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [inbox, setInbox] = useState<ContactInquiryRecord[]>([]);
  const [applications, setApplications] = useState<CareerApplicationRecord[]>([]);
  const [participants, setParticipants] = useState<EventParticipantRecord[]>([]);
  const [selectedEventForRoster, setSelectedEventForRoster] = useState<EventRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  // Filters
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [eventStatusFilter, setEventStatusFilter] = useState<'all' | 'published' | 'draft' | 'past'>('all');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactInquiryRecord | null>(null);

  // Project Editor Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);

  // Event Editor Modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<EventFormState>(createEmptyEventForm);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showBanner = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    if (type === 'success') {
      window.setTimeout(() => {
        setFeedback((prev) => (prev?.message === message ? null : prev));
      }, 4500);
    }
  };

  const handleActionError = (err: unknown, fallbackMessage: string) => {
    if (err instanceof AppServiceError && err.kind === 'session_expired') {
      setSessionExpired(true);
    }
    const msg = err instanceof Error ? err.message : fallbackMessage;
    showBanner('error', msg);
  };

  const fetchDashboardData = useCallback(
    async (showSpinner = false) => {
      try {
        if (showSpinner) setLoading(true);
        setLoadError(null);
        setSessionExpired(false);

        const [projRows, evtRows, inqRows, appRows, partRows] = await Promise.all([
          canAccessProjects ? fetchAdminProjects() : Promise.resolve([]),
          canAccessEvents ? fetchAdminEvents() : Promise.resolve([]),
          canAccessInbox ? fetchAdminInquiries() : Promise.resolve([]),
          canAccessApplications ? fetchAdminApplications() : Promise.resolve([]),
          canAccessEvents ? fetchAllEventParticipants() : Promise.resolve([]),
        ]);

        setProjects(projRows);
        setEvents(evtRows);
        setInbox(inqRows);
        setApplications(appRows);
        setParticipants(partRows);
      } catch (err: unknown) {
        if (err instanceof AppServiceError && err.kind === 'session_expired') {
          setSessionExpired(true);
        }
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Failed to load dashboard records from Supabase.'
        );
      } finally {
        setLoading(false);
      }
    },
    [canAccessProjects, canAccessEvents, canAccessInbox, canAccessApplications]
  );

  useEffect(() => {
    void fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Derived real metrics (zero fabricated stats)
  const publishedProjectsCount = projects.filter((p) => p.is_published && p.status === 'published').length;
  const draftProjectsCount = projects.filter((p) => p.status === 'draft').length;
  const upcomingPublishedEventsCount = events.filter(isEventCurrentlyUpcoming).length;
  const unreadInquiriesCount = inbox.filter((m) => m.status === 'New').length;
  const pendingApplicationsCount = applications.filter((a) => a.status === 'pending').length;

  const availableTabs = useMemo(() => {
    const items: Array<{
      id: DashboardTabId;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number | string;
      highlightBadge?: boolean;
    }> = [];

    if (canViewOverview) {
      items.push({ id: 'overview', label: 'Executive Overview', icon: LayoutDashboard });
    }
    if (canManageTeamAccess) {
      items.push({
        id: 'team-access',
        label: 'Team Access',
        icon: ShieldCheck,
        badge: 'CEO',
        highlightBadge: true,
      });
      items.push({
        id: 'team-management',
        label: 'Appoint Leads & Team',
        icon: Users,
        badge: 'ROSTER',
        highlightBadge: true,
      });
    }
    if (canAccessProjects) {
      items.push({
        id: 'projects',
        label: 'Projects Manager',
        icon: FolderGit2,
        badge: projects.length,
      });
    }
    if (canAccessEvents) {
      items.push({
        id: 'events',
        label: 'Flagship Events',
        icon: Trophy,
        badge: events.length,
      });
    }
    if (canAccessInbox) {
      items.push({
        id: 'inbox',
        label: 'Inbound Inbox',
        icon: Inbox,
        badge: unreadInquiriesCount > 0 ? unreadInquiriesCount : undefined,
        highlightBadge: true,
      });
    }
    if (canAccessApplications) {
      items.push({
        id: 'applications',
        label: 'Roster Applications',
        icon: Users,
        badge:
          pendingApplicationsCount > 0
            ? pendingApplicationsCount
            : applications.length || undefined,
      });
    }
    return items;
  }, [
    canViewOverview,
    canManageTeamAccess,
    canAccessProjects,
    canAccessEvents,
    canAccessInbox,
    canAccessApplications,
    projects.length,
    events.length,
    unreadInquiriesCount,
    pendingApplicationsCount,
    applications.length,
  ]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

  // ============================================================================
  // Project CRUD Handlers
  // ============================================================================

  const openCreateProjectModal = () => {
    setProjectForm(EMPTY_PROJECT_FORM);
    setProjectFormError(null);
    setIsProjectModalOpen(true);
  };

  const openEditProjectModal = (proj: ProjectRecord) => {
    setProjectForm({
      id: proj.id,
      title: proj.title,
      slug: proj.slug,
      slugTouched: true,
      tagline: proj.tagline || '',
      category: proj.category || 'ai-ml',
      description: proj.description,
      technologiesText: (proj.technologies || []).join(', '),
      image_url: proj.image_url || '',
      live_url: proj.live_url || '',
      source_url: proj.source_url || '',
    });
    setProjectFormError(null);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = async (publish: boolean) => {
    if (savingProject) return;
    setProjectFormError(null);
    setSavingProject(true);

    const payload: ProjectUpsertInput = {
      title: projectForm.title,
      slug: projectForm.slug || generateSlug(projectForm.title),
      tagline: projectForm.tagline || null,
      category: projectForm.category,
      description: projectForm.description,
      technologies: projectForm.technologiesText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      image_url: projectForm.image_url || null,
      live_url: projectForm.live_url || null,
      source_url: projectForm.source_url || null,
      publish,
    };

    try {
      if (projectForm.id) {
        const effectivePublish = canPublishProject ? publish : false;
        await updateAdminProject(
          projectForm.id,
          { ...payload, publish: effectivePublish },
          canPublishProject
        );
        showBanner(
          'success',
          !canPublishProject
            ? `Saved content updates to "${payload.title}".`
            : effectivePublish
            ? `Updated and published "${payload.title}" to the public website.`
            : `Saved "${payload.title}" as an unpublished draft.`
        );
      } else {
        const effectivePublish = canPublishProject ? publish : false;
        await createAdminProject({ ...payload, publish: effectivePublish });
        showBanner(
          'success',
          effectivePublish
            ? `Created and published "${payload.title}" to Our Projects.`
            : `Saved "${payload.title}" as a draft.`
        );
      }
      setIsProjectModalOpen(false);
      await fetchDashboardData(false);
    } catch (err: unknown) {
      if (err instanceof AppServiceError && err.kind === 'session_expired') {
        setSessionExpired(true);
      }
      setProjectFormError(err instanceof Error ? err.message : 'Unable to save project.');
    } finally {
      setSavingProject(false);
    }
  };

  const handleToggleProjectPublish = async (proj: ProjectRecord) => {
    if (busyActionId) return;
    setBusyActionId(proj.id);
    const nextPublish = !(proj.is_published && proj.status === 'published');
    try {
      await setAdminProjectPublication(proj.id, nextPublish);
      showBanner(
        'success',
        nextPublish
          ? `"${proj.title}" is now published on the public website.`
          : `"${proj.title}" was unpublished and moved to drafts.`
      );
      await fetchDashboardData(false);
    } catch (err: unknown) {
      handleActionError(err, 'Failed to update project publication status.');
    } finally {
      setBusyActionId(null);
    }
  };

  const requestArchiveProject = (proj: ProjectRecord) => {
    setConfirmDialog({
      title: 'Archive Project',
      description: `Archive "${proj.title}"? It will immediately be removed from the public website and stored under Archived projects.`,
      confirmLabel: 'Archive Project',
      tone: 'warning',
      onConfirm: async () => {
        await archiveAdminProject(proj.id);
        showBanner('success', `Archived "${proj.title}".`);
        await fetchDashboardData(false);
      },
    });
  };

  const requestDeleteProject = (proj: ProjectRecord) => {
    setConfirmDialog({
      title: 'Permanently Delete Project',
      description: `Permanently delete "${proj.title}" from Supabase? This action cannot be undone and removes the project immediately from the website.`,
      confirmLabel: 'Delete Permanently',
      tone: 'danger',
      onConfirm: async () => {
        await deleteAdminProject(proj.id);
        showBanner('success', `Deleted project "${proj.title}".`);
        await fetchDashboardData(false);
      },
    });
  };

  // ============================================================================
  // Event CRUD Handlers
  // ============================================================================

  const openCreateEventModal = () => {
    setEventForm(createEmptyEventForm());
    setEventFormError(null);
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (evt: EventRecord) => {
    setEventForm({
      id: evt.id,
      title: evt.title,
      tagline: evt.tagline || '',
      category: evt.category || 'Hackathon',
      description: evt.description,
      event_date: isoToLocalInput(evt.event_date),
      end_date: isoToLocalInput(evt.end_date),
      location: evt.location,
      is_virtual: evt.is_virtual,
      registration_url: evt.registration_url || '',
      image_url: evt.image_url || '',
      prize_pool: evt.prize_pool || '',
      tagsText: (evt.tags || []).join(', '),
      status: evt.status,
      is_published: evt.is_published,
    });
    setEventFormError(null);
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (publishOverride: boolean) => {
    if (savingEvent) return;
    setEventFormError(null);
    setSavingEvent(true);

    const nextStatus: EventStatus = publishOverride
      ? eventForm.status === 'past' || eventForm.status === 'ongoing'
        ? eventForm.status
        : 'upcoming'
      : eventForm.status === 'cancelled' || eventForm.status === 'archived'
      ? eventForm.status
      : 'draft';

    const payload: EventUpsertInput = {
      title: eventForm.title,
      tagline: eventForm.tagline || null,
      category: eventForm.category,
      description: eventForm.description,
      event_date: eventForm.event_date,
      end_date: eventForm.end_date || null,
      location: eventForm.location,
      is_virtual: eventForm.is_virtual,
      registration_url: eventForm.registration_url || null,
      image_url: eventForm.image_url || null,
      prize_pool: eventForm.prize_pool || null,
      tags: eventForm.tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      status: nextStatus,
      is_published: publishOverride,
    };

    try {
      if (eventForm.id) {
        const effectivePublish = canPublishEvent ? publishOverride : eventForm.is_published;
        await updateAdminEvent(
          eventForm.id,
          { ...payload, is_published: effectivePublish },
          canPublishEvent
        );
        showBanner(
          'success',
          !canPublishEvent
            ? `Saved content updates to "${payload.title}".`
            : effectivePublish
            ? `Updated and published "${payload.title}".`
            : `Saved "${payload.title}" as unpublished.`
        );
      } else {
        const effectivePublish = canPublishEvent ? publishOverride : false;
        await createAdminEvent({
          ...payload,
          status: effectivePublish ? payload.status : 'draft',
          is_published: effectivePublish,
        });
        showBanner(
          'success',
          effectivePublish
            ? `Created and published event "${payload.title}".`
            : `Saved event "${payload.title}" as a draft.`
        );
      }
      setIsEventModalOpen(false);
      await fetchDashboardData(false);
    } catch (err: unknown) {
      if (err instanceof AppServiceError && err.kind === 'session_expired') {
        setSessionExpired(true);
      }
      setEventFormError(err instanceof Error ? err.message : 'Unable to save event.');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleToggleEventPublish = async (evt: EventRecord) => {
    if (busyActionId) return;
    setBusyActionId(evt.id);
    const nextPublish = !evt.is_published;
    try {
      await setAdminEventPublication(evt.id, nextPublish, evt.status);
      showBanner(
        'success',
        nextPublish
          ? `"${evt.title}" is now published on Flagship Events.`
          : `"${evt.title}" was unpublished from the public website.`
      );
      await fetchDashboardData(false);
    } catch (err: unknown) {
      handleActionError(err, 'Failed to update event publication status.');
    } finally {
      setBusyActionId(null);
    }
  };

  const requestDeleteEvent = (evt: EventRecord) => {
    setConfirmDialog({
      title: 'Permanently Delete Event',
      description: `Permanently delete "${evt.title}"? It will be removed immediately from the database and public Flagship Events list.`,
      confirmLabel: 'Delete Event',
      tone: 'danger',
      onConfirm: async () => {
        await deleteAdminEvent(evt.id);
        showBanner('success', `Deleted event "${evt.title}".`);
        await fetchDashboardData(false);
      },
    });
  };

  // ============================================================================
  // Inbox & Roster Application Handlers
  // ============================================================================

  const handleUpdateInquiryStatus = async (
    id: string,
    newStatus: ContactInquiryRecord['status']
  ) => {
    try {
      const updated = await updateAdminInquiryStatus(id, newStatus);
      setInbox((prev) => prev.map((m) => (m.id === id ? updated : m)));
      if (selectedMessage?.id === id) {
        setSelectedMessage(updated);
      }
      showBanner('success', `Inquiry marked as ${newStatus}.`);
    } catch (err: unknown) {
      handleActionError(err, 'Failed to update inquiry status.');
    }
  };

  const requestDeleteInquiry = (msg: ContactInquiryRecord) => {
    setConfirmDialog({
      title: 'Delete Inbound Inquiry',
      description: `Delete inquiry "${msg.subject}" from ${msg.name}? This cannot be undone.`,
      confirmLabel: 'Delete Inquiry',
      tone: 'danger',
      onConfirm: async () => {
        await deleteAdminInquiry(msg.id);
        setSelectedMessage(null);
        showBanner('success', 'Inquiry deleted.');
        await fetchDashboardData(false);
      },
    });
  };

  const handleUpdateApplicationStatus = async (
    id: string,
    status: CareerApplicationRecord['status']
  ) => {
    try {
      const updated = await updateAdminApplicationStatus(id, status);
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
      showBanner('success', `Application status updated to ${status}.`);
    } catch (err: unknown) {
      handleActionError(err, 'Failed to update application status.');
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmDialog || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (err: unknown) {
      handleActionError(err, 'Action failed.');
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  // Filtered lists
  const filteredProjects = projects.filter((p) => {
    if (projectStatusFilter === 'all') return true;
    if (projectStatusFilter === 'published') return p.is_published && p.status === 'published';
    return p.status === projectStatusFilter;
  });

  const filteredEvents = events.filter((e) => {
    if (eventStatusFilter === 'all') return true;
    if (eventStatusFilter === 'published') return e.is_published;
    if (eventStatusFilter === 'draft') return !e.is_published;
    if (eventStatusFilter === 'past') return e.status === 'past' || !isEventCurrentlyUpcoming(e);
    return true;
  });

  // Live Preview Card Data inside Project Modal
  const previewProjectRecord: Pick<
    ProjectRecord,
    | 'id'
    | 'title'
    | 'tagline'
    | 'description'
    | 'image_url'
    | 'category'
    | 'technologies'
    | 'live_url'
    | 'source_url'
    | 'status'
  > = {
    id: projectForm.id || 'preview',
    title: projectForm.title.trim() || 'Untitled Project',
    tagline: projectForm.tagline.trim() || null,
    description:
      projectForm.description.trim() ||
      'Enter a concise summary of the engineering architecture, problem solved, and technical outcomes.',
    image_url: projectForm.image_url.trim() || null,
    category: projectForm.category || 'ai-ml',
    technologies: projectForm.technologiesText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    live_url: projectForm.live_url.trim() || null,
    source_url: projectForm.source_url.trim() || null,
    status: 'published',
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col pt-20">
      {/* Dashboard Top Banner */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BrandLogo variant="emblem-only" size="sm" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display font-bold text-lg text-white">
                  AICONEKT Administrator Dashboard
                </h1>
                <span className="text-xs font-mono text-emerald-400">
                  · Supabase RLS Enforced
                </span>
              </div>
              <p className="font-mono text-xs text-slate-400">
                Signed in as <strong className="text-white">{user?.full_name || user?.email}</strong> · Role:{' '}
                <strong className="text-cyan-300">{user?.roleLabel || 'Authorized Member'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void fetchDashboardData(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors"
              title="Refresh Supabase records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Sync</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-800 text-xs font-mono transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          {availableTabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-mono transition-all ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] tabular-nums ${
                      item.highlightBadge
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Dynamic Content Panel */}
        <div className="flex-1 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md space-y-6">
          {/* Session Expiry Banner */}
          {sessionExpired && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-amber-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Your Supabase administrator session has expired. Sign in again to save changes.</span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold"
              >
                Re-authenticate
              </button>
            </div>
          )}

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs font-mono ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-16 text-center text-slate-400 font-mono text-xs">
              Loading verified records from Supabase...
            </div>
          ) : loadError ? (
            <div className="p-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-4 max-w-xl mx-auto">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="font-display font-bold text-lg text-white">
                Unable to Query Dashboard Tables
              </h3>
              <p className="text-xs font-mono text-rose-200/90 leading-relaxed">{loadError}</p>
              <button
                type="button"
                onClick={() => void fetchDashboardData(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : (
            <>
              {/* CEO-ONLY TEAM ACCESS MANAGEMENT */}
              {activeTab === 'team-access' && canManageTeamAccess && (
                <TeamAccessPanel onNotify={showBanner} />
              )}

              {/* CEO-ONLY TEAM LEADS & MEMBER PROFILES MANAGEMENT */}
              {activeTab === 'team-management' && canManageTeamAccess && (
                <TeamManagementPanel />
              )}

              {/* TAB 1: EXECUTIVE OVERVIEW */}
              {activeTab === 'overview' && canViewOverview && (
                <div className="space-y-8">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="font-display font-bold text-2xl text-white">
                        Executive Content & Operations Overview
                      </h2>
                      <p className="text-slate-400 text-xs mt-1">
                        Live counts queried directly from your Supabase PostgreSQL database.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {canManageTeamAccess && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('team-management')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-orange-500/20"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Manage Teams</span>
                        </button>
                      )}
                      {canManageTeamAccess && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('team-access')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-semibold text-xs font-mono"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Team Access</span>
                        </button>
                      )}
                      {canCreateProject && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('projects');
                            openCreateProjectModal();
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Project</span>
                        </button>
                      )}
                      {canCreateEvent && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('events');
                            openCreateEventModal();
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-semibold text-xs font-mono"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Event</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Real Database Metric Cards (Scoped to Permitted Tables) - Clickable to open corresponding page */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                      type="button"
                      onClick={() => canAccessProjects && setActiveTab('projects')}
                      className={`text-left p-5 rounded-xl border transition-all duration-200 group ${
                        canAccessProjects
                          ? 'bg-slate-900/60 hover:bg-slate-900 hover:border-cyan-500/50 cursor-pointer shadow-lg hover:shadow-cyan-500/10'
                          : 'bg-slate-900/30 border-slate-800/60 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                        <span className="group-hover:text-cyan-300 transition-colors">Published Projects</span>
                        <FolderGit2 className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="font-display font-bold text-3xl text-white mt-2 tabular-nums">
                        {canAccessProjects ? publishedProjectsCount : '—'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums flex items-center justify-between">
                        <span>
                          {canAccessProjects
                            ? `${draftProjectsCount} Draft · ${projects.length} Total`
                            : 'No project view permission'}
                        </span>
                        {canAccessProjects && (
                          <span className="text-cyan-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                            Open Manager →
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => canAccessEvents && setActiveTab('events')}
                      className={`text-left p-5 rounded-xl border transition-all duration-200 group ${
                        canAccessEvents
                          ? 'bg-slate-900/60 hover:bg-slate-900 hover:border-blue-500/50 cursor-pointer shadow-lg hover:shadow-blue-500/10'
                          : 'bg-slate-900/30 border-slate-800/60 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                        <span className="group-hover:text-blue-300 transition-colors">Upcoming Events</span>
                        <Trophy className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="font-display font-bold text-3xl text-white mt-2 tabular-nums">
                        {canAccessEvents ? upcomingPublishedEventsCount : '—'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums flex items-center justify-between">
                        <span>
                          {canAccessEvents
                            ? `${events.length} Total Scheduled Records`
                            : 'No event view permission'}
                        </span>
                        {canAccessEvents && (
                          <span className="text-blue-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                            Open Manager →
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => canAccessApplications && setActiveTab('applications')}
                      className={`text-left p-5 rounded-xl border transition-all duration-200 group ${
                        canAccessApplications
                          ? 'bg-slate-900/60 hover:bg-slate-900 hover:border-violet-500/50 cursor-pointer shadow-lg hover:shadow-violet-500/10'
                          : 'bg-slate-900/30 border-slate-800/60 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                        <span className="group-hover:text-violet-300 transition-colors">Roster Applications</span>
                        <Users className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="font-display font-bold text-3xl text-white mt-2 tabular-nums">
                        {canAccessApplications ? applications.length : '—'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums flex items-center justify-between">
                        <span>
                          {canAccessApplications
                            ? `${pendingApplicationsCount} Pending Review`
                            : 'No applications permission'}
                        </span>
                        {canAccessApplications && (
                          <span className="text-violet-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                            Open Roster →
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => canAccessInbox && setActiveTab('inbox')}
                      className={`text-left p-5 rounded-xl border transition-all duration-200 group ${
                        canAccessInbox
                          ? 'bg-slate-900/60 hover:bg-slate-900 hover:border-emerald-500/50 cursor-pointer shadow-lg hover:shadow-emerald-500/10'
                          : 'bg-slate-900/30 border-slate-800/60 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                        <span className="group-hover:text-emerald-300 transition-colors">Inbound Inquiries</span>
                        <Mail className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="font-display font-bold text-3xl text-white mt-2 tabular-nums">
                        {canAccessInbox ? inbox.length : '—'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums flex items-center justify-between">
                        <span>
                          {canAccessInbox
                            ? `${unreadInquiriesCount} Unread Messages`
                            : 'No inbox permission'}
                        </span>
                        {canAccessInbox && (
                          <span className="text-emerald-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                            Open Inbox →
                          </span>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Security Posture Summary */}
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-300">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>
                        CEO-Controlled RBAC Active · Active Role:{' '}
                        <strong className="text-cyan-300">{user?.roleLabel}</strong> · All mutations
                        enforced by PostgreSQL RLS
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PROJECTS MANAGER */}
              {activeTab === 'projects' && canAccessProjects && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="font-display font-bold text-2xl text-white">Projects Manager</h2>
                      <p className="text-slate-400 text-xs mt-1">
                        Create, preview, publish, unpublish, archive, or delete projects shown in “Our Projects”.
                      </p>
                    </div>
                    {canCreateProject && (
                      <button
                        type="button"
                        onClick={openCreateProjectModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20"
                      >
                        <Plus className="w-4 h-4" />
                        <span>New Project</span>
                      </button>
                    )}
                  </div>

                  {/* Filter Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/70 p-1 rounded-xl border border-slate-800 w-fit text-xs font-mono">
                    {(
                      [
                        { id: 'all', label: `All (${projects.length})` },
                        { id: 'published', label: `Published (${publishedProjectsCount})` },
                        { id: 'draft', label: `Drafts (${draftProjectsCount})` },
                        {
                          id: 'archived',
                          label: `Archived (${projects.filter((p) => p.status === 'archived').length})`,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setProjectStatusFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-lg transition-colors ${
                          projectStatusFilter === tab.id
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {filteredProjects.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-mono bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-3">
                      <FolderGit2 className="w-7 h-7 text-cyan-400 mx-auto" />
                      <p>
                        {projects.length === 0
                          ? 'No projects have been created yet. Create a project and publish it when ready.'
                          : 'No projects match the selected status filter.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredProjects.map((proj) => {
                        const isLive = proj.is_published && proj.status === 'published';
                        const isBusy = busyActionId === proj.id;
                        return (
                          <div
                            key={proj.id}
                            className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                <span
                                  className={
                                    isLive
                                      ? 'text-emerald-400 font-semibold'
                                      : proj.status === 'archived'
                                      ? 'text-amber-400'
                                      : 'text-slate-400'
                                  }
                                >
                                  {isLive ? 'Published' : proj.status === 'archived' ? 'Archived' : 'Draft'}
                                </span>
                                <span className="text-slate-600">·</span>
                                <span className="text-cyan-300">{formatCategoryLabel(proj.category)}</span>
                                <span className="text-slate-600">·</span>
                                <span className="text-slate-500">/{proj.slug}</span>
                              </div>

                              <h3 className="font-display font-bold text-lg text-white truncate">
                                {proj.title}
                              </h3>
                              {proj.tagline && (
                                <p className="text-xs font-mono text-cyan-400/90 truncate">{proj.tagline}</p>
                              )}
                              <p className="text-xs text-slate-400 line-clamp-2">{proj.description}</p>

                              {proj.technologies?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {proj.technologies.map((tech) => (
                                    <span
                                      key={tech}
                                      className="text-[11px] font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800"
                                    >
                                      {tech}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {canPublishProject && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleToggleProjectPublish(proj)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold border transition-colors disabled:opacity-50 ${
                                    isLive
                                      ? 'bg-slate-950 hover:bg-slate-800 text-amber-300 border-amber-500/30'
                                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                  }`}
                                >
                                  {isLive ? (
                                    <>
                                      <EyeOff className="w-3.5 h-3.5" />
                                      <span>Unpublish</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Publish</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {canEditProject && (
                                <button
                                  type="button"
                                  onClick={() => openEditProjectModal(proj)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-mono transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {canPublishProject && proj.status !== 'archived' && (
                                <button
                                  type="button"
                                  onClick={() => requestArchiveProject(proj)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-300 text-xs font-mono transition-colors"
                                  title="Archive project"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  <span>Archive</span>
                                </button>
                              )}

                              {canDeleteProject && (
                                <button
                                  type="button"
                                  onClick={() => requestDeleteProject(proj)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-rose-400 text-xs font-mono transition-colors"
                                  title="Delete project permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              )}

                              {!canEditProject && !canPublishProject && !canDeleteProject && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                                  <Lock className="w-3 h-3" />
                                  <span>Read-Only</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FLAGSHIP EVENTS MANAGER */}
              {activeTab === 'events' && canAccessEvents && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="font-display font-bold text-2xl text-white">
                        Flagship Events Manager
                      </h2>
                      <p className="text-slate-400 text-xs mt-1">
                        Schedule, edit, publish, unpublish, or delete hackathons, workshops, and technical symposiums.
                      </p>
                    </div>
                    {canCreateEvent && (
                      <button
                        type="button"
                        onClick={openCreateEventModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20"
                      >
                        <Plus className="w-4 h-4" />
                        <span>New Event</span>
                      </button>
                    )}
                  </div>

                  {/* Filter Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/70 p-1 rounded-xl border border-slate-800 w-fit text-xs font-mono">
                    {(
                      [
                        { id: 'all', label: `All (${events.length})` },
                        {
                          id: 'published',
                          label: `Published (${events.filter((e) => e.is_published).length})`,
                        },
                        {
                          id: 'draft',
                          label: `Unpublished (${events.filter((e) => !e.is_published).length})`,
                        },
                        {
                          id: 'past',
                          label: `Past / Elapsed (${events.filter((e) => e.status === 'past' || !isEventCurrentlyUpcoming(e)).length})`,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEventStatusFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-lg transition-colors ${
                          eventStatusFilter === tab.id
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {filteredEvents.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-mono bg-slate-900/40 rounded-2xl border border-slate-800/80 space-y-3">
                      <Calendar className="w-7 h-7 text-cyan-400 mx-auto" />
                      <p>
                        {events.length === 0
                          ? 'No events created yet. Click “New Event” to schedule a hackathon or workshop.'
                          : 'No events match the selected filter.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredEvents.map((evt) => {
                        const upcomingLive = isEventCurrentlyUpcoming(evt);
                        const isBusy = busyActionId === evt.id;
                        return (
                          <div
                            key={evt.id}
                            className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                <span
                                  className={
                                    upcomingLive
                                      ? 'text-emerald-400 font-semibold'
                                      : evt.is_published
                                      ? 'text-cyan-300'
                                      : 'text-slate-400'
                                  }
                                >
                                  {upcomingLive
                                    ? 'Published · Upcoming'
                                    : evt.is_published
                                    ? `Published · ${evt.status}`
                                    : `Draft (${evt.status})`}
                                </span>
                                <span className="text-slate-600">·</span>
                                <span className="text-cyan-300">{evt.category}</span>
                              </div>

                              <h3 className="font-display font-bold text-lg text-white truncate">
                                {evt.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                                  {formatShortTimestamp(evt.event_date)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-violet-400" />
                                  {evt.location}
                                  {evt.is_virtual ? ' (Online)' : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedEventForRoster(evt)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold transition-colors"
                                >
                                  <Users className="w-3 h-3 text-cyan-400" />
                                  <span>
                                    {participants.filter((p) => p.event_id === evt.id && p.status !== 'withdrawn').length} Interested / Registered
                                  </span>
                                </button>
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-2">{evt.description}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {canPublishEvent && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleToggleEventPublish(evt)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold border transition-colors disabled:opacity-50 ${
                                    evt.is_published
                                      ? 'bg-slate-950 hover:bg-slate-800 text-amber-300 border-amber-500/30'
                                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                  }`}
                                >
                                  {evt.is_published ? (
                                    <>
                                      <EyeOff className="w-3.5 h-3.5" />
                                      <span>Unpublish</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Publish</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {canEditEvent && (
                                <button
                                  type="button"
                                  onClick={() => openEditEventModal(evt)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-mono transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {canDeleteEvent && (
                                <button
                                  type="button"
                                  onClick={() => requestDeleteEvent(evt)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-rose-400 text-xs font-mono transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              )}

                              {!canEditEvent && !canPublishEvent && !canDeleteEvent && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                                  <Lock className="w-3 h-3" />
                                  <span>Read-Only</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: INBOUND INBOX */}
              {activeTab === 'inbox' && canAccessInbox && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display font-bold text-2xl text-white">Inbound Inquiries</h2>
                      <p className="text-slate-400 text-xs mt-1">
                        Messages submitted through the public Connect section.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setInboxFilter('all')}
                        className={`px-3 py-1.5 rounded-lg ${
                          inboxFilter === 'all'
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        All ({inbox.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInboxFilter('unread')}
                        className={`px-3 py-1.5 rounded-lg ${
                          inboxFilter === 'unread'
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Unread ({unreadInquiriesCount})
                      </button>
                    </div>
                  </div>

                  {inbox.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-mono bg-slate-900/40 rounded-2xl border border-slate-800/80">
                      No contact inquiries received yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {inbox
                        .filter((m) => (inboxFilter === 'unread' ? m.status === 'New' : true))
                        .map((msg) => (
                          <div
                            key={msg.id}
                            onClick={() => setSelectedMessage(msg)}
                            className={`cursor-pointer p-4 rounded-xl border transition-all ${
                              msg.status === 'New'
                                ? 'bg-slate-900/90 border-cyan-500/50 shadow-sm'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-display font-bold text-sm text-white">
                                  {msg.name}
                                </span>
                                <span className="text-slate-500 text-xs font-mono">
                                  &lt;{msg.email}&gt;
                                </span>
                                <span className="text-[11px] font-mono text-cyan-400">
                                  · {msg.status}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-500">
                                {formatShortTimestamp(msg.created_at)}
                              </span>
                            </div>

                            <div className="font-medium text-xs text-cyan-300 mt-1">{msg.subject}</div>
                            <p className="text-slate-400 text-xs mt-1 line-clamp-1">{msg.message}</p>
                          </div>
                        ))}
                    </div>
                  )}

                  {selectedMessage && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 relative shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-mono text-cyan-400">
                              {selectedMessage.category} · {formatShortTimestamp(selectedMessage.created_at)}
                            </div>
                            <h3 className="font-display font-bold text-xl text-white mt-1">
                              {selectedMessage.subject}
                            </h3>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              From: {selectedMessage.name} ({selectedMessage.email})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedMessage(null)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {selectedMessage.message}
                        </div>

                        {canManageInbox ? (
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
                            <span className="text-slate-400">Status:</span>
                            {(['New', 'Read', 'In Progress', 'Responded', 'Closed'] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => void handleUpdateInquiryStatus(selectedMessage.id, s)}
                                className={`px-2.5 py-1 rounded-lg ${
                                  selectedMessage.status === s
                                    ? 'bg-cyan-500 text-slate-950 font-bold'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-800 text-xs font-mono text-slate-400">
                            Status: <span className="text-cyan-300">{selectedMessage.status}</span> (Read-Only)
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          {canManageInbox ? (
                            <button
                              type="button"
                              onClick={() => requestDeleteInquiry(selectedMessage)}
                              className="flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Inquiry</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          <a
                            href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                            className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider"
                          >
                            Reply via Email
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: ROSTER APPLICATIONS */}
              {activeTab === 'applications' && canAccessApplications && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display font-bold text-2xl text-white">Roster Applications</h2>
                    <p className="text-slate-400 text-xs mt-1">
                      Student membership applications submitted from the public website.
                    </p>
                  </div>

                  {applications.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-mono bg-slate-900/40 rounded-2xl border border-slate-800/80">
                      No membership applications recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {applications.map((app) => (
                        <div
                          key={app.id}
                          className="bg-slate-900/50 p-5 rounded-xl border border-slate-800 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-display font-bold text-white text-base">
                                {app.applicant_name}
                              </div>
                              <div className="text-xs font-mono text-slate-400">
                                {app.applicant_email} · <span className="text-cyan-400">{app.department_name}</span>
                              </div>
                            </div>
                            <span className="text-xs font-mono text-slate-500">
                              {formatShortTimestamp(app.submitted_at)}
                            </span>
                          </div>

                          {app.skills && (
                            <div className="text-xs text-slate-300 font-mono">
                              <span className="text-slate-500">Skills:</span> {app.skills}
                            </div>
                          )}

                          {app.portfolio_url && (
                            <div>
                              <a
                                href={app.portfolio_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:underline"
                              >
                                <Globe className="w-3.5 h-3.5" />
                                <span>{app.portfolio_url}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {app.cover_note && (
                            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap">
                              {app.cover_note}
                            </p>
                          )}

                          {canManageApplications ? (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                              <span className="text-slate-400">Status:</span>
                              {(['pending', 'reviewing', 'accepted', 'declined'] as const).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => void handleUpdateApplicationStatus(app.id, st)}
                                  className={`px-2.5 py-1 rounded-lg capitalize ${
                                    app.status === st
                                      ? 'bg-cyan-500 text-slate-950 font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-slate-800/80 text-xs font-mono text-slate-400">
                              Status: <span className="text-cyan-300 capitalize">{app.status}</span> (Read-Only)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========================================================================
          PROJECT CREATE / EDIT + LIVE CARD PREVIEW MODAL
         ======================================================================== */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-display font-bold text-2xl text-white">
                  {projectForm.id ? 'Edit Project' : 'Create New Project'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Save as a private draft or publish immediately to “Our Projects”.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {projectFormError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-mono flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{projectFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form Inputs */}
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={projectForm.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setProjectForm((prev) => ({
                          ...prev,
                          title,
                          slug: prev.slugTouched ? prev.slug : generateSlug(title),
                        }));
                      }}
                      placeholder="e.g. Autonomous Edge Telemetry"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      URL Slug *
                    </label>
                    <input
                      type="text"
                      required
                      value={projectForm.slug}
                      onChange={(e) =>
                        setProjectForm((prev) => ({
                          ...prev,
                          slug: e.target.value.toLowerCase(),
                          slugTouched: true,
                        }))
                      }
                      placeholder="autonomous-edge-telemetry"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Category *
                    </label>
                    <select
                      value={projectForm.category}
                      onChange={(e) =>
                        setProjectForm((prev) => ({ ...prev, category: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ai-ml">AI & Machine Learning</option>
                      <option value="fullstack">Full-Stack Systems</option>
                      <option value="cloud-devops">Cloud & Infrastructure</option>
                      <option value="research">Simulation & R&D</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Short Tagline (Optional)
                    </label>
                    <input
                      type="text"
                      value={projectForm.tagline}
                      onChange={(e) =>
                        setProjectForm((prev) => ({ ...prev, tagline: e.target.value }))
                      }
                      placeholder="One-line technical summary"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Description *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={projectForm.description}
                    onChange={(e) =>
                      setProjectForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Describe what the project does, its architecture, and real-world engineering impact..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-y"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Technology Stack (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={projectForm.technologiesText}
                    onChange={(e) =>
                      setProjectForm((prev) => ({ ...prev, technologiesText: e.target.value }))
                    }
                    placeholder="TypeScript, PyTorch, PostgreSQL, Docker"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Thumbnail Image URL
                    </label>
                    <input
                      type="url"
                      value={projectForm.image_url}
                      onChange={(e) =>
                        setProjectForm((prev) => ({ ...prev, image_url: e.target.value }))
                      }
                      placeholder="https://..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Live Demo URL
                    </label>
                    <input
                      type="url"
                      value={projectForm.live_url}
                      onChange={(e) =>
                        setProjectForm((prev) => ({ ...prev, live_url: e.target.value }))
                      }
                      placeholder="https://..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Public Source URL
                    </label>
                    <input
                      type="url"
                      value={projectForm.source_url}
                      onChange={(e) =>
                        setProjectForm((prev) => ({ ...prev, source_url: e.target.value }))
                      }
                      placeholder="https://github.com/..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Live Public Card Preview */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Live Public Card Preview</span>
                  <span className="text-cyan-400">Our Projects Section</span>
                </div>
                <ProjectCard project={previewProjectRecord} />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                disabled={savingProject}
                onClick={() => setIsProjectModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingProject}
                onClick={() => void handleSaveProject(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-semibold disabled:opacity-50"
              >
                {savingProject
                  ? 'Saving...'
                  : projectForm.id && !canPublishProject
                  ? 'Save Changes'
                  : 'Save as Draft'}
              </button>
              {canPublishProject && (
                <button
                  type="button"
                  disabled={savingProject}
                  onClick={() => void handleSaveProject(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {savingProject ? 'Publishing...' : 'Publish to Website'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          EVENT CREATE / EDIT MODAL
         ======================================================================== */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-display font-bold text-2xl text-white">
                  {eventForm.id ? 'Edit Flagship Event' : 'Schedule New Flagship Event'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Published upcoming events appear automatically on the Home and Flagship Events pages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {eventFormError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-mono flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{eventFormError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={eventForm.title}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. AICONEKT Systems Symposium"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={eventForm.category}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Hackathon">Hackathon</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Tech Summit">Tech Summit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.event_date}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, event_date: e.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    End Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={eventForm.end_date}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, end_date: e.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Venue or Online Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={eventForm.location}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                    placeholder="Main Engineering Auditorium / Online"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Lifecycle Stage
                  </label>
                  <select
                    value={eventForm.status}
                    disabled={!canPublishEvent}
                    onChange={(e) =>
                      setEventForm((prev) => ({
                        ...prev,
                        status: e.target.value as EventStatus,
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Live / Ongoing</option>
                    <option value="past">Past Event</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eventForm.is_virtual}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, is_virtual: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Online / Virtual Event</span>
              </label>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Tagline (Optional)
                </label>
                <input
                  type="text"
                  value={eventForm.tagline}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, tagline: e.target.value }))}
                  placeholder="Short subtitle for the event card"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Description *
                </label>
                <textarea
                  rows={4}
                  required
                  value={eventForm.description}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Agenda, eligibility, tracks, and key takeaways..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Registration URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={eventForm.registration_url}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, registration_url: e.target.value }))
                    }
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Cover Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={eventForm.image_url}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, image_url: e.target.value }))
                    }
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Prize Pool (Optional)
                  </label>
                  <input
                    type="text"
                    value={eventForm.prize_pool}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, prize_pool: e.target.value }))
                    }
                    placeholder="e.g. ₹1,00,000 + Cloud Credits"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Topic Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={eventForm.tagsText}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, tagsText: e.target.value }))
                    }
                    placeholder="AI Systems, Web3, Cloud"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                disabled={savingEvent}
                onClick={() => setIsEventModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEvent}
                onClick={() => void handleSaveEvent(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-semibold disabled:opacity-50"
              >
                {savingEvent
                  ? 'Saving...'
                  : eventForm.id && !canPublishEvent
                  ? 'Save Changes'
                  : 'Save as Draft'}
              </button>
              {canPublishEvent && (
                <button
                  type="button"
                  disabled={savingEvent}
                  onClick={() => void handleSaveEvent(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {savingEvent ? 'Publishing...' : 'Publish Event'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          EVENT PARTICIPANTS / ROSTER INSPECTION MODAL (CEO & Event Managers)
         ======================================================================== */}
      {selectedEventForRoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedEventForRoster(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <Trophy className="w-4 h-4" />
                <span>PARTICIPATION ROSTER</span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white mt-1">
                {selectedEventForRoster.title}
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Verified student participation & registrations submitted through the public website.
              </p>
            </div>

            {participants.filter((p) => p.event_id === selectedEventForRoster.id).length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs font-mono">
                No users have expressed interest or registered for this event yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                {participants
                  .filter((p) => p.event_id === selectedEventForRoster.id)
                  .map((p) => (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{p.full_name}</span>
                          {p.roll_number && (
                            <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 text-[11px] font-mono font-bold">
                              {p.roll_number}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                          <span>📧 {p.email}</span>
                          {p.phone && <span>📞 {p.phone}</span>}
                        </div>
                        {(p.college || p.branch) && (
                          <div className="text-xs text-slate-400 flex flex-wrap gap-x-2">
                            {p.college && <span className="text-slate-300 font-medium">🏫 {p.college}</span>}
                            {p.branch && <span className="text-cyan-400/90 font-mono">({p.branch})</span>}
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-slate-500 pt-0.5">
                          Registered: {new Date(p.created_at).toLocaleString()} · Status: <span className="text-cyan-400 capitalize">{p.status}</span>
                        </div>
                      </div>

                      {canManageTeamAccess && (
                        <div className="self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`Remove ${p.full_name} from this event roster?`)) {
                                await adminRemoveParticipant(p.id);
                                setParticipants((prev) => prev.filter((item) => item.id !== p.id));
                                showBanner('success', `Removed ${p.full_name} from participation list.`);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedEventForRoster(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          IN-APP CONFIRMATION DIALOG (NO BROWSER window.confirm)
         ======================================================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="space-y-2">
              <h4 className="font-display font-bold text-xl text-white">{confirmDialog.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.description}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => void executeConfirmedAction()}
                className={`px-4 py-2 rounded-xl font-bold text-xs font-mono disabled:opacity-50 ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {confirmBusy ? 'Processing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
