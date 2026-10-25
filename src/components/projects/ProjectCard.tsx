import React, { useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { GithubIcon } from '../common/SocialIcons';
import { ProjectRecord, formatCategoryLabel } from '../../services/supabaseService';

interface ProjectCardProps {
  project: Pick<
    ProjectRecord,
    | 'id'
    | 'title'
    | 'tagline'
    | 'description'
    | 'image_url'
    | 'category'
    | 'technologies'
    | 'live_url'
    | 'source_url'
    | 'status'
  >;
  onSelectDetails?: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelectDetails }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(project.image_url && !imgFailed);
  const technologies = Array.isArray(project.technologies)
    ? project.technologies.filter(Boolean)
    : [];

  return (
    <article className="group bg-slate-950/85 rounded-2xl border border-slate-800/80 hover:border-cyan-500/50 overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/5 backdrop-blur-sm">
      <div>
        {showImage && (
          <div className="relative h-44 w-full overflow-hidden bg-slate-900 border-b border-slate-800/80">
            <img
              src={project.image_url!}
              alt={`${project.title} thumbnail`}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}

        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {formatCategoryLabel(project.category)}
            </span>

            {project.status === 'published' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Published</span>
              </span>
            )}
          </div>

          <h3 className="font-display font-bold text-xl text-white group-hover:text-cyan-300 transition-colors">
            {project.title}
          </h3>

          {project.tagline && (
            <p className="font-mono text-xs text-cyan-400/90 mt-1 line-clamp-1">{project.tagline}</p>
          )}

          <p className="text-slate-400 text-xs sm:text-sm mt-3 leading-relaxed line-clamp-3">
            {project.description}
          </p>

          {technologies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {technologies.slice(0, 6).map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300"
                >
                  {tech}
                </span>
              ))}
              {technologies.length > 6 && (
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-500">
                  +{technologies.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {(onSelectDetails || project.live_url || project.source_url) && (
        <div className="px-6 py-4 border-t border-slate-800/70 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          {onSelectDetails ? (
            <button
              type="button"
              onClick={onSelectDetails}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors"
            >
              <span>View Details</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {project.source_url && (
              <a
                href={project.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-mono transition-colors"
                title="View Source Code"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>Source</span>
              </a>
            )}
            {project.live_url && (
              <a
                href={project.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 text-xs font-mono font-semibold transition-colors"
                title="Open Live Demo"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Live Demo</span>
              </a>
            )}
          </div>
        </div>
      )}
    </article>
  );
};
