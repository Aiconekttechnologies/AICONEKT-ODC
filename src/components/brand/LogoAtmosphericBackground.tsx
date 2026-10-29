import React, { useEffect, useState } from 'react';

interface LogoAtmosphericBackgroundProps {
  className?: string;
}

export const LogoAtmosphericBackground: React.FC<LogoAtmosphericBackgroundProps> = ({
  className = '',
}) => {
  const [scrollY, setScrollY] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const rawBase = import.meta.env.BASE_URL || '/';
  const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  useEffect(() => {
    // Accessibility: check reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    const motionHandler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', motionHandler);

    // Passive scroll tracking for restrained atmospheric depth
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      motionQuery.removeEventListener('change', motionHandler);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Parallax calculations (subtle, non-distracting)
  const parallaxOffset = prefersReducedMotion ? 0 : Math.min(scrollY * 0.08, 120);

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#030712] ${className}`}
      aria-hidden="true"
    >
      {/* 1. Deep Space Atmospheric Ambient Glows Matching Orange / Crimson Identity */}
      <div className="absolute inset-0">
        {/* Primary Warm Flare at Upper Center */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[500px] sm:h-[700px] rounded-full blur-[160px] opacity-25"
          style={{
            background: 'radial-gradient(circle, #ff6a00 0%, #e52000 40%, rgba(3,7,18,0) 75%)',
          }}
        />

        {/* Ambient Violet/Indigo Deep Canvas Accent for High-Tech Contrast */}
        <div
          className="absolute top-1/3 -right-40 w-[450px] sm:w-[650px] h-[450px] sm:h-[650px] rounded-full blur-[180px] opacity-15"
          style={{
            background: 'radial-gradient(circle, #6366f1 0%, #312e81 50%, rgba(3,7,18,0) 80%)',
          }}
        />

        {/* Deep Crimson Horizon at Mid-Page */}
        <div
          className="absolute top-2/3 -left-32 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full blur-[160px] opacity-20"
          style={{
            background: 'radial-gradient(circle, #dc2626 0%, #7f1d1d 50%, rgba(3,7,18,0) 80%)',
          }}
        />

        {/* Subtle Tech Grid Texture */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* 2. Full Official Master Artwork Background Visual (100% visible, contained, no letter cropping) */}
      <div
        className="absolute top-12 sm:top-20 left-0 right-0 mx-auto flex items-center justify-center transition-transform duration-700 ease-out will-change-transform px-4 sm:px-8"
        style={{
          transform: `translateY(${parallaxOffset}px)`,
          maxWidth: '1200px',
          height: 'min(75vh, 650px)',
        }}
      >
        {/* Soft Radial Backlight behind the Master Artwork */}
        <div
          className="absolute inset-0 rounded-full blur-[110px] opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center, #ff7a00 10%, #e52000 40%, rgba(3,7,18,0) 75%)',
          }}
        />

        {/* 
          Official Master Artwork with transparent background:
          Contains the orbital 'A' emblem + complete 'AICONEKT' wordmark + 'TECHNOLOGIES' + tagline.
          Using object-contain and max-w-full ensures both 'A' and 'K' (and 'T') are NEVER cropped!
        */}
        <img
          src={`${baseUrl}brand/aiconekt-logo-transparent.png`}
          alt=""
          className="w-full h-full object-contain filter drop-shadow-[0_0_90px_rgba(255,90,0,0.35)] opacity-25 sm:opacity-30 select-none"
          loading="eager"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `${baseUrl}brand/aiconekt-official-logo.jpg`;
          }}
        />
      </div>

      {/* 3. Subtle Vignette ensuring 100% Foreground Text Contrast Across All Pages */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/50 via-transparent to-[#030712]/95 pointer-events-none" />
    </div>
  );
};

export default LogoAtmosphericBackground;
