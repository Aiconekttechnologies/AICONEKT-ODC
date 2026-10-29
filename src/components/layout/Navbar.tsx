import React, { useState, useEffect } from 'react';
import { BrandLogo } from '../brand/BrandLogo';
import { Menu, X, ShieldCheck, Sparkles, UserCheck, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenJoinModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
  onOpenJoinModal,
}) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'projects', label: 'Our Projects' },
    { id: 'events', label: 'Flagship Events' },
    { id: 'teams', label: 'Teams & Labs' },
    { id: 'leads', label: 'Team Leads' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'contact', label: 'Connect' },
  ];

  const handleSignOut = async () => {
    await logout();
    if (currentTab === 'dashboard' || currentTab === 'login') {
      onSelectTab('home');
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl py-3'
          : 'bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-transparent py-4 sm:py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between min-h-[44px]">
        {/* Brand Logo */}
        <BrandLogo
          variant="horizontal"
          size="sm"
          onClick={() => {
            onSelectTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="group cursor-pointer shrink-0"
        />

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-full border border-slate-800/80 backdrop-blur-md">
          {navLinks.map((link) => {
            const active =
              currentTab === link.id || (link.id === 'dashboard' && currentTab === 'login');
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  onSelectTab(link.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Actions & Portal Access */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenJoinModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Join AICONEKT</span>
          </button>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectTab(isAdmin ? 'dashboard' : 'login')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isAdmin
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 hover:opacity-95 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-900 text-amber-300 border border-amber-500/40 hover:bg-slate-800'
                }`}
                title={`${user.full_name} (${user.roleLabel})`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{user.full_name.split(' ')[0]}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isAdmin ? 'bg-slate-950/20' : 'bg-amber-500/15 text-amber-200'
                  }`}
                >
                  {isAdmin ? user.roleLabel : 'Pending Approval'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="p-1.5 rounded-full text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-violet-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/40 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Admin Login</span>
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="lg:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950/95 border-b border-slate-800 px-4 pt-3 pb-6 mt-3 space-y-2 backdrop-blur-2xl animate-in slide-in-from-top-2 duration-200">
          {navLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => {
                onSelectTab(link.id);
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${
                currentTab === link.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              {link.label}
            </button>
          ))}

          <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                onOpenJoinModal();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-200"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Join Organization</span>
            </button>

            {isAuthenticated && user ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab(isAdmin ? 'dashboard' : 'login');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-md ${
                    isAdmin
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950'
                      : 'bg-slate-900 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isAdmin ? `Dashboard (${user.roleLabel})` : 'Access Status'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="px-4 py-2.5 rounded-lg text-sm bg-slate-900 text-rose-300 border border-rose-500/30"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onOpenAuth();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-300"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Administrator Login</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
