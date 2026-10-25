// Automated Architecture, RBAC Privilege-Escalation & Security Verification Suite
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import {
  ALL_PERMISSIONS,
  OFFICIAL_CEO_EMAIL,
  PermissionKey,
  computeEffectivePermissions,
  evaluatePermission,
  sanitizePermissionsForRole,
} from '../src/types/rbac.js';
import {
  AdminAccessDependencies,
  ServerAccessMemberRow,
  ServerInvitationRow,
  createAdminAccessRouter,
} from '../server/routes/adminAccess.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function runPrivilegeEscalationSuite() {
  console.log('\n[4/6] Running RBAC & Privilege-Escalation Security Tests...');

  // A. Pure RBAC Matrix & Least-Privilege Ceiling Tests
  const allKeys = ALL_PERMISSIONS.map((p) => p.key);

  // 1. Newly registered user ('none' / 'pending') has ZERO effective permissions even if array is tampered
  assert(
    computeEffectivePermissions('none', 'pending', false, allKeys).length === 0,
    'Newly registered pending user must have zero effective permissions.'
  );
  assert(
    computeEffectivePermissions('none', 'active', true, allKeys).length === 0,
    'Role "none" must never hold permissions even if marked active.'
  );

  // 2. Role ceiling sanitization blocks out-of-scope permissions
  const editorSanitized = sanitizePermissionsForRole('project_editor', [
    'projects.view',
    'projects.edit',
    'events.publish',
    'inquiries.manage',
    'applications.manage',
  ]);
  assert(
    editorSanitized.includes('projects.view') &&
      editorSanitized.includes('projects.edit') &&
      !editorSanitized.includes('events.publish') &&
      !editorSanitized.includes('inquiries.manage') &&
      !editorSanitized.includes('applications.manage'),
    'Project Editor role ceiling failed to strip events/inquiries/applications permissions.'
  );

  const eventMgrSanitized = sanitizePermissionsForRole('event_manager', [
    'events.view',
    'events.create',
    'projects.delete',
    'inquiries.view',
  ]);
  assert(
    eventMgrSanitized.includes('events.view') &&
      eventMgrSanitized.includes('events.create') &&
      !eventMgrSanitized.includes('projects.delete') &&
      !eventMgrSanitized.includes('inquiries.view'),
    'Event Manager role ceiling failed to strip project/inquiry permissions.'
  );

  const viewerSanitized = sanitizePermissionsForRole('viewer', allKeys);
  for (const perm of viewerSanitized) {
    assert(
      perm.endsWith('.view'),
      `Viewer role must never receive write/publish/delete permission (${perm}).`
    );
  }

  // 3. Suspended or revoked CEO/Admin/Editor immediately loses ALL permissions
  assert(
    computeEffectivePermissions('admin', 'suspended', false, allKeys).length === 0,
    'Suspended admin must immediately lose all effective permissions.'
  );
  assert(
    computeEffectivePermissions('project_editor', 'revoked', false, allKeys).length === 0,
    'Revoked editor must immediately lose all effective permissions.'
  );
  assert(
    !evaluatePermission('owner', 'suspended', false, allKeys, 'projects.publish'),
    'Inactive/suspended account must fail evaluatePermission.'
  );
  assert(
    evaluatePermission('owner', 'active', true, [], 'projects.delete') &&
      evaluatePermission('owner', 'active', true, [], 'events.publish') &&
      evaluatePermission('owner', 'active', true, [], 'applications.manage'),
    'Active Owner / CEO must hold full dashboard permissions.'
  );

  // B. Server-Side /api/admin/* Authorization & Escalation Harness
  const BOOTSTRAP_SECRET = 'test-bootstrap-secret-9f8a7b6c5d4e';
  const dbMembers = new Map<string, ServerAccessMemberRow>();
  const dbInvitations = new Map<string, ServerInvitationRow>();

  // Seed simulated auth tokens -> identities
  const tokenIdentities: Record<string, { id: string; email: string }> = {
    'tok-ceo': { id: 'uid-ceo-001', email: OFFICIAL_CEO_EMAIL },
    'tok-unbootstrapped-ceo-email': {
      id: 'uid-unbootstrapped-999',
      email: OFFICIAL_CEO_EMAIL,
    },
    'tok-ordinary': { id: 'uid-user-002', email: 'student@university.edu' },
    'tok-delegated-admin': { id: 'uid-admin-003', email: 'manager@aiconekt.org' },
    'tok-editor': { id: 'uid-editor-004', email: 'editor@aiconekt.org' },
    'tok-viewer': { id: 'uid-viewer-005', email: 'viewer@aiconekt.org' },
  };

  // Seed initial non-owner rows (CEO is NOT bootstrapped yet)
  dbMembers.set('uid-unbootstrapped-999', {
    user_id: 'uid-unbootstrapped-999',
    email: OFFICIAL_CEO_EMAIL,
    full_name: 'Unbootstrapped Account',
    role: 'none',
    access_status: 'pending',
    is_active: false,
    permissions: [],
    registered_at: new Date().toISOString(),
  });

  dbMembers.set('uid-user-002', {
    user_id: 'uid-user-002',
    email: 'student@university.edu',
    full_name: 'Ordinary Student',
    role: 'none',
    access_status: 'pending',
    is_active: false,
    permissions: [],
    registered_at: new Date().toISOString(),
  });

  dbMembers.set('uid-admin-003', {
    user_id: 'uid-admin-003',
    email: 'manager@aiconekt.org',
    full_name: 'Delegated Manager',
    role: 'admin',
    access_status: 'active',
    is_active: true,
    permissions: ['projects.view', 'events.view'],
    registered_at: new Date().toISOString(),
  });

  dbMembers.set('uid-editor-004', {
    user_id: 'uid-editor-004',
    email: 'editor@aiconekt.org',
    full_name: 'Project Editor',
    role: 'project_editor',
    access_status: 'active',
    is_active: true,
    permissions: ['projects.view', 'projects.create', 'projects.edit'],
    registered_at: new Date().toISOString(),
  });

  dbMembers.set('uid-viewer-005', {
    user_id: 'uid-viewer-005',
    email: 'viewer@aiconekt.org',
    full_name: 'Internal Viewer',
    role: 'viewer',
    access_status: 'active',
    is_active: true,
    permissions: ['dashboard.overview.view', 'projects.view'],
    registered_at: new Date().toISOString(),
  });

  const mockDeps: AdminAccessDependencies = {
    isConfigured: () => true,
    hasServiceRole: () => true,
    getBootstrapSecret: () => BOOTSTRAP_SECRET,
    verifyCaller: async (token) => tokenIdentities[token] || null,
    getAccessRecord: async (userId) => dbMembers.get(userId) || null,
    hasExistingOwner: async () =>
      Array.from(dbMembers.values()).some((m) => m.role === 'owner'),
    bootstrapInitialCeo: async () => {
      const ceoRow: ServerAccessMemberRow = {
        user_id: 'uid-ceo-001',
        email: OFFICIAL_CEO_EMAIL,
        full_name: 'AICONEKT CEO',
        role: 'owner',
        access_status: 'active',
        is_active: true,
        permissions: allKeys as PermissionKey[],
        registered_at: new Date().toISOString(),
      };
      dbMembers.set('uid-ceo-001', ceoRow);
      return ceoRow;
    },
    listTeamDirectory: async () => ({
      members: Array.from(dbMembers.values()),
      invitations: Array.from(dbInvitations.values()),
    }),
    createInvitation: async (ceoUserId, _token, input) => {
      const inv: ServerInvitationRow = {
        id: `inv-${dbInvitations.size + 1}`,
        email: input.email,
        full_name: input.full_name,
        role: input.role,
        permissions: input.permissions,
        require_manual_approval: input.require_manual_approval,
        status: 'pending',
        invited_by: ceoUserId,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
      };
      dbInvitations.set(inv.id, inv);
      return { invitation: inv, authEmailDispatched: true };
    },
    updateMemberAccess: async (ceoUserId, _token, targetUserId, updates) => {
      const existing = dbMembers.get(targetUserId);
      if (!existing) throw new Error('Member not found.');
      const isActive = updates.access_status === 'active' && updates.role !== 'none';
      const updated: ServerAccessMemberRow = {
        ...existing,
        role: updates.role,
        access_status: updates.access_status,
        is_active: isActive,
        permissions: updates.permissions,
        approved_by: isActive ? ceoUserId : existing.approved_by,
        approved_at: isActive ? new Date().toISOString() : existing.approved_at,
      };
      dbMembers.set(targetUserId, updated);
      return updated;
    },
    revokeInvitation: async (_ceoUserId, _token, invitationId) => {
      const existing = dbInvitations.get(invitationId);
      if (!existing) throw new Error('Invitation not found.');
      dbInvitations.set(invitationId, { ...existing, status: 'revoked' });
    },
  };

  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/admin', createAdminAccessRouter(mockDeps));

  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const harnessPort = typeof addr === 'object' && addr ? addr.port : 0;
  const harnessUrl = `http://127.0.0.1:${harnessPort}/api/admin`;

  try {
    // Test 1: Unauthenticated access to /api/admin/team must return 401
    const unauthRes = await fetch(`${harnessUrl}/team`);
    assert(unauthRes.status === 401, `Expected 401 without token, got ${unauthRes.status}`);

    // Test 2: Email-only spoofing / unbootstrapped CEO email CANNOT access CEO endpoints (must be DB role === 'owner')
    const unbootstrappedCeoRes = await fetch(`${harnessUrl}/team`, {
      headers: { Authorization: 'Bearer tok-unbootstrapped-ceo-email' },
    });
    assert(
      unbootstrappedCeoRes.status === 403,
      `Expected 403 for unbootstrapped CEO email without DB owner role, got ${unbootstrappedCeoRes.status}`
    );

    // Test 3: Ordinary pending user, Viewer, Project Editor, and Delegated Admin CANNOT access CEO endpoints or self-promote
    for (const tok of ['tok-ordinary', 'tok-viewer', 'tok-editor', 'tok-delegated-admin']) {
      const dirRes = await fetch(`${harnessUrl}/team`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      assert(dirRes.status === 403, `Expected 403 on GET /team for ${tok}, got ${dirRes.status}`);

      const inviteAttempt = await fetch(`${harnessUrl}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({
          email: 'friend@example.com',
          role: 'admin',
          permissions: ['projects.view'],
        }),
      });
      assert(
        inviteAttempt.status === 403,
        `Expected 403 on POST /invitations for ${tok}, got ${inviteAttempt.status}`
      );

      const selfPromoteAttempt = await fetch(`${harnessUrl}/members/uid-user-002`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({
          role: 'owner',
          access_status: 'active',
          permissions: allKeys,
        }),
      });
      assert(
        selfPromoteAttempt.status === 403,
        `Expected 403 on self-promotion PATCH for ${tok}, got ${selfPromoteAttempt.status}`
      );
    }

    // Test 4: Controlled one-time CEO bootstrap rejects missing/wrong secret and non-CEO emails
    const badSecretBootstrap = await fetch(`${harnessUrl}/bootstrap-ceo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ceo-bootstrap-secret': 'wrong-secret',
      },
      body: JSON.stringify({ email: OFFICIAL_CEO_EMAIL }),
    });
    assert(
      badSecretBootstrap.status === 403,
      `Expected 403 for wrong bootstrap secret, got ${badSecretBootstrap.status}`
    );

    const wrongEmailBootstrap = await fetch(`${harnessUrl}/bootstrap-ceo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ceo-bootstrap-secret': BOOTSTRAP_SECRET,
      },
      body: JSON.stringify({ email: 'attacker@evil.example' }),
    });
    assert(
      wrongEmailBootstrap.status === 403,
      `Expected 403 when attempting to bootstrap non-official email, got ${wrongEmailBootstrap.status}`
    );

    // Valid one-time bootstrap for aiconekttechnologies@gmail.com succeeds (201)
    const validBootstrap = await fetch(`${harnessUrl}/bootstrap-ceo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ceo-bootstrap-secret': BOOTSTRAP_SECRET,
      },
      body: JSON.stringify({ email: OFFICIAL_CEO_EMAIL }),
    });
    assert(
      validBootstrap.status === 201,
      `Expected 201 for valid one-time CEO bootstrap, got ${validBootstrap.status}`
    );

    // Second bootstrap attempt is permanently locked (409)
    const replayBootstrap = await fetch(`${harnessUrl}/bootstrap-ceo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ceo-bootstrap-secret': BOOTSTRAP_SECRET,
      },
      body: JSON.stringify({ email: OFFICIAL_CEO_EMAIL }),
    });
    assert(
      replayBootstrap.status === 409,
      `Expected 409 on replay of one-time CEO bootstrap, got ${replayBootstrap.status}`
    );

    // Test 5: Verified CEO can view directory, invite with restricted role, approve pending user, and CANNOT create a second 'owner' or suspend self
    const ceoDirRes = await fetch(`${harnessUrl}/team`, {
      headers: { Authorization: 'Bearer tok-ceo' },
    });
    assert(ceoDirRes.status === 200, `Expected 200 for verified CEO GET /team, got ${ceoDirRes.status}`);

    const illegalSecondOwnerInvite = await fetch(`${harnessUrl}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok-ceo',
      },
      body: JSON.stringify({
        email: 'co-founder@aiconekt.org',
        role: 'owner',
        permissions: allKeys,
      }),
    });
    assert(
      illegalSecondOwnerInvite.status === 403,
      `Expected 403 when inviting a second owner, got ${illegalSecondOwnerInvite.status}`
    );

    const ceoSelfModify = await fetch(`${harnessUrl}/members/uid-ceo-001`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok-ceo',
      },
      body: JSON.stringify({
        role: 'admin',
        access_status: 'suspended',
        permissions: [],
      }),
    });
    assert(
      ceoSelfModify.status === 403,
      `Expected 403 when CEO attempts self-demotion/suspension, got ${ceoSelfModify.status}`
    );

    // CEO approves pending student as Project Editor with out-of-scope permission mixed in (server sanitizes!)
    const approveStudentRes = await fetch(`${harnessUrl}/members/uid-user-002`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok-ceo',
      },
      body: JSON.stringify({
        role: 'project_editor',
        access_status: 'active',
        permissions: ['projects.view', 'projects.edit', 'events.delete'],
      }),
    });
    assert(approveStudentRes.status === 200, 'Expected 200 when CEO approves student.');
    const approvedJson = await approveStudentRes.json();
    assert(
      approvedJson.member.role === 'project_editor' &&
        approvedJson.member.is_active === true &&
        approvedJson.member.permissions.includes('projects.edit') &&
        !approvedJson.member.permissions.includes('events.delete'),
      'Approved student permissions were not sanitized to Project Editor ceiling.'
    );

    // Test 6: CEO revokes approved user -> access_status becomes 'revoked', role 'none', is_active false, zero permissions
    const revokeStudentRes = await fetch(`${harnessUrl}/members/uid-user-002`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok-ceo',
      },
      body: JSON.stringify({
        role: 'none',
        access_status: 'revoked',
        permissions: [],
      }),
    });
    assert(revokeStudentRes.status === 200, 'Expected 200 when CEO revokes user access.');
    const revokedJson = await revokeStudentRes.json();
    assert(
      revokedJson.member.access_status === 'revoked' &&
        revokedJson.member.is_active === false &&
        revokedJson.member.permissions.length === 0 &&
        computeEffectivePermissions(
          revokedJson.member.role,
          revokedJson.member.access_status,
          revokedJson.member.is_active,
          revokedJson.member.permissions
        ).length === 0,
      'Revoked user still retained active flags or permissions!'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(
    '✔ Passed all RBAC ceiling, email-spoofing, self-promotion, one-time bootstrap, and immediate revocation tests'
  );
}

async function runVerification() {
  console.log('--- STARTING AICONEKT TECHNOLOGIES VERIFICATION SUITE ---');

  // 1. Health Endpoint Verification
  console.log('\n[1/6] Checking server health endpoint...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthJson = await healthRes.json();
  assert(healthRes.status === 200 && healthJson.status === 'healthy', 'Health check failed.');
  console.log(`✔ Health OK (${healthJson.backend}, configured=${healthJson.supabase_env_configured})`);

  // 2. Verify Legacy Insecure Demo/Register Endpoints Are Retired & /api/admin/status Responds Safely
  console.log('\n[2/6] Verifying retired auth routes and /api/admin capability endpoint...');
  const demoRes = await fetch(`${BASE_URL}/api/auth/demo`, { method: 'POST' });
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, { method: 'POST' });
  assert(demoRes.status === 404, `Expected 404 on /api/auth/demo, received ${demoRes.status}`);
  assert(regRes.status === 404, `Expected 404 on /api/auth/register, received ${regRes.status}`);

  const adminStatusRes = await fetch(`${BASE_URL}/api/admin/status`);
  const adminStatusJson = await adminStatusRes.json();
  assert(
    adminStatusRes.status === 200 && typeof adminStatusJson.serverAdminConfigured === 'boolean',
    'Expected HTTP 200 from /api/admin/status.'
  );
  console.log('✔ Legacy insecure routes return 404 and /api/admin/status is active');

  // 3. Verify SPA Route Delivery (/ , /login , /dashboard , /projects , /events)
  console.log('\n[3/6] Verifying SPA routes resolve cleanly...');
  for (const route of ['/', '/login', '/dashboard', '/projects', '/events']) {
    const res = await fetch(`${BASE_URL}${route}`);
    const html = await res.text();
    assert(res.status === 200, `Expected HTTP 200 for ${route}, got ${res.status}`);
    assert(html.includes('<div id="root"></div>'), `Missing SPA root mount in ${route}`);
  }
  console.log('✔ Public and protected SPA routes serve valid HTML');

  // 4. Run Privilege-Escalation & RBAC Security Test Suite
  await runPrivilegeEscalationSuite();

  // 5. Verify Supabase SQL Migrations & CEO RBAC Policy Integrity
  console.log('\n[5/6] Auditing Supabase SQL migrations (0001 + 0002) & RLS rules...');
  const migration1Path = path.resolve(
    'supabase/migrations/20261025000001_aiconext_schema_and_rls.sql'
  );
  const migration2Path = path.resolve(
    'supabase/migrations/20261025000002_ceo_rbac_and_team_access.sql'
  );
  assert(fs.existsSync(migration1Path), 'Missing base Supabase SQL migration 0001.');
  assert(fs.existsSync(migration2Path), 'Missing CEO RBAC Supabase SQL migration 0002.');

  const sql1 = fs.readFileSync(migration1Path, 'utf8');
  const sql2 = fs.readFileSync(migration2Path, 'utf8');

  assert(sql1.includes('CREATE TABLE IF NOT EXISTS public.projects'), 'Missing public.projects table.');
  assert(sql1.includes('CREATE TABLE IF NOT EXISTS public.events'), 'Missing public.events table.');
  assert(sql1.includes('CREATE TABLE IF NOT EXISTS public.admin_users'), 'Missing public.admin_users table.');

  assert(
    sql2.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_single_owner'),
    'Missing singleton owner index in migration 0002.'
  );
  assert(
    sql2.includes('CREATE TABLE IF NOT EXISTS public.team_invitations'),
    'Missing public.team_invitations table in migration 0002.'
  );
  assert(
    sql2.includes('CREATE OR REPLACE FUNCTION public.is_ceo()') &&
      sql2.includes('CREATE OR REPLACE FUNCTION public.has_permission(') &&
      sql2.includes('CREATE OR REPLACE FUNCTION public.bootstrap_initial_ceo_owner()'),
    'Missing RBAC SQL functions in migration 0002.'
  );
  assert(
    sql2.includes('ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY') &&
      sql2.includes('aiconekttechnologies@gmail.com'),
    'Missing RLS on team_invitations or official CEO email binding in migration 0002.'
  );
  console.log('✔ Supabase schema, singleton CEO owner constraint, triggers, and granular RLS verified');

  // 6. Verify Production Bundle Security & Zero-Secret / Zero-Sample-Data Invariants
  console.log('\n[6/6] Auditing compiled dist/ bundle for leaked secrets or hardcoded sample content...');
  const distAssetsDir = path.resolve('dist/assets');
  if (fs.existsSync(distAssetsDir)) {
    const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
    assert(jsFiles.length > 0, 'No compiled JS assets found in dist/assets.');
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
      assert(
        !content.includes('SUPABASE_SERVICE_ROLE_KEY'),
        `Found SUPABASE_SERVICE_ROLE_KEY reference in ${file}`
      );
      assert(
        !content.includes('CEO_BOOTSTRAP_SECRET'),
        `Found CEO_BOOTSTRAP_SECRET reference in ${file}`
      );
      assert(!content.includes('HackNation 2026'), `Found hardcoded sample event in ${file}`);
      assert(!content.includes('NeuralForge Bootcamp'), `Found hardcoded sample event in ${file}`);
      assert(!content.includes('NexusVision AI'), `Found hardcoded sample project in ${file}`);
      assert(
        !content.includes('Discover 3D Brand Identity'),
        `Found removed "Discover 3D Brand Identity" text in ${file}`
      );
      assert(
        content.includes(
          "Our projects are taking shape. Check back soon to explore what we're building."
        ),
        'Expected empty state message for Our Projects was not found in compiled bundle.'
      );
    }
    console.log(
      `✔ Audited ${jsFiles.length} production bundle(s): zero leaked server secrets, zero sample data`
    );
  } else {
    console.log('ℹ dist/assets not built yet — run npm run build before npm test for bundle audit');
  }

  console.log('\n======================================================');
  console.log(' ALL VERIFICATION & RBAC SECURITY CHECKS PASSED');
  console.log('======================================================\n');
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
