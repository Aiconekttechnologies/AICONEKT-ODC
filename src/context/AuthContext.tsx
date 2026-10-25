import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';
import {
  AccessStatus,
  DashboardRole,
  PermissionKey,
  ROLE_LABELS,
  computeEffectivePermissions,
  evaluatePermission,
} from '../types/rbac';
import {
  AdminUserRecord,
  AppServiceError,
  fetchCurrentAdminRecord,
  subscribeToUserAccessChanges,
} from '../services/supabaseService';

export interface AuthenticatedUserProfile {
  id: string;
  email: string;
  full_name: string;
  role: DashboardRole;
  roleLabel: string;
  accessStatus: AccessStatus;
  permissions: PermissionKey[];
  hasDashboardAccess: boolean;
  isCeo: boolean;
}

export type AuthErrorType =
  | 'config'
  | 'credentials'
  | 'network'
  | 'unauthorized'
  | 'schema'
  | 'unknown';

export interface AuthErrorDetail {
  type: AuthErrorType;
  message: string;
}

interface AuthContextType {
  user: AuthenticatedUserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  hasDashboardAccess: boolean;
  isAdmin: boolean;
  isCeo: boolean;
  needsPasswordSetup: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  configError: string | null;
  authError: AuthErrorDetail | null;
  hasPermission: (permission: PermissionKey) => boolean;
  login: (credentials: { email: string; password: string }) => Promise<AuthenticatedUserProfile>;
  registerTeammate: (input: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<{ requiresEmailConfirmation: boolean; message: string }>;
  completePasswordSetup: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Builds the in-memory profile strictly from the verified database record in public.admin_users.
 * NEVER grants owner or dashboard privileges based on client email comparison or user_metadata!
 */
function buildProfile(
  authUser: SupabaseAuthUser,
  adminRecord: AdminUserRecord | null
): AuthenticatedUserProfile {
  const fallbackName =
    (authUser.user_metadata?.full_name as string | undefined) ||
    authUser.email?.split('@')[0] ||
    'User';

  if (!adminRecord) {
    return {
      id: authUser.id,
      email: (authUser.email || '').toLowerCase(),
      full_name: fallbackName,
      role: 'none',
      roleLabel: ROLE_LABELS.none,
      accessStatus: 'pending',
      permissions: [],
      hasDashboardAccess: false,
      isCeo: false,
    };
  }

  const effectivePermissions = computeEffectivePermissions(
    adminRecord.role,
    adminRecord.access_status,
    adminRecord.is_active,
    adminRecord.permissions
  );

  const isCeo =
    adminRecord.role === 'owner' &&
    adminRecord.access_status === 'active' &&
    adminRecord.is_active === true;

  const hasDashboardAccess =
    adminRecord.access_status === 'active' &&
    adminRecord.is_active === true &&
    adminRecord.role !== 'none' &&
    (isCeo || effectivePermissions.length > 0);

  return {
    id: authUser.id,
    email: (authUser.email || adminRecord.email).toLowerCase(),
    full_name: adminRecord.full_name || fallbackName,
    role: adminRecord.role,
    roleLabel: ROLE_LABELS[adminRecord.role],
    accessStatus: adminRecord.access_status,
    permissions: effectivePermissions,
    hasDashboardAccess,
    isCeo,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<AuthErrorDetail | null>(null);

  const hydrateFromSession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setUser(null);
      return null;
    }

    try {
      const adminRecord = await fetchCurrentAdminRecord(nextSession.user.id);
      const profile = buildProfile(nextSession.user, adminRecord);
      setUser(profile);
      return profile;
    } catch (err: any) {
      const fallbackProfile = buildProfile(nextSession.user, null);
      setUser(fallbackProfile);
      if (err instanceof AppServiceError && err.kind === 'schema_missing') {
        setAuthError({
          type: 'schema',
          message: err.message,
        });
      }
      return fallbackProfile;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setSession(null);
        setUser(null);
        return;
      }
      await hydrateFromSession(data.session);
    } catch {
      setSession(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [hydrateFromSession]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    // Detect invite or recovery URL hash before Supabase clears it
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('type=invite') || hash.includes('type=recovery')) {
        setNeedsPasswordSetup(true);
      }
    }

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (!error) {
          await hydrateFromSession(data.session);
        } else {
          setSession(null);
          setUser(null);
        }
        if (mounted) setIsLoading(false);
      })
      .catch(() => {
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordSetup(true);
      }
      void hydrateFromSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateFromSession]);

  // Live Realtime watcher on public.admin_users so CEO suspension/revocation/role changes apply immediately
  useEffect(() => {
    const activeUserId = session?.user?.id;
    if (!activeUserId) return;

    return subscribeToUserAccessChanges(activeUserId, () => {
      void refreshUser();
    });
  }, [session?.user?.id, refreshUser]);

  const hasPermission = useCallback(
    (permission: PermissionKey): boolean => {
      if (!session || !user) return false;
      return evaluatePermission(
        user.role,
        user.accessStatus,
        user.hasDashboardAccess,
        user.permissions,
        permission
      );
    },
    [session, user]
  );

  const login = async (credentials: {
    email: string;
    password: string;
  }): Promise<AuthenticatedUserProfile> => {
    setAuthError(null);

    if (!isSupabaseConfigured || !supabase) {
      const detail: AuthErrorDetail = {
        type: 'config',
        message:
          supabaseConfigError ||
          'Supabase authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
      setAuthError(detail);
      throw new Error(detail.message);
    }

    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password;

    if (!email || !password) {
      const detail: AuthErrorDetail = {
        type: 'credentials',
        message: 'Email address and password are required.',
      };
      setAuthError(detail);
      throw new Error(detail.message);
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const raw = error.message.toLowerCase();
        if (raw.includes('failed to fetch') || raw.includes('network')) {
          const detail: AuthErrorDetail = {
            type: 'network',
            message:
              'Unable to reach Supabase Auth. Check your network connection and verify VITE_SUPABASE_URL.',
          };
          setAuthError(detail);
          throw new Error(detail.message);
        }

        const detail: AuthErrorDetail = {
          type: 'credentials',
          message: raw.includes('email not confirmed')
            ? 'Email address is not confirmed yet. Check your inbox to verify your account.'
            : 'Invalid email or password. Please verify your credentials.',
        };
        setAuthError(detail);
        throw new Error(detail.message);
      }

      if (!data.session?.user) {
        const detail: AuthErrorDetail = {
          type: 'unknown',
          message: 'Authentication completed without an active session.',
        };
        setAuthError(detail);
        throw new Error(detail.message);
      }

      const profile = await hydrateFromSession(data.session);
      if (!profile?.hasDashboardAccess) {
        const statusReason =
          profile?.accessStatus === 'suspended'
            ? 'Your dashboard access is currently suspended by the CEO.'
            : profile?.accessStatus === 'revoked'
            ? 'Your dashboard access has been revoked.'
            : 'Your account is registered with no dashboard access. Access requires explicit approval and role assignment by the CEO.';

        const detail: AuthErrorDetail = {
          type: 'unauthorized',
          message: statusReason,
        };
        setAuthError(detail);
        throw new Error(detail.message);
      }

      return profile;
    } catch (err: any) {
      if (
        err?.message &&
        (err.message.toLowerCase().includes('failed to fetch') ||
          err.message.toLowerCase().includes('networkerror'))
      ) {
        const detail: AuthErrorDetail = {
          type: 'network',
          message:
            'Network connection failed while contacting Supabase Auth. Check your connection and VITE_SUPABASE_URL.',
        };
        setAuthError(detail);
        throw new Error(detail.message);
      }
      throw err;
    }
  };

  const registerTeammate = async (input: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<{ requiresEmailConfirmation: boolean; message: string }> => {
    setAuthError(null);

    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        supabaseConfigError ||
          'Supabase authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }

    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (fullName.length < 2) {
      throw new Error('Please enter your full name.');
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error('Please enter a valid email address.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo:
          typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.session) {
      await hydrateFromSession(data.session);
      return {
        requiresEmailConfirmation: false,
        message:
          'Account registered with zero default privileges. Your request is now queued for CEO review and role assignment.',
      };
    }

    return {
      requiresEmailConfirmation: true,
      message:
        'Verification email sent. Confirm your email address—once verified, the CEO can review and approve your dashboard access.',
    };
  };

  const completePasswordSetup = async (newPassword: string): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(error.message);
    }
    setNeedsPasswordSetup(false);
    await refreshUser();
  };

  const logout = async () => {
    setAuthError(null);
    setNeedsPasswordSetup(false);
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch((err) => {
        console.error('Supabase signOut error:', err);
      });
    }
    setSession(null);
    setUser(null);
  };

  const clearAuthError = () => setAuthError(null);

  const hasAccess = Boolean(session && user?.hasDashboardAccess);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: Boolean(session && user),
        hasDashboardAccess: hasAccess,
        isAdmin: hasAccess,
        isCeo: Boolean(session && user?.isCeo),
        needsPasswordSetup,
        isLoading,
        isConfigured: isSupabaseConfigured,
        configError: supabaseConfigError,
        authError,
        hasPermission,
        login,
        registerTeammate,
        completePasswordSetup,
        logout,
        refreshUser,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
