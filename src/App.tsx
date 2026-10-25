import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/home/HeroSection';
import { BrandShowcase } from './components/brand/BrandShowcase';
import { ProjectsSection } from './components/projects/ProjectsSection';
import { ProjectCard } from './components/projects/ProjectCard';
import {
  EventsSection,
  formatEventDateDisplay,
  formatEventTimeDisplay,
} from './components/events/EventsSection';
import { TeamsSection } from './components/teams/TeamsSection';
import { ContactSection } from './components/contact/ContactSection';
import { Dashboard } from './components/dashboard/Dashboard';
import { Footer } from './components/layout/Footer';
import { AuthModal } from './components/auth/AuthModal';
import { JoinModal } from './components/teams/JoinModal';
import { BrandLogo } from './components/brand/BrandLogo';
import { GithubIcon } from './components/common/SocialIcons';
import { useAuth } from './context/AuthContext';
import { isSupabaseConfigured, supabaseConfigError } from './lib/supabase';
import {
  EventRecord,
  ProjectRecord,
  fetchPublishedProjects,
  fetchPublishedUpcomingEvents,
  formatCategoryLabel,
  subscribeToPublicContent,
} from './services/supabaseService';
import {
  ArrowRight,
  CheckCircle2,
  FolderGit2,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Globe,
  X,
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    isAuthenticated,
    isAdmin,
    needsPasswordSetup,
    isLoading: authLoading,
    logout,
  } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('home');

  const [homeProjects, setHomeProjects] = useState<ProjectRecord[]>([]);
  const [loadingHomeProjects, setLoadingHomeProjects] = useState<boolean>(isSupabaseConfigured);
  const [homeProjectsError, setHomeProjectsError] = useState<string | null>(null);
  const [selectedHomeProject, setSelectedHomeProject] = useState<ProjectRecord | null>(null);

  const [homeEvents, setHomeEvents] = useState<EventRecord[]>([]);
  const [loadingHomeEvents, setLoadingHomeEvents] = useState<boolean>(isSupabaseConfigured);
  const [homeEventsError, setHomeEventsError] = useState<string | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [loginRedirectNotice, setLoginRedirectNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3200);
  };

  // URL Path Synchronization (Base-aware for GitHub Pages & Server Hosting)
  const getBasePath = useCallback(() => {
    const rawBase = import.meta.env.BASE_URL || '/';
    return rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
  }, []);

  const getNormalizedPath = useCallback(
    (pathname: string) => {
      const base = getBasePath().toLowerCase();
      let path = pathname.toLowerCase();
      if (base && path.startsWith(base)) {
        path = path.slice(base.length);
      }
      if (!path.startsWith('/')) {
        path = '/' + path;
      }
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      return path;
    },
    [getBasePath]
  );

  const handleSelectTab = useCallback(
    (tab: string, replaceHistory = false) => {
      setCurrentTab(tab);
      const base = getBasePath();
      const subPath = tab === 'home' ? '' : `/${tab}`;
      const targetPath = `${base}${subPath}` || '/';
      if (window.location.pathname.toLowerCase() !== targetPath.toLowerCase()) {
        if (replaceHistory) {
          window.history.replaceState(null, '', targetPath);
        } else {
          window.history.pushState(null, '', targetPath);
        }
      }
    },
    [getBasePath]
  );

  useEffect(() => {
    const pathToTabMap: Record<string, string> = {
      '/': 'home',
      '/home': 'home',
      '/projects': 'projects',
      '/innovation': 'projects',
      '/events': 'events',
      '/hackathons': 'events',
      '/teams': 'teams',
      '/labs': 'teams',
      '/brand': 'brand',
      '/identity': 'brand',
      '/login': 'login',
      '/dashboard': 'dashboard',
      '/portal': 'dashboard',
      '/contact': 'contact',
      '/connect': 'contact',
    };

    const initialNormalized = getNormalizedPath(window.location.pathname);
    if (pathToTabMap[initialNormalized]) {
      setCurrentTab(pathToTabMap[initialNormalized]);
    }

    const handlePopState = () => {
      const currentNormalized = getNormalizedPath(window.location.pathname);
      if (pathToTabMap[currentNormalized]) {
        setCurrentTab(pathToTabMap[currentNormalized]);
      } else {
        setCurrentTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getNormalizedPath]);

  // Enforce protected /dashboard route & auto-redirect authenticated admins from /login -> /dashboard
  useEffect(() => {
    if (authLoading) return;

    if (currentTab === 'dashboard' && !isAuthenticated) {
      setLoginRedirectNotice(
        'Administrator authentication is required to access the dashboard.'
      );
      handleSelectTab('login', true);
      return;
    }

    if (currentTab === 'login' && isAuthenticated && isAdmin && !needsPasswordSetup) {
      setLoginRedirectNotice(null);
      handleSelectTab('dashboard', true);
    }
  }, [authLoading, currentTab, isAuthenticated, isAdmin, needsPasswordSetup, handleSelectTab]);

  // Fetch published projects & upcoming events for Home page
  const loadHomeProjects = useCallback(async (showSpinner = false) => {
    if (!isSupabaseConfigured) {
      setHomeProjects([]);
      setLoadingHomeProjects(false);
      return;
    }

    try {
      if (showSpinner) setLoadingHomeProjects(true);
      setHomeProjectsError(null);
      const rows = await fetchPublishedProjects();
      setHomeProjects(rows);
    } catch (err: unknown) {
      setHomeProjectsError(
        err instanceof Error ? err.message : 'Unable to load published projects.'
      );
    } finally {
      setLoadingHomeProjects(false);
    }
  }, []);

  const loadHomeEvents = useCallback(async (showSpinner = false) => {
    if (!isSupabaseConfigured) {
      setHomeEvents([]);
      setLoadingHomeEvents(false);
      return;
    }

    try {
      if (showSpinner) setLoadingHomeEvents(true);
      setHomeEventsError(null);
      const rows = await fetchPublishedUpcomingEvents();
      setHomeEvents(rows);
    } catch (err: unknown) {
      setHomeEventsError(
        err instanceof Error ? err.message : 'Unable to load upcoming flagship events.'
      );
    } finally {
      setLoadingHomeEvents(false);
    }
  }, []);

  useEffect(() => {
    if (currentTab !== 'home') return;

    void loadHomeProjects(true);
    void loadHomeEvents(true);

    const unsubscribe = subscribeToPublicContent(['projects', 'events'], () => {
      void loadHomeProjects(false);
      void loadHomeEvents(false);
    });

    const cutoffTimer = window.setInterval(() => {
      void loadHomeEvents(false);
    }, 60000);

    return () => {
      unsubscribe();
      window.clearInterval(cutoffTimer);
    };
  }, [currentTab, loadHomeProjects, loadHomeEvents]);

  return (
    <div className="bg-[#030712] text-slate-100 min-h-screen selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Global Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => handleSelectTab(tab)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
      />

      {/* Main Tab Routing */}
      <main>
        {currentTab === 'home' && (
          <>
            {/* Cinematic 3D Scroll-Controlled Hero */}
            <HeroSection
              onExploreWork={() => {
                const elem = document.getElementById('featured-work');
                if (elem) elem.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenJoinModal={() => setIsJoinModalOpen(true)}
            />

            {/* Dynamic Read-Only "Our Projects" Section */}
            <section id="featured-work" className="py-20 bg-[#040816] relative border-t border-slate-900">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-cyan-400">
                      Published Engineering Work
                    </div>
                    <h2 className="font-display font-bold text-3xl sm:text-4xl text-white">
                      Our Projects
                    </h2>
                  </div>

                  {homeProjects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectTab('projects');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <span>View All {homeProjects.length} Projects</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {!isSupabaseConfigured ? (
                  <div className="bg-slate-950/60 rounded-3xl border border-amber-500/30 p-10 text-center max-w-2xl mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-white">
                      Database Connection Not Configured
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                      {supabaseConfigError}
                    </p>
                  </div>
                ) : loadingHomeProjects ? (
                  <div className="p-14 text-center text-slate-400 font-mono text-xs">
                    Loading published projects...
                  </div>
                ) : homeProjectsError ? (
                  <div className="bg-slate-950/60 rounded-3xl border border-rose-500/30 p-10 text-center max-w-2xl mx-auto space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-white">
                      Unable to Load Projects
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                      {homeProjectsError}
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadHomeProjects(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : homeProjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {homeProjects.slice(0, 6).map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onSelectDetails={() => setSelectedHomeProject(project)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-950/60 rounded-3xl border border-slate-800/80 p-12 text-center max-w-2xl mx-auto space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400 shadow-inner">
                      <FolderGit2 className="w-7 h-7" />
                    </div>
                    <p className="text-slate-200 text-base font-medium leading-relaxed max-w-lg mx-auto">
                      Our projects are taking shape. Check back soon to explore what we're building.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Preserved Official Company Logo Section */}
            <section className="py-20 bg-gradient-to-r from-slate-950 via-[#070d1e] to-slate-950 border-y border-slate-900 relative overflow-hidden">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
                <div className="bg-slate-950/80 p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center text-center">
                  <BrandLogo variant="full-artwork" size="lg" />
                </div>
              </div>
            </section>

            {/* Read-Only Upcoming Flagship Events Section */}
            <section className="py-20 bg-[#030712]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-cyan-400">
                      Collegiate Arenas & Symposiums
                    </div>
                    <h2 className="font-display font-bold text-3xl sm:text-4xl text-white">
                      Upcoming Flagship Events
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectTab('events');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <span>
                      {homeEvents.length > 0
                        ? `View All ${homeEvents.length} Upcoming Events`
                        : 'View Events Page'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {!isSupabaseConfigured ? (
                  <div className="bg-slate-950/60 rounded-3xl border border-amber-500/30 p-10 text-center max-w-2xl mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-white">
                      Database Connection Not Configured
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                      {supabaseConfigError}
                    </p>
                  </div>
                ) : loadingHomeEvents ? (
                  <div className="p-14 text-center text-slate-400 font-mono text-xs">
                    Loading upcoming flagship events...
                  </div>
                ) : homeEventsError ? (
                  <div className="bg-slate-950/60 rounded-3xl border border-rose-500/30 p-10 text-center max-w-2xl mx-auto space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-white">
                      Unable to Load Events
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                      {homeEventsError}
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadHomeEvents(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : homeEvents.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {homeEvents.slice(0, 4).map((evt) => (
                      <article
                        key={evt.id}
                        className="bg-slate-950 rounded-2xl border border-slate-800/90 hover:border-cyan-500/40 overflow-hidden flex flex-col justify-between transition-all shadow-lg"
                      >
                        <div>
                          {evt.image_url && (
                            <div className="h-48 w-full overflow-hidden bg-slate-900 border-b border-slate-800">
                              <img
                                src={evt.image_url}
                                alt={evt.title}
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div className="p-8 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                              <span className="text-cyan-300 font-semibold">{evt.category}</span>
                              <span className="text-slate-400">
                                {formatEventDateDisplay(evt.event_date)}
                              </span>
                            </div>

                            <div>
                              <h3 className="font-display font-bold text-2xl text-white">
                                {evt.title}
                              </h3>
                              {evt.tagline && (
                                <p className="font-mono text-xs text-cyan-400 mt-1">{evt.tagline}</p>
                              )}
                            </div>

                            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                              {evt.description}
                            </p>

                            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                              {formatEventTimeDisplay(evt.event_date) && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                                  {formatEventTimeDisplay(evt.event_date)}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-violet-400" />
                                {evt.location}
                                {evt.is_virtual ? ' (Online)' : ''}
                              </span>
                              {evt.prize_pool && (
                                <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                  {evt.prize_pool}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {evt.registration_url && (
                          <div className="px-8 pb-8 pt-2">
                            <a
                              href={evt.registration_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 transition-all"
                            >
                              <span>Register Now</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-950/60 rounded-3xl border border-slate-800/80 p-12 text-center max-w-2xl mx-auto space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400 shadow-inner">
                      <Calendar className="w-7 h-7" />
                    </div>
                    <h3 className="font-display font-bold text-xl text-white">
                      No Upcoming Flagship Events
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
                      Upcoming hackathons, technical workshops, and symposiums will appear here once published.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {currentTab === 'projects' && <ProjectsSection />}

        {currentTab === 'events' && <EventsSection />}

        {currentTab === 'teams' && <TeamsSection />}

        {currentTab === 'brand' && <BrandShowcase />}

        {currentTab === 'login' && (
          <AuthModal
            isOpen={true}
            variant="page"
            redirectNotice={loginRedirectNotice}
            onClose={() => {
              setLoginRedirectNotice(null);
              handleSelectTab('home');
            }}
            onSuccess={() => {
              setLoginRedirectNotice(null);
              showToast('Signed into administrator dashboard.');
              handleSelectTab('dashboard');
            }}
          />
        )}

        {currentTab === 'dashboard' && (
          <>
            {authLoading ? (
              <section className="min-h-screen bg-[#030712] flex items-center justify-center pt-20">
                <div className="text-center font-mono text-xs text-slate-400">
                  Verifying administrator session...
                </div>
              </section>
            ) : !isAuthenticated ? (
              <AuthModal
                isOpen={true}
                variant="page"
                redirectNotice="Administrator authentication is required to access the dashboard."
                onClose={() => handleSelectTab('home')}
                onSuccess={() => {
                  showToast('Signed into administrator dashboard.');
                  handleSelectTab('dashboard');
                }}
              />
            ) : !isAdmin || needsPasswordSetup ? (
              <AuthModal
                isOpen={true}
                variant="page"
                onClose={() => handleSelectTab('home')}
                onSuccess={() => {
                  showToast('Dashboard access verified.');
                  handleSelectTab('dashboard');
                }}
              />
            ) : (
              <Dashboard
                onLogout={async () => {
                  await logout();
                  handleSelectTab('home');
                  showToast('Signed out of administrator dashboard.');
                }}
              />
            )}
          </>
        )}

        {currentTab === 'contact' && <ContactSection />}
      </main>

      {/* Global Footer */}
      <Footer
        onSelectTab={(tab) => {
          handleSelectTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Home Project Details Modal */}
      {selectedHomeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedHomeProject(null)}
              aria-label="Close project details"
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            {selectedHomeProject.image_url && (
              <div className="rounded-xl overflow-hidden border border-slate-800 max-h-60 bg-slate-950">
                <img
                  src={selectedHomeProject.image_url}
                  alt={selectedHomeProject.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <div className="text-xs font-mono text-cyan-400 mb-1">
                {formatCategoryLabel(selectedHomeProject.category)} · Published
              </div>
              <h3 className="font-display font-bold text-2xl text-white">
                {selectedHomeProject.title}
              </h3>
              {selectedHomeProject.tagline && (
                <p className="font-mono text-sm text-cyan-400 mt-1">
                  {selectedHomeProject.tagline}
                </p>
              )}
            </div>

            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
              {selectedHomeProject.description}
            </p>

            {selectedHomeProject.technologies?.length > 0 && (
              <div>
                <div className="font-mono text-xs text-slate-400 mb-2">Technology Stack:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedHomeProject.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(selectedHomeProject.live_url || selectedHomeProject.source_url) && (
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
                {selectedHomeProject.live_url && (
                  <a
                    href={selectedHomeProject.live_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Open Live Demo</span>
                  </a>
                )}
                {selectedHomeProject.source_url && (
                  <a
                    href={selectedHomeProject.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 hover:border-cyan-500/40 text-xs font-mono transition-colors"
                  >
                    <GithubIcon className="w-3.5 h-3.5" />
                    <span>View Source Code</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          showToast('Signed into administrator dashboard.');
          handleSelectTab('dashboard');
        }}
      />

      <JoinModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onApply={(app) => {
          showToast(`Membership application recorded for ${app.name}`);
        }}
      />

      {/* Global Floating Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 border border-cyan-500/60 text-white text-xs font-mono shadow-2xl shadow-cyan-500/20 animate-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
