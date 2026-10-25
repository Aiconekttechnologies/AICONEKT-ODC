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
  // Size metrics for emblem & artwork
  const emblemSizes = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    hero: 'w-32 h-32',
  };

  const artworkSizes = {
    xs: 'h-10 w-auto',
    sm: 'h-14 w-auto',
    md: 'h-20 w-auto',
    lg: 'h-28 w-auto',
    xl: 'h-40 w-auto',
    hero: 'h-52 w-auto max-w-full',
  };

  const titleSizes = {
    xs: 'text-sm tracking-wider',
    sm: 'text-base tracking-wider',
    md: 'text-xl tracking-wider',
    lg: 'text-3xl tracking-widest',
    xl: 'text-4xl tracking-widest',
    hero: 'text-6xl tracking-widest',
  };

  const subtitleSizes = {
    xs: 'text-[7px] tracking-[0.25em]',
    sm: 'text-[8.5px] tracking-[0.3em]',
    md: 'text-[10px] tracking-[0.35em]',
    lg: 'text-xs tracking-[0.4em]',
    xl: 'text-sm tracking-[0.45em]',
    hero: 'text-base tracking-[0.5em]',
  };

  const isMonochromeDark = variant === 'monochrome-dark';
  const isMonochromeWhite = variant === 'monochrome-white';
  const isMonochrome = isMonochromeDark || isMonochromeWhite;

  const baseUrl = import.meta.env.BASE_URL;

  // Render the exact orange-to-red orbital A emblem
  const renderEmblem = () => (
    <div className={`relative flex items-center justify-center shrink-0 ${emblemSizes[size]}`}>
      {/* Official High-Resolution Transparent Emblem Image */}
      {!isMonochrome ? (
        <img
          src={`${baseUrl}brand/aiconekt-emblem-transparent.png`}
          alt="AICONEKT Orbital A Emblem"
          className="w-full h-full object-contain select-none drop-shadow-[0_0_12px_rgba(255,100,0,0.35)] transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // Fallback to SVG if asset loading is delayed
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        /* Monochrome Vector Fallback */
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full select-none"
        >
          <path
            d="M 28 48 C 36 32, 64 26, 82 32"
            stroke={isMonochromeDark ? '#0F172A' : '#FFFFFF'}
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.6"
          />
          <polygon
            points="50,15 35,15 20,78 35,78 45,46 50,46"
            fill={isMonochromeDark ? '#0F172A' : '#FFFFFF'}
          />
          <polygon
            points="50,15 65,15 80,78 65,78 55,46 50,46"
            fill={isMonochromeDark ? '#334155' : '#CBD5E1'}
          />
          <polygon
            points="50,22 43,44 57,44"
            fill={isMonochromeDark ? '#FFFFFF' : '#030712'}
          />
          <path
            d="M 24 64 C 32 78, 62 80, 84 40"
            stroke={isMonochromeDark ? '#0F172A' : '#FFFFFF'}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <circle cx="84" cy="40" r="2.5" fill={isMonochromeDark ? '#0F172A' : '#FFFFFF'} />
        </svg>
      )}
    </div>
  );

  // Custom Wordmark Typography:
  // AICONEKT (with chevron 'A' and distinctive 3-bar orange-red 'E') + — TECHNOLOGIES — + Tagline
  const renderWordmark = () => {
    const textColor = isMonochromeDark ? 'text-slate-900' : 'text-white';
    const techColor = isMonochromeDark ? 'text-slate-700' : 'text-slate-300';
    const dividerColor = isMonochromeDark
      ? 'from-transparent via-slate-500 to-transparent'
      : 'from-transparent via-orange-500/80 to-transparent';

    return (
      <div className={`flex flex-col select-none ${variant === 'vertical' ? 'items-center text-center' : 'items-start text-left'}`}>
        {/* AICONEKT Title with Distinctive Orange-Red E */}
        <div className={`font-display font-extrabold leading-none ${titleSizes[size]} ${textColor} flex items-center tracking-[0.08em]`}>
          {/* Chevron A (inverted V without crossbar) */}
          <span className="font-sans font-bold">^</span>
          <span>IC</span>
          <span>ON</span>

          {/* The Distinctive 3-Bar Orange-Red E with 45° Chamfered Edges */}
          {!isMonochrome ? (
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

        {/* TECHNOLOGIES with Horizontal Divider Lines */}
        <div className={`flex items-center gap-2 mt-1 w-full ${variant === 'vertical' ? 'justify-center' : 'justify-start'}`}>
          <span className={`h-px flex-1 max-w-[28px] bg-gradient-to-r ${dividerColor}`} />
          <span className={`font-sans font-medium uppercase ${subtitleSizes[size]} ${techColor}`}>
            TECHNOLOGIES
          </span>
          <span className={`h-px flex-1 max-w-[28px] bg-gradient-to-r ${dividerColor}`} />
        </div>

        {/* Tagline: CONNECT IDEAS. CREATE IMPACT. */}
        {showTagline && (
          <div className="font-mono text-[8px] sm:text-[9.5px] uppercase tracking-[0.24em] text-[#FF451A] font-semibold mt-1.5 pt-1 border-t border-orange-500/20 drop-shadow-[0_0_8px_rgba(255,69,26,0.3)]">
            CONNECT IDEAS. CREATE IMPACT.
          </div>
        )}
      </div>
    );
  };

  // Full Master Artwork Variant (Exact Uploaded Master Image)
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
          className={`${artworkSizes[size]} object-contain select-none drop-shadow-[0_0_24px_rgba(255,80,0,0.25)]`}
          onError={(e) => {
            // If transparent PNG fails, load master JPG directly
            (e.target as HTMLImageElement).src = `${baseUrl}brand/aiconekt-official-logo.jpg`;
          }}
        />
      </div>
    );
  }

  // Emblem Only Variant
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

  // Wordmark Only Variant
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

  // Vertical Variant (for Footers, AuthModal, Brand Banners)
  if (variant === 'vertical') {
    return (
      <div
        className={`inline-flex flex-col items-center gap-3 transition-all duration-300 ${
          onClick ? 'cursor-pointer hover:opacity-95' : ''
        } ${className}`}
        onClick={onClick}
      >
        {/* Render crisp emblem + exact typography lockup */}
        {renderEmblem()}
        {renderWordmark()}
      </div>
    );
  }

  // Default: Horizontal Variant (for Navbar, Headers, Footers)
  return (
    <div
      className={`inline-flex items-center gap-3 transition-all duration-300 ${
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
