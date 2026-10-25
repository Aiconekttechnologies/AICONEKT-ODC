import React, { useState, useEffect } from 'react';
import { BrandLogo } from '../brand/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  User,
  Key,
  Mail,
  X,
  AlertCircle,
  AlertTriangle,
  WifiOff,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  variant?: 'modal' | 'page';
  redirectNotice?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  variant = 'modal',
  redirectNotice = null,
}) => {
  const {
    login,
    registerTeammate,
    completePasswordSetup,
    logout,
    refreshUser,
    user,
    isAuthenticated,
    hasDashboardAccess,
    needsPasswordSetup,
    isConfigured,
    configError,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newInvitePassword, setNewInvitePassword] = useState('');

  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const invitedEmail = params.get('invite')?.trim();
    const invitedName = params.get('name')?.trim();
    if (invitedEmail) {
      setEmail(invitedEmail.toLowerCase());
      if (invitedName) setFullName(invitedName);
      setMode('register');
    }
  }, [isOpen]);

  if (variant === 'modal' && !isOpen) return null;

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setLocalError(null);
    setInfoMessage(null);
    clearAuthError();
    setSubmitting(true);

    try {
      await login({ email, password });
      setPassword('');
      if (onSuccess) onSuccess();
      if (variant === 'modal') onClose();
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setLocalError(null);
    setInfoMessage(null);
    clearAuthError();
    setSubmitting(true);

    try {
      const res = await registerTeammate({
        fullName,
        email,
        password,
      });
      setPassword('');
      if (res.grantedImmediateAccess) {
        if (onSuccess) onSuccess();
        if (variant === 'modal') onClose();
        return;
      }
      setInfoMessage(res.message);
      if (res.requiresEmailConfirmation) {
        setMode('signin');
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setLocalError(null);
    setSubmitting(true);

    try {
      await completePasswordSetup(newInvitePassword);
      setNewInvitePassword('');
      if (onSuccess) onSuccess();
      if (variant === 'modal') onClose();
    } catch (err: any) {
      setLocalError(err?.message || 'Unable to set password.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = localError || authError?.message || null;
  const isNetworkErr = authError?.type === 'network';

  const cardContent = (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 relative shadow-2xl space-y-6">
      {variant === 'modal' && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close portal login dialog"
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800/80 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Brand Lockup */}
      <div className="flex flex-col items-center text-center space-y-2">
        <BrandLogo variant="vertical" size="sm" showTagline={false} />
        <h2 className="font-display font-bold text-xl text-white pt-2">
          {needsPasswordSetup
            ? 'Complete Invitation Setup'
            : mode === 'signin'
            ? 'Dashboard Access Login'
            : 'Request Teammate Access'}
        </h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          {needsPasswordSetup
            ? 'Set a strong password to activate your invited AICONEKT account.'
            : mode === 'signin'
            ? 'Sign in with a CEO-authorized account to access permitted AICONEKT dashboard modules.'
            : 'Register your teammate or student account. Newly registered accounts have zero dashboard access until approved by the CEO.'}
        </p>
      </div>

      {redirectNotice && !isAuthenticated && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
          <span>{redirectNotice}</span>
        </div>
      )}

      {/* Missing Configuration State */}
      {!isConfigured && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-left">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-mono font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Supabase Configuration Required</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            {configError ||
              'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment to enable authentication.'}
          </p>
        </div>
      )}

      {/* Invited User Password Setup Step */}
      {isConfigured && isAuthenticated && needsPasswordSetup ? (
        <form onSubmit={handlePasswordSetupSubmit} className="space-y-4">
          {activeError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Create Your Account Password (Min 8 chars) *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newInvitePassword}
              onChange={(e) => setNewInvitePassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{submitting ? 'Saving Password...' : 'Save Password & Continue'}</span>
          </button>
        </form>
      ) : isConfigured && isAuthenticated && !hasDashboardAccess && user ? (
        /* Signed-in Account Without Active Dashboard Access (Pending / Suspended / Revoked) */
        <div className="space-y-4">
          <div
            className={`p-4 rounded-2xl border space-y-2 text-left ${
              user.accessStatus === 'pending'
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-mono font-bold ${
                user.accessStatus === 'pending' ? 'text-amber-300' : 'text-rose-300'
              }`}
            >
              {user.accessStatus === 'pending' ? (
                <Clock className="w-4 h-4 shrink-0 text-amber-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>
                {user.accessStatus === 'suspended'
                  ? 'Dashboard Access Suspended'
                  : user.accessStatus === 'revoked'
                  ? 'Dashboard Access Revoked'
                  : 'Pending CEO Approval — No Dashboard Access'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Signed in as <strong className="text-white font-mono">{user.email}</strong> (Role:{' '}
              <strong className="text-cyan-300 font-mono">{user.roleLabel}</strong> · Status:{' '}
              <strong className="uppercase font-mono">{user.accessStatus}</strong>).
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {user.accessStatus === 'suspended'
                ? 'Your dashboard permissions are currently suspended. Contact the CEO to reactivate access.'
                : user.accessStatus === 'revoked'
                ? 'Your dashboard access has been revoked.'
                : 'Registered accounts do not receive automatic dashboard access. The CEO must approve your account and grant explicit permissions in Team Access Management.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => void refreshUser()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-check Status</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                setLocalError(null);
                setInfoMessage(null);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 text-xs font-mono font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Website</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mode Switcher: Sign In vs Request Teammate Access */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setLocalError(null);
                clearAuthError();
              }}
              className={`py-2 rounded-lg transition-colors ${
                mode === 'signin'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setLocalError(null);
                clearAuthError();
              }}
              className={`py-2 rounded-lg transition-colors ${
                mode === 'register'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Request Access
            </button>
          </div>

          {infoMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs font-mono">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {activeError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-mono">
              {isNetworkErr ? (
                <WifiOff className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{activeError}</span>
            </div>
          )}

          {mode === 'signin' ? (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-mono text-slate-300 mb-1"
                  htmlFor="portal-login-email"
                >
                  Account Email *
                </label>
                <div className="relative">
                  <input
                    id="portal-login-email"
                    type="email"
                    required
                    autoComplete="email"
                    disabled={!isConfigured || submitting}
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 pr-10 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-mono text-slate-300 mb-1"
                  htmlFor="portal-login-password"
                >
                  Password *
                </label>
                <div className="relative">
                  <input
                    id="portal-login-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    disabled={!isConfigured || submitting}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 pr-10 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                  <Key className="w-4 h-4 text-slate-500 absolute right-3.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isConfigured || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? 'Verifying Credentials...' : 'Sign In to Dashboard'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-mono text-slate-300 mb-1"
                  htmlFor="portal-reg-name"
                >
                  Full Name *
                </label>
                <div className="relative">
                  <input
                    id="portal-reg-name"
                    type="text"
                    required
                    disabled={!isConfigured || submitting}
                    placeholder="Teammate Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 pr-10 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-mono text-slate-300 mb-1"
                  htmlFor="portal-reg-email"
                >
                  Email Address *
                </label>
                <div className="relative">
                  <input
                    id="portal-reg-email"
                    type="email"
                    required
                    autoComplete="email"
                    disabled={!isConfigured || submitting}
                    placeholder="student@campus.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 pr-10 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-mono text-slate-300 mb-1"
                  htmlFor="portal-reg-password"
                >
                  Password (Min 8 chars) *
                </label>
                <div className="relative">
                  <input
                    id="portal-reg-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={!isConfigured || submitting}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 pr-10 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                  <Key className="w-4 h-4 text-slate-500 absolute right-3.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isConfigured || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-bold text-xs font-mono uppercase tracking-wider transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {submitting ? 'Registering Account...' : 'Register & Request CEO Approval'}
                </span>
              </button>
            </form>
          )}

          {variant === 'page' && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Public Website</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (variant === 'page') {
    return (
      <section className="min-h-screen bg-[#030712] pt-28 pb-20 px-4 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-cyan-950/20 via-blue-900/15 to-violet-950/25 blur-[130px] rounded-full pointer-events-none" />
        <div className="relative z-10 w-full flex justify-center">{cardContent}</div>
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      {cardContent}
    </div>
  );
};
