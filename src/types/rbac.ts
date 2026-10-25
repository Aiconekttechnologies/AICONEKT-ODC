// Shared Role-Based Access Control (RBAC) & Granular Permission Definitions
// Enforced identically in PostgreSQL RLS, Express Server Admin API, and React UI.

export const OFFICIAL_CEO_EMAIL = 'aiconekttechnologies@gmail.com';

export type DashboardRole =
  | 'owner'
  | 'admin'
  | 'project_editor'
  | 'event_manager'
  | 'viewer'
  | 'none';

export type DelegatableRole = Exclude<DashboardRole, 'owner' | 'none'>;

export type AccessStatus = 'pending' | 'active' | 'suspended' | 'revoked';

export type PermissionKey =
  | 'dashboard.overview.view'
  | 'projects.view'
  | 'projects.create'
  | 'projects.edit'
  | 'projects.publish'
  | 'projects.delete'
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.publish'
  | 'events.delete'
  | 'inquiries.view'
  | 'inquiries.manage'
  | 'applications.view'
  | 'applications.manage';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  group: 'Overview' | 'Projects' | 'Events' | 'Operations';
}

export const ALL_PERMISSIONS: readonly PermissionDefinition[] = [
  {
    key: 'dashboard.overview.view',
    label: 'View Executive Overview',
    description: 'Read high-level internal operational counts.',
    group: 'Overview',
  },
  {
    key: 'projects.view',
    label: 'View Internal Projects',
    description: 'View draft, published, and archived projects in the dashboard.',
    group: 'Projects',
  },
  {
    key: 'projects.create',
    label: 'Create Draft Projects',
    description: 'Create new unpublished project drafts.',
    group: 'Projects',
  },
  {
    key: 'projects.edit',
    label: 'Edit Project Content',
    description: 'Update titles, descriptions, links, and stack tags on projects.',
    group: 'Projects',
  },
  {
    key: 'projects.publish',
    label: 'Publish / Unpublish Projects',
    description: 'Publish projects to the live website, unpublish, or archive them.',
    group: 'Projects',
  },
  {
    key: 'projects.delete',
    label: 'Delete Projects',
    description: 'Permanently delete project records from the database.',
    group: 'Projects',
  },
  {
    key: 'events.view',
    label: 'View Internal Events',
    description: 'View draft, upcoming, and past event records in the dashboard.',
    group: 'Events',
  },
  {
    key: 'events.create',
    label: 'Create Draft Events',
    description: 'Schedule new unpublished event drafts.',
    group: 'Events',
  },
  {
    key: 'events.edit',
    label: 'Edit Event Details',
    description: 'Modify event descriptions, dates, venues, and registration links.',
    group: 'Events',
  },
  {
    key: 'events.publish',
    label: 'Publish / Unpublish Events',
    description: 'Publish or unpublish flagship events on the public website.',
    group: 'Events',
  },
  {
    key: 'events.delete',
    label: 'Delete Events',
    description: 'Permanently delete event records from the database.',
    group: 'Events',
  },
  {
    key: 'inquiries.view',
    label: 'View Inbound Inquiries',
    description: 'Read contact messages submitted from the website.',
    group: 'Operations',
  },
  {
    key: 'inquiries.manage',
    label: 'Manage Inbound Inquiries',
    description: 'Update inquiry workflow status or delete inquiries.',
    group: 'Operations',
  },
  {
    key: 'applications.view',
    label: 'View Roster Applications',
    description: 'Read student membership applications.',
    group: 'Operations',
  },
  {
    key: 'applications.manage',
    label: 'Manage Roster Applications',
    description: 'Review, accept, or decline membership applications.',
    group: 'Operations',
  },
] as const;

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = ALL_PERMISSIONS.map((p) => p.key);

export const ROLE_LABELS: Record<DashboardRole, string> = {
  owner: 'Owner / CEO',
  admin: 'Admin / Manager',
  project_editor: 'Project Editor',
  event_manager: 'Event Manager',
  viewer: 'Viewer',
  none: 'No Dashboard Access',
};

export const ROLE_DESCRIPTIONS: Record<DashboardRole, string> = {
  owner:
    'Full control over company settings, team access, projects, events, and all dashboard functions.',
  admin:
    'Exercises only the management and read capabilities explicitly delegated by the CEO.',
  project_editor:
    'Manages projects only according to the project permissions granted by the CEO.',
  event_manager:
    'Manages flagship events only according to the event permissions granted by the CEO.',
  viewer:
    'Read-only access strictly to internal dashboard views explicitly permitted by the CEO.',
  none: 'Default state for unapproved or revoked accounts. Zero dashboard access.',
};

// Maximum permissions allowed to be assigned/exercised per role (Least-Privilege Ceiling)
export const ROLE_ALLOWED_PERMISSIONS: Record<DashboardRole, readonly PermissionKey[]> = {
  owner: ALL_PERMISSION_KEYS,
  admin: ALL_PERMISSION_KEYS,
  project_editor: [
    'dashboard.overview.view',
    'projects.view',
    'projects.create',
    'projects.edit',
    'projects.publish',
    'projects.delete',
  ],
  event_manager: [
    'dashboard.overview.view',
    'events.view',
    'events.create',
    'events.edit',
    'events.publish',
    'events.delete',
  ],
  viewer: [
    'dashboard.overview.view',
    'projects.view',
    'events.view',
    'inquiries.view',
    'applications.view',
  ],
  none: [],
};

// Sensible minimal presets when the CEO selects a role in the UI (CEO can toggle individual checkboxes)
export const ROLE_RECOMMENDED_DEFAULTS: Record<DelegatableRole, readonly PermissionKey[]> = {
  admin: [
    'dashboard.overview.view',
    'projects.view',
    'projects.create',
    'projects.edit',
    'events.view',
    'events.create',
    'events.edit',
    'inquiries.view',
    'applications.view',
  ],
  project_editor: ['projects.view', 'projects.create', 'projects.edit'],
  event_manager: ['events.view', 'events.create', 'events.edit'],
  viewer: ['dashboard.overview.view', 'projects.view', 'events.view'],
};

export function sanitizePermissionsForRole(
  role: DashboardRole,
  requested: readonly string[] | null | undefined
): PermissionKey[] {
  if (role === 'none') return [];
  if (role === 'owner') return [...ALL_PERMISSION_KEYS];

  const allowedSet = new Set<string>(ROLE_ALLOWED_PERMISSIONS[role] || []);
  const unique = new Set<PermissionKey>();

  for (const raw of requested || []) {
    const trimmed = String(raw).trim();
    if (allowedSet.has(trimmed)) {
      unique.add(trimmed as PermissionKey);
    }
  }

  // Ensure if any write permission is granted on a resource, its corresponding .view permission is included
  if (
    unique.has('projects.create') ||
    unique.has('projects.edit') ||
    unique.has('projects.publish') ||
    unique.has('projects.delete')
  ) {
    unique.add('projects.view');
  }
  if (
    unique.has('events.create') ||
    unique.has('events.edit') ||
    unique.has('events.publish') ||
    unique.has('events.delete')
  ) {
    unique.add('events.view');
  }
  if (unique.has('inquiries.manage')) {
    unique.add('inquiries.view');
  }
  if (unique.has('applications.manage')) {
    unique.add('applications.view');
  }

  return Array.from(unique);
}

export function computeEffectivePermissions(
  role: DashboardRole,
  accessStatus: AccessStatus,
  isActive: boolean,
  storedPermissions: readonly string[] | null | undefined
): PermissionKey[] {
  if (!isActive || accessStatus !== 'active' || role === 'none') {
    return [];
  }
  if (role === 'owner') {
    return [...ALL_PERMISSION_KEYS];
  }
  return sanitizePermissionsForRole(role, storedPermissions);
}

export function evaluatePermission(
  role: DashboardRole,
  accessStatus: AccessStatus,
  isActive: boolean,
  storedPermissions: readonly string[] | null | undefined,
  requiredPermission: PermissionKey
): boolean {
  if (!isActive || accessStatus !== 'active' || role === 'none') {
    return false;
  }
  if (role === 'owner') {
    return true;
  }
  const effective = sanitizePermissionsForRole(role, storedPermissions);
  return effective.includes(requiredPermission);
}
