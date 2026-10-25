import React from 'react';
import { BrandLogo } from '../brand/BrandLogo';
import { Mail, Sparkles } from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../common/SocialIcons';

interface FooterProps {
  onSelectTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="bg-[#02050e] border-t border-slate-900 pt-16 pb-12 relative overflow-hidden">
      {/* Precision Accent Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-950/15 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand Info */}
          <div className="md:col-span-5 space-y-4">
            <BrandLogo variant="horizontal" size="md" showTagline={true} />
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm pt-2">
              AICONEKT TECHNOLOGIES is a student-led technology organisation aspiring to grow into a premier
              technology company—engineering open-source software, high-throughput systems, and multimodal AI.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com/Aiconekttechnologies"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                title="GitHub"
              >
                <GithubIcon className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com/company/aiconekt"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                title="LinkedIn"
              >
                <LinkedinIcon className="w-4 h-4" />
              </a>
              <a
                href="mailto:contact@aiconekt.org"
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                title="Email Leadership"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links (Zero Hardcoded Sample Projects/Events) */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="font-mono text-xs text-white uppercase tracking-wider font-semibold">Explore</h4>
            <ul className="space-y-2 text-xs font-mono text-slate-400">
              <li>
                <button type="button" onClick={() => onSelectTab('home')} className="hover:text-cyan-300 transition-colors">
                  Home
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onSelectTab('projects')} className="hover:text-cyan-300 transition-colors">
                  Our Projects
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onSelectTab('events')} className="hover:text-cyan-300 transition-colors">
                  Flagship Events
                </button>
              </li>
            </ul>
          </div>

          {/* Organization */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="font-mono text-xs text-white uppercase tracking-wider font-semibold">Organization</h4>
            <ul className="space-y-2 text-xs font-mono text-slate-400">
              <li>
                <button type="button" onClick={() => onSelectTab('teams')} className="hover:text-cyan-300 transition-colors">
                  Teams & Labs
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onSelectTab('dashboard')} className="hover:text-cyan-300 transition-colors">
                  Admin Dashboard
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onSelectTab('contact')} className="hover:text-cyan-300 transition-colors">
                  Connect & Inquiries
                </button>
              </li>
            </ul>
          </div>

          {/* Technical Philosophy */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-mono text-xs text-white uppercase tracking-wider font-semibold">Technical Standard</h4>
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-900 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Engineered Rather Than Decorated</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Genuine real-time Three.js 3D geometry, PBR titanium/chrome materials, and scroll-linked spatial choreography.
              </p>
            </div>
          </div>
        </div>

        {/* Copyright & Legal */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>
            © {new Date().getFullYear()} AICONEKT TECHNOLOGIES. All rights reserved.
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span>Built by student engineers with</span>
            <span className="text-cyan-400">Three.js</span>
            <span>&</span>
            <span className="text-blue-400">React</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
