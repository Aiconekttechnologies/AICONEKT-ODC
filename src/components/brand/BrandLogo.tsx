import React from 'react';

export interface BrandLogoProps {
  variant?: 'horizontal' | 'vertical' | 'emblem-only' | 'wordmark-only' | 'full-artwork' | 'monochrome-white' | 'monochrome-dark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showTagline?: boolean;
  useOfficialArtwork?: boolean;
  className?: string;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  showTagline = false,
  useOfficialArtwork = false,
  className = '',
  onClick,
}) => {
  const rawBase = import.meta.env.BASE_URL || '/';
  const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  // True aspect ratio sizes for the official emblem and official artwork
  const emblemSizes = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
    hero: 'h-28 w-28 sm:h-32 sm:h-32',
  };

  // The official master horizontal artwork has an aspect ratio of ~ 1024 : 682 (or 3:2)
  const artworkSizes = {
    xs: 'h-7 w-auto',
    sm: 'h-9 w-auto',
    md: 'h-12 w-auto',
    lg: 'h-16 w-auto',
    xl: 'h-24 w-auto',
    hero: 'h-28 sm:h-36 w-auto max-w-full',
  };

  // Typography scaling for horizontal lockup
  const titleSizes = {
    xs: 'text-xs tracking-wider',
    sm: 'text-sm sm:text-base tracking-wider',
    md: 'text-base sm:text-lg tracking-wider',
    lg: 'text-xl sm:text-2xl tracking-widest',
    xl: 'text-3xl sm:text-4xl tracking-widest',
    hero: 'text-4xl sm:text-5xl lg:text-6xl tracking-widest',
  };

  const subtitleSizes = {
    xs: 'text-[7px] tracking-[0.2em]',
    sm: 'text-[8px] tracking-[0.24em]',
    md: 'text-[9.5px] tracking-[0.28em]',
    lg: 'text-[11px] tracking-[0.32em]',
    xl: 'text-xs tracking-[0.36em]',
    hero: 'text-sm tracking-[0.4em]',
  };

  const isMonochromeDark = variant === 'monochrome-dark';
  const isMonochromeWhite = variant === 'monochrome-white';

  // 1. Render Official Emblem (True cropped transparent PNG of the orbital A mark)
  const renderEmblem = () => (
    <div className={`relative flex items-center justify-center shrink-0 ${emblemSizes[size]}`}>
      <img
        src={`${baseUrl}brand/aiconekt-emblem-transparent.png`}
        alt="AICONEKT Orbital A Emblem"
        className="h-full w-full object-contain select-none drop-shadow-[0_0_12px_rgba(255,100,0,0.4)] transition-transform duration-300 group-hover:scale-105"
        loading="eager"
        onError={(e) => {
          (e.target as HTMLImageElement).src = `${baseUrl}brand/aiconekt-emblem.png`;
        }}
      />
    </div>
  );

  // 2. Render Official Wordmark lockup
  const renderWordmark = () => {
    const textColor = isMonochromeDark ? 'text-slate-900' : 'text-white';
    const techColor = isMonochromeDark ? 'text-slate-700' : 'text-slate-300';
    const dividerColor = isMonochromeDark
      ? 'from-transparent via-slate-500 to-transparent'
      : 'from-transparent via-orange-500/80 to-transparent';

    return (
      <div className={`flex flex-col select-none ${variant === 'vertical' ? 'items-center text-center' : 'items-start text-left'}`}>
        {/* Title: AICONEKT with chevron A and precision 3-bar orange-red E */}
        <div className={`font-display font-extrabold leading-none ${titleSizes[size]} ${textColor} flex items-center tracking-[0.08em]`}>
          <span className="font-sans font-bold">^</span>
          <span>IC</span>
          <span>ON</span>

          {/* Signature 3-Bar Orange-Red E */}
          {!isMonochromeDark && !isMonochromeWhite ? (
            <span
              className="inline-flex flex-col justify-between mx-[0.08em] shrink-0"
              style={{
                height: '0.62em',
                width: '0.42em',
              }}
            >
              <span className="h-[24%] w-full bg-gradient-to-r from-[#FF7A00] to-[#E52000] rounded-l-[0.5px] transform -skew-x-[28deg] shadow-[0_0_6px_rgba(255,100,0,0.6)]" />
              <span className="h-[24%] w-full bg-gradient-to-r from-[#FF7A00] to-[#E52000] rounded-l-[0.5px] transform -skew-x-[28deg] shadow-[0_0_6px_rgba(255,100,0,0.6)]" />
              <span className="h-[24%] w-full bg-gradient-to-r from-[#FF7A00] to-[#E52000] rounded-l-[0.5px] transform -skew-x-[28deg] shadow-[0_0_6px_rgba(255,100,0,0.6)]" />
            </span>
          ) : (
            <span>E</span>
          )}

          <span>KT</span>
        </div>

        {/* Descriptor: TECHNOLOGIES with horizontal dividers */}
        <div className={`flex items-center gap-2 mt-1 w-full ${variant === 'vertical' ? 'justify-center' : 'justify-start'}`}>
          <span className={`h-px flex-1 max-w-[24px] bg-gradient-to-r ${dividerColor}`} />
          <span className={`font-sans font-semibold uppercase ${subtitleSizes[size]} ${techColor}`}>
            TECHNOLOGIES
          </span>
          <span className={`h-px flex-1 max-w-[24px] bg-gradient-to-r ${dividerColor}`} />
        </div>

        {/* Official Tagline: CONNECT IDEAS. CREATE IMPACT. */}
        {showTagline && (
          <div className="font-mono text-[8px] sm:text-[9.5px] uppercase tracking-[0.22em] text-[#FF451A] font-bold mt-1.5 pt-1 border-t border-orange-500/20 drop-shadow-[0_0_8px_rgba(255,69,26,0.3)]">
            CONNECT IDEAS. CREATE IMPACT.
          </div>
        )}
      </div>
    );
  };

  // 3. Full Master Artwork Variant (Official Master Graphic directly)
  if (variant === 'full-artwork' || useOfficialArtwork) {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center transition-transform duration-300 ${
          onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
        } ${className}`}
        onClick={onClick}
      >
        <img
          src={`${baseUrl}brand/aiconekt-logo-transparent.png`}
          alt="AICONEKT TECHNOLOGIES Official Master Logo"
          className={`${artworkSizes[size]} object-contain select-none drop-shadow-[0_0_24px_rgba(255,80,0,0.35)]`}
          onError={(e) => {
            (e.target as HTMLImageElement).src = `${baseUrl}brand/aiconekt-official-logo.jpg`;
          }}
        />
      </div>
    );
  }

  // 4. Emblem Only Variant
  if (variant === 'emblem-only') {
    return (
      <div
        className={`inline-flex items-center justify-center ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
        onClick={onClick}
      >
        {renderEmblem()}
      </div>
    );
  }

  // 5. Wordmark Only Variant
  if (variant === 'wordmark-only') {
    return (
      <div
        className={`inline-flex items-center ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
        onClick={onClick}
      >
        {renderWordmark()}
      </div>
    );
  }

  // 6. Vertical Variant
  if (variant === 'vertical') {
    return (
      <div
        className={`inline-flex flex-col items-center gap-3 transition-all duration-300 ${
          onClick ? 'cursor-pointer hover:opacity-95' : ''
        } ${className}`}
        onClick={onClick}
      >
        {renderEmblem()}
        {renderWordmark()}
      </div>
    );
  }

  // 7. Default: Horizontal Variant (for Navbar, Headers, Footers)
  return (
    <div
      className={`inline-flex items-center gap-2.5 sm:gap-3 transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:opacity-95' : ''
      } ${className}`}
      onClick={onClick}
    >
      {renderEmblem()}
      {renderWordmark()}
    </div>
  );
};

export default BrandLogo;
