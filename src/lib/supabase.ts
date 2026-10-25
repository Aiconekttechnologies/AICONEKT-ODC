import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const rawAnonKey = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  ''
).trim();

function isValidSupabaseUrl(value: string): boolean {
  if (!value) return false;
  if (
    value.includes('your-project-ref') ||
    value.includes('your-project-id') ||
    value.includes('<project') ||
    value === 'https://example.supabase.co'
  ) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidAnonKey(value: string): boolean {
  if (!value || value.length < 20) return false;
  if (
    value.includes('your-supabase-anon') ||
    value.includes('your-anon-key') ||
    value.includes('placeholder')
  ) {
    return false;
  }
  // Guardrail: refuse accidental service_role JWTs if someone pasted the wrong key
  try {
    const parts = value.split('.');
    if (parts.length === 3) {
      const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);
      if (payload?.role === 'service_role') {
        console.error(
          '[Security] Refusing to initialize browser Supabase client with a service_role key. Use VITE_SUPABASE_ANON_KEY (anon/publishable key) only.'
        );
        return false;
      }
    }
  } catch {
    // Non-JWT publishable keys (sb_publishable_*) are valid and do not decode as JWT
  }
  return true;
}

export const isSupabaseConfigured: boolean =
  isValidSupabaseUrl(rawUrl) && isValidAnonKey(rawAnonKey);

export const supabaseConfigError: string | null = isSupabaseConfigured
  ? null
  : !rawUrl && !rawAnonKey
  ? 'Supabase credentials are not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
  : !isValidSupabaseUrl(rawUrl)
  ? 'VITE_SUPABASE_URL is missing or invalid. Provide your Supabase Project URL (https://<project-ref>.supabase.co).'
  : 'VITE_SUPABASE_ANON_KEY is missing or invalid. Provide your public Supabase anon/publishable key (never the service_role key).';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'aiconext_supabase_auth',
      },
    })
  : null;
