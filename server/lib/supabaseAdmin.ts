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

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
}

export function isServerSupabaseConfigured(): boolean {
  const url = getServerSupabaseUrl();
  const anonOrService = getServiceRoleKey() || getServerAnonKey();
  return Boolean(url && anonOrService && url.startsWith('http'));
}

export function isServiceRoleConfigured(): boolean {
  const url = getServerSupabaseUrl();
  const serviceKey = getServiceRoleKey();
  return Boolean(url && serviceKey && url.startsWith('http') && serviceKey.length > 20);
}

let cachedServiceClient: SupabaseClient | null = null;

/**
 * Trusted server-only Supabase Admin client using SUPABASE_SERVICE_ROLE_KEY.
 * NEVER import this file from frontend code (src/).
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  if (!isServiceRoleConfigured()) return null;
  if (!cachedServiceClient) {
    cachedServiceClient = createClient(getServerSupabaseUrl(), getServiceRoleKey(), {
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
 * so PostgreSQL Row-Level Security (RLS) is enforced for that user.
 */
export function createRequestSupabaseClient(accessToken: string): SupabaseClient | null {
  const url = getServerSupabaseUrl();
  const anonKey = getServerAnonKey() || getServiceRoleKey();
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
