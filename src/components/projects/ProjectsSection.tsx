import React, { useState, useEffect, useCallback } from 'react';
import {
  Filter,
  Zap,
  X,
  FolderGit2,
  AlertCircle,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { GithubIcon } from '../common/SocialIcons';
import { ProjectCard } from './ProjectCard';
import { isSupabaseConfigured, supabaseConfigError } from '../../lib/supabase';
import {
  ProjectRecord,
  fetchPublishedProjects,
  subscribeToPublicContent,
  formatCategoryLabel,
} from '../../services/supabaseService';

export const ProjectsSection: React.FC = () => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeModalProject, setActiveModalProject] = useState<ProjectRecord | null>(null);

  const loadProjects = useCallback(async (showSpinner = false) => {
    if (!isSupabaseConfigured) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);
      setError(null);
      const rows = await fetchPublishedProjects();
      setProjects(rows);
    } catch (err: any) {
      setError(err?.message || 'Unable to load published projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects(true);
    const unsubscribe = subscribeToPublicContent(['projects'], () => {
      void loadProjects(false);
    });
    return unsubscribe;
  }, [loadProjects]);

  const categories = [
    { id: 'all', label: 'All Projects' },
    { id: 'ai-ml', label: 'AI & Machine Learning' },
    { id: 'fullstack', label: 'Full-Stack Systems' },
    { id: 'cloud-devops', label: 'Cloud & Infrastructure' },
    { id: 'research', label: 'Simulation & R&D' },
  ];

  const filteredProjects =
    selectedCategory === 'all'
      ? projects
      : projects.filter((p) => p.category === selectedCategory);

  return (
    <section id="projects" className="py-24 bg-transparent relative min-h-screen">
      {/* Background Decor */}
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-blue-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-900/10 blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        {/* Header */}
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-cyan-400">
            <Zap className="w-3.5 h-3.5" />
            <span>OUR PUBLISHED PROJECTS</span>
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-white">
            Our Projects
          </h2>
          <p className="text-slate-300 text-base leading-relaxed">
            Explore verified open-source frameworks, systems software, and production applications engineered and published by AICONEKT TECHNOLOGIES.
          </p>
        </div>

        {/* Category Filter */}
        {projects.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <Filter className="w-4 h-4 text-slate-500 shrink-0 mr-1" />
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content States */}
        {!isSupabaseConfigured ? (
          <div className="bg-slate-950/60 border border-amber-500/30 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-3">
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
        ) : loading ? (
          <div className="p-16 text-center text-slate-400 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block mr-2"></span>
            Loading published projects...
          </div>
        ) : error ? (
          <div className="bg-slate-950/60 border border-rose-500/30 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-white">Unable to Load Projects</h3>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={() => void loadProjects(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
              <FolderGit2 className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-xl text-white">
              {projects.length === 0
                ? 'Our projects are taking shape.'
                : 'No published projects in this category yet.'}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
              {projects.length === 0
                ? "Our projects are taking shape. Check back soon to explore what we're building."
                : 'Select another category filter to view published initiatives across other domains.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onSelectDetails={() => setActiveModalProject(project)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Project Detail Modal */}
      {activeModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveModalProject(null)}
              aria-label="Close project details"
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            {activeModalProject.image_url && (
              <div className="rounded-xl overflow-hidden border border-slate-800 max-h-60 bg-slate-950">
                <img
                  src={activeModalProject.image_url}
                  alt={activeModalProject.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-mono mb-2">
                <span>{formatCategoryLabel(activeModalProject.category)}</span>
                <span>•</span>
                <span>Published</span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white">{activeModalProject.title}</h3>
              {activeModalProject.tagline && (
                <p className="font-mono text-sm text-cyan-400 mt-1">{activeModalProject.tagline}</p>
              )}
            </div>

            <div className="space-y-2 text-slate-300 text-sm leading-relaxed">
              <p className="whitespace-pre-wrap">{activeModalProject.description}</p>
            </div>

            {activeModalProject.technologies?.length > 0 && (
              <div>
                <div className="font-mono text-xs text-slate-400 mb-2">Technology Stack:</div>
                <div className="flex flex-wrap gap-2">
                  {activeModalProject.technologies.map((tech) => (
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

            {(activeModalProject.live_url || activeModalProject.source_url) && (
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
                {activeModalProject.live_url && (
                  <a
                    href={activeModalProject.live_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Open Live Demo</span>
                  </a>
                )}
                {activeModalProject.source_url && (
                  <a
                    href={activeModalProject.source_url}
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
    </section>
  );
};
