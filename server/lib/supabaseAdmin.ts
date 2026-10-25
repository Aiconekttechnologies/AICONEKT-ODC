import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getServerSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    ''
  );
}

function getServerAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ''
  );
}

function getRawServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
}

let warnedInvalidServiceKey = false;

/**
 * Validates that a key is genuinely a server-side Supabase secret / service_role key
 * and NOT an accidental public/publishable (`sb_publishable_*` or `role: "anon"`) key.
 */
export function isValidServiceRoleKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length < 25) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('placeholder') ||
    lower.includes('your-service-role') ||
    lower.includes('your_service_role')
  ) {
    return false;
  }

  // Reject public publishable keys explicitly
  if (trimmed.startsWith('sb_publishable_')) {
    return false;
  }

  // Modern Supabase secret key format
  if (trimmed.startsWith('sb_secret_')) {
    return true;
  }

  // Legacy JWT format: verify payload role === 'service_role'
  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);
      return payload?.role === 'service_role';
    } catch {
      return false;
    }
  }

  return false;
}

export function isServerSupabaseConfigured(): boolean {
  const url = getServerSupabaseUrl();
  const hasUsableKey = Boolean(getServerAnonKey() || isValidServiceRoleKey(getRawServiceRoleKey()));
  return Boolean(url && hasUsableKey && url.startsWith('http'));
}

export function isServiceRoleConfigured(): boolean {
  const url = getServerSupabaseUrl();
  const rawKey = getRawServiceRoleKey();
  if (!url || !url.startsWith('http') || !rawKey) return false;

  const valid = isValidServiceRoleKey(rawKey);
  if (!valid && !warnedInvalidServiceKey) {
    warnedInvalidServiceKey = true;
    console.warn(
      '[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is not a valid secret/service_role key (detected publishable or non-service key). Falling back to caller-scoped JWT + PostgreSQL RLS.'
    );
  }
  return valid;
}

let cachedServiceClient: SupabaseClient | null = null;
let cachedServiceClientKey = '';

/**
 * Trusted server-only Supabase Admin client using a verified SUPABASE_SERVICE_ROLE_KEY.
 * Returns null if SUPABASE_SERVICE_ROLE_KEY is unset or set to a publishable/anon key.
 * NEVER import this file from frontend code (src/).
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  if (!isServiceRoleConfigured()) return null;
  const currentKey = getRawServiceRoleKey();
  if (!cachedServiceClient || cachedServiceClientKey !== currentKey) {
    cachedServiceClientKey = currentKey;
    cachedServiceClient = createClient(getServerSupabaseUrl(), currentKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return cachedServiceClient;
}

/**
 * Creates a request-scoped Supabase client bound to the caller's Bearer JWT
 * so PostgreSQL Row-Level Security (RLS) is enforced for that authenticated user.
 */
export function createRequestSupabaseClient(accessToken: string): SupabaseClient | null {
  const url = getServerSupabaseUrl();
  // If someone placed a publishable key in SUPABASE_SERVICE_ROLE_KEY and left ANON empty,
  // allow getServerAnonKey() first, or a publishable key fallback for user-JWT RLS requests.
  const rawSvc = getRawServiceRoleKey();
  const anonKey =
    getServerAnonKey() || (rawSvc.startsWith('sb_publishable_') ? rawSvc : '');

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
