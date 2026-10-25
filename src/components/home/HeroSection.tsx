import React from 'react';
import { Aiconekt3DScene } from '../three/Aiconekt3DScene';
import { ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onExploreWork: () => void;
  onOpenJoinModal?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreWork,
}) => {
  return (
    <section className="relative min-h-[115vh] w-full flex flex-col justify-between pt-24 pb-12 overflow-hidden bg-[#030712]">
      {/* Background Cinematic Atmosphere & Grid */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Deep radial midnight navy & violet atmospheric glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[900px] h-[500px] bg-gradient-to-tr from-cyan-950/20 via-blue-900/15 to-violet-950/25 blur-[140px] rounded-full" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-900/10 blur-[120px] rounded-full" />
        <div className="absolute top-40 right-10 w-80 h-80 bg-violet-900/10 blur-[110px] rounded-full" />

        {/* Precision Architectural Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Subtle Horizontal Tech Laser Lines */}
        <div className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        <div className="absolute bottom-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/15 to-transparent" />
      </div>

      {/* Main Hero Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-8 sm:pt-12">
          {/* Left Column: Brand Typography & Action Hierarchy */}
          <div className="lg:col-span-7 flex flex-col items-start text-left z-20 space-y-6">
            {/* Eyebrow Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300 backdrop-blur-md shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse"></span>
              <span className="tracking-wider uppercase text-[#FFA028] font-semibold">AICONEKT TECHNOLOGIES</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">STUDENT-LED INNOVATION HUB</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display font-bold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white leading-[1.08]">
              Engineering <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-red-500">
                What’s Next.
              </span>
            </h1>

            {/* Official Tagline & Value Proposition */}
            <div className="space-y-3 max-w-xl">
              <p className="font-mono text-xs sm:text-sm tracking-[0.25em] text-[#FF451A] font-bold uppercase drop-shadow-[0_0_10px_rgba(255,69,26,0.3)]">
                CONNECT IDEAS. CREATE IMPACT.
              </p>
              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
                We are a student-led technology organisation aspiring to grow into a premier technology company—engineering
                high-performance software, multimodal AI models, distributed cloud architectures, and meaningful digital solutions.
              </p>
            </div>

            {/* Primary Action Button */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onExploreWork}
                className="group flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 text-slate-950 hover:opacity-95 shadow-lg shadow-cyan-500/25 transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <span>Explore Our Projects</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Engineering Focus Pillars */}
            <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full border-t border-slate-800/80">
              <div>
                <div className="font-display font-bold text-lg text-white">Multimodal AI</div>
                <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Edge & Vision R&D</div>
              </div>
              <div>
                <div className="font-display font-bold text-lg text-cyan-400">Systems</div>
                <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Distributed Clouds</div>
              </div>
              <div>
                <div className="font-display font-bold text-lg text-blue-400">Hackathons</div>
                <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Collegiate Arenas</div>
              </div>
              <div>
                <div className="font-display font-bold text-lg text-violet-400">100%</div>
                <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">Student-Led Collective</div>
              </div>
            </div>
          </div>

          {/* Right Column: Genuine 3D Three.js Emblem Canvas with Scroll-Controlled Rotation */}
          <div className="lg:col-span-5 relative h-[450px] sm:h-[550px] lg:h-[640px] w-full flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[320px] sm:w-[420px] h-[320px] sm:h-[420px] bg-gradient-to-tr from-cyan-500/15 via-blue-600/15 to-violet-600/15 blur-[90px] rounded-full" />
            </div>

            <Aiconekt3DScene interactive={true} className="z-10" />
          </div>
        </div>
      </div>

      {/* Hero Bottom Transition & Natural Scroll Indicator */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-10 flex flex-col items-center justify-center">
        <button
          onClick={onExploreWork}
          className="group flex flex-col items-center gap-2 text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Scroll Down to Explore Our Projects</span>
          <div className="w-6 h-10 rounded-full border border-slate-700 flex items-start justify-center p-1.5 group-hover:border-cyan-500 transition-colors">
            <div className="w-1.5 h-2.5 bg-cyan-400 rounded-full animate-bounce"></div>
          </div>
        </button>
      </div>
    </section>
  );
};
