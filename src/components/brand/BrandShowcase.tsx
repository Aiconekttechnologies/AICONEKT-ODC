import React, { useState } from 'react';
import { BRAND_CONCEPTS } from '../../data/mockData';
import { BrandLogo } from './BrandLogo';
import { Aiconekt3DInspector } from '../three/Aiconekt3DInspector';
import {
  Compass,
  CheckCircle2,
  Download,
  Copy,
  Layers,
  Sparkles,
  Palette,
  Type,
  Code2,
  Box,
  Eye,
  FileCode,
  Shield,
  ArrowRight
} from 'lucide-react';

export const BrandShowcase: React.FC = () => {
  const [selectedConceptId, setSelectedConceptId] = useState<string>('concept-6');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const selectedConcept = BRAND_CONCEPTS.find((c) => c.id === selectedConceptId) || BRAND_CONCEPTS[5];

  const colorTokens = [
    { name: 'Orbital Amber', hex: '#FF7A00', rgb: '255, 122, 0', purpose: 'Primary orbital A pylon, glowing ring, active highlights', contrast: 'AAA on #030712' },
    { name: 'Crimson Red', hex: '#E52000', rgb: '229, 32, 0', purpose: 'Right facet blade, gradient depths, 3-bar E accent', contrast: 'AA Large' },
    { name: 'Radiant Flare Gold', hex: '#FFA826', rgb: '255, 168, 38', purpose: 'Orbital ring apex flare, photonic highlights', contrast: 'AAA' },
    { name: 'Solar Glow Orange', hex: '#FF451A', rgb: '255, 69, 26', purpose: 'Tagline illumination, glowing ambient halos', contrast: 'AAA' },
    { name: 'Obsidian Black', hex: '#030712', rgb: '3, 7, 18', purpose: 'Ultimate infinite background', contrast: 'Base' },
    { name: 'Dark Carbon', hex: '#0A0502', rgb: '10, 5, 2', purpose: 'Deep canvas backdrops, spatial warmth', contrast: 'Base' },
    { name: 'Pure White', hex: '#FFFFFF', rgb: '255, 255, 255', purpose: 'AICONEKT title letterforms & star core', contrast: 'AAA' },
    { name: 'Titanium Silver', hex: '#E2E8F0', rgb: '226, 232, 240', purpose: 'TECHNOLOGIES descriptor & divider lines', contrast: 'AAA' },
  ];

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedToken(hex);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleDownloadSVG = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const masterSvgCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <defs>
    <linearGradient id="pylon-left" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFA028" />
      <stop offset="50%" stop-color="#FF6A00" />
      <stop offset="100%" stop-color="#E53200" />
    </linearGradient>
    <linearGradient id="pylon-right" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E53200" />
      <stop offset="50%" stop-color="#B81400" />
      <stop offset="100%" stop-color="#6E0500" />
    </linearGradient>
    <linearGradient id="orbital-ring" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF4500" />
      <stop offset="40%" stop-color="#FFA21A" />
      <stop offset="75%" stop-color="#FF5A00" />
      <stop offset="100%" stop-color="#FFD080" />
    </linearGradient>
  </defs>
  <path d="M 28 48 C 36 32, 64 26, 82 32" stroke="url(#orbital-ring)" stroke-width="3.5" stroke-linecap="round" opacity="0.6" />
  <polygon points="50,15 35,15 20,78 35,78 45,46 50,46" fill="url(#pylon-left)" />
  <polygon points="50,15 65,15 80,78 65,78 55,46 50,46" fill="url(#pylon-right)" />
  <polygon points="50,22 43,44 57,44" fill="#080200" />
  <path d="M 24 64 C 32 78, 62 80, 84 40" stroke="url(#orbital-ring)" stroke-width="4.5" stroke-linecap="round" />
  <circle cx="84" cy="40" r="2.5" fill="#FFFFFF" />
</svg>`;

  return (
    <section className="py-20 bg-[#030712] relative min-h-screen">
      {/* Background Decor */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-violet-900/10 blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-cyan-400">
            <Compass className="w-3.5 h-3.5" />
            <span>BRAND ARCHITECTURE & DESIGN SYSTEM</span>
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-white">
            The AICONEKT Identity System
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Engineered from scratch to represent a forward-looking technology organisation. Genuine 3D presence,
            physically-based metallic materials, precision typography, and flawless geometric hierarchy.
          </p>
        </div>

        {/* 1. Interactive 3D Model CAD Inspector */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="font-mono text-xs text-cyan-400 uppercase tracking-widest">Part 3 & 4 Verification</div>
              <h3 className="font-display font-bold text-2xl text-white mt-1">
                Real-Time 3D Emblem Model Inspector
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Inspect the genuine 3D geometry from any angle. Toggle materials, lighting rigs, and wireframe meshes.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Certified Real-Time Three.js Geometry</span>
            </div>
          </div>

          <Aiconekt3DInspector />
        </div>

        {/* 2. Emblem Concept Exploration Suite (The 6 Conceptual Directions) */}
        <div className="space-y-8">
          <div className="text-left">
            <div className="font-mono text-xs text-cyan-400 uppercase tracking-widest">Part 2 Design Exploration</div>
            <h3 className="font-display font-bold text-2xl sm:text-3xl text-white mt-1">
              6 Geometric Emblem Explorations
            </h3>
            <p className="text-slate-400 text-sm max-w-2xl mt-1">
              Evaluated across originality, visual impact, monochrome contrast, small-size favicon legibility, and suitability for true real-time 3D extrusion.
            </p>
          </div>

          {/* Grid of the 6 Concepts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BRAND_CONCEPTS.map((concept) => {
              const isSelected = concept.id === selectedConceptId;
              return (
                <div
                  key={concept.id}
                  onClick={() => setSelectedConceptId(concept.id)}
                  className={`cursor-pointer rounded-2xl p-6 border transition-all duration-300 relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900/90 border-cyan-500/80 shadow-xl shadow-cyan-500/10'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40'
                  }`}
                >
                  {concept.selected && (
                    <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>SELECTED MASTER</span>
                    </div>
                  )}

                  <div>
                    {/* Emblem Silhouette Thumbnail */}
                    <div className="h-32 w-full bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-center p-4 mb-4">
                      {concept.id === 'concept-6' ? (
                        <BrandLogo variant="emblem-only" size="lg" />
                      ) : (
                        <svg viewBox="0 0 100 100" className="w-20 h-20 text-slate-300">
                          <path d={concept.svgPath} fill="#64748B" stroke="#00F2FE" strokeWidth="1.5" />
                        </svg>
                      )}
                    </div>

                    <div className="font-mono text-[11px] text-cyan-400">{concept.subtitle}</div>
                    <h4 className="font-display font-bold text-lg text-white mt-1">{concept.title}</h4>
                    <p className="text-slate-400 text-xs mt-2 leading-relaxed">{concept.rationale}</p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Monochrome:</span>
                      <span className="text-slate-200">{concept.monochromeRating}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Favicon Legibility:</span>
                      <span className="text-slate-200">{concept.smallSizeLegibility}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Rationale for Chosen Concept */}
          <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 border border-cyan-500/30 rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>FINAL IDENTITY DECISION MATRIX</span>
            </div>
            <h4 className="font-display font-bold text-xl sm:text-2xl text-white">
              Why Concept 6 (The Dual-Cantilever Apex & Orbital Torus) Won
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300 leading-relaxed pt-2">
              <p>
                <strong className="text-white block mb-1">Architectural Forward Momentum:</strong>
                The dual cantilevered pylons form a sharp, forward-leaning apex that conveys engineering strength and ambitions.
                Unlike static generic triangles, the precision cuts and bevels create dynamic lighting highlights in both 3D and 2D.
              </p>
              <p>
                <strong className="text-white block mb-1">Seamless Orbital Synthesis:</strong>
                The continuous 3D gyroscopic orbital ring threads right through the central aperture, embodying the tagline
                <em className="text-cyan-400 font-semibold not-italic"> “Connect Ideas. Create Impact.”</em> It connects the negative
                space without visually cluttering the silhouette.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Wordmark Typography Anatomy */}
        <div className="space-y-8">
          <div>
            <div className="font-mono text-xs text-cyan-400 uppercase tracking-widest">Part 5 Wordmark Typography</div>
            <h3 className="font-display font-bold text-2xl sm:text-3xl text-white mt-1">
              Custom Wordmark Architecture
            </h3>
            <p className="text-slate-400 text-sm max-w-2xl mt-1">
              Engineered contemporary geometric typography featuring custom angled cuts, balanced letter spacing, and a strict structural hierarchy.
            </p>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-8 sm:p-12 space-y-8">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <BrandLogo variant="vertical" size="hero" showTagline={true} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-800 text-xs font-mono text-slate-400">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <span className="text-orange-400 font-bold block mb-1">1. AICONEKT Wordmark</span>
                Modern geometric typography featuring a chevron 'A' without crossbar, clean white letterforms, and the signature 3-bar orange-red 'E' with 45° precision cuts.
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-200 font-bold block mb-1">2. TECHNOLOGIES Descriptor</span>
                Uppercase geometric sans-serif flanked by dual gradient divider lines to provide structural balance.
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <span className="text-red-400 font-bold block mb-1">3. Official Tagline</span>
                "CONNECT IDEAS. CREATE IMPACT." in vibrant glowing orange-red (#FF451A) with wide 0.24em tracking.
              </div>
            </div>
          </div>
        </div>

        {/* 4. Brand Color Token System */}
        <div className="space-y-8">
          <div>
            <div className="font-mono text-xs text-cyan-400 uppercase tracking-widest">Part 4 Palette & Materials</div>
            <h3 className="font-display font-bold text-2xl sm:text-3xl text-white mt-1">
              Physically Based Color System
            </h3>
            <p className="text-slate-400 text-sm max-w-2xl mt-1">
              Cinematic studio lighting palette composed of dark titanium, polished chrome, electric cyan, cobalt blue, and violet.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {colorTokens.map((token) => (
              <div
                key={token.hex}
                onClick={() => handleCopyHex(token.hex)}
                className="group cursor-pointer bg-slate-950 rounded-xl border border-slate-800 p-4 hover:border-cyan-500/60 transition-all"
              >
                <div
                  className="w-full h-16 rounded-lg mb-3 shadow-inner flex items-end justify-end p-2 transition-transform group-hover:scale-[1.02]"
                  style={{ backgroundColor: token.hex }}
                >
                  <span className="bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-white">
                    {token.hex}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <h5 className="font-display font-bold text-white text-sm">{token.name}</h5>
                  <button className="text-slate-500 group-hover:text-cyan-400 transition-colors">
                    {copiedToken === token.hex ? (
                      <span className="text-[10px] font-mono text-cyan-300">Copied!</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-slate-400 text-xs mt-1">{token.purpose}</p>
                <div className="mt-2 text-[10px] font-mono text-slate-500">RGB: {token.rgb}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Required Brand Asset Suite (Part 9) */}
        <div className="space-y-8">
          <div>
            <div className="font-mono text-xs text-cyan-400 uppercase tracking-widest">Part 9 Required Brand Assets</div>
            <h3 className="font-display font-bold text-2xl sm:text-3xl text-white mt-1">
              Deployable Brand Asset Library
            </h3>
            <p className="text-slate-400 text-sm max-w-2xl mt-1">
              High-resolution vector SVG assets for digital platforms, mobile applications, dark interfaces, and monochrome documentation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Asset 1: Primary Full Horizontal Logo */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
              <div>
                <div className="h-28 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-center p-3 mb-4">
                  <BrandLogo variant="horizontal" size="sm" />
                </div>
                <h5 className="font-display font-bold text-white text-sm">Primary Full Lockup</h5>
                <p className="text-slate-400 text-xs mt-1">Full 3D emblem with AICONEKT wordmark and TECHNOLOGIES descriptor.</p>
              </div>
              <button
                onClick={() => handleDownloadSVG('aiconekt-full-horizontal', masterSvgCode)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export SVG</span>
              </button>
            </div>

            {/* Asset 2: Monochrome White-on-Dark */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
              <div>
                <div className="h-28 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center p-3 mb-4">
                  <BrandLogo variant="monochrome-white" size="sm" />
                </div>
                <h5 className="font-display font-bold text-white text-sm">Monochrome White-on-Dark</h5>
                <p className="text-slate-400 text-xs mt-1">Pure monochrome vector for dark mode overlays, code editors, and stamping.</p>
              </div>
              <button
                onClick={() => handleDownloadSVG('aiconekt-monochrome-white', masterSvgCode)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export SVG</span>
              </button>
            </div>

            {/* Asset 3: Monochrome Dark-on-Light */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
              <div>
                <div className="h-28 bg-slate-100 rounded-xl border border-slate-300 flex items-center justify-center p-3 mb-4">
                  <BrandLogo variant="monochrome-dark" size="sm" />
                </div>
                <h5 className="font-display font-bold text-white text-sm">Monochrome Dark-on-Light</h5>
                <p className="text-slate-400 text-xs mt-1">High-contrast solid mark for research papers, invoices, and light mode contexts.</p>
              </div>
              <button
                onClick={() => handleDownloadSVG('aiconekt-monochrome-dark', masterSvgCode)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export SVG</span>
              </button>
            </div>

            {/* Asset 4: Standalone Favicon & App Icon */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
              <div>
                <div className="h-28 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-center gap-4 p-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 p-2 flex items-center justify-center">
                    <BrandLogo variant="emblem-only" size="xs" />
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 p-1 flex items-center justify-center">
                    <BrandLogo variant="emblem-only" size="xs" />
                  </div>
                </div>
                <h5 className="font-display font-bold text-white text-sm">Favicon & App Icon (16-64px)</h5>
                <p className="text-slate-400 text-xs mt-1">Precision engineered to retain unmistakable silhouette down to 16x16 pixels.</p>
              </div>
              <button
                onClick={() => handleDownloadSVG('aiconekt-favicon', masterSvgCode)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Favicon SVG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
