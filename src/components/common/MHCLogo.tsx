import React from 'react';

interface MHCLogoProps {
  className?: string;
  variant?: 'full' | 'emblem-only' | 'badge';
  alt?: string;
}

export const MHCLogo: React.FC<MHCLogoProps> = ({
  className = 'h-12 w-12',
  variant = 'full',
  alt = 'Maduvvari Health Centre Logo',
}) => {
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`} title={alt}>
      <svg
        viewBox="0 0 500 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-contain"
        aria-label={alt}
      >
        <defs>
          <linearGradient id="mhcBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f0fdfa" />
          </linearGradient>

          <linearGradient id="mhcTealGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00b4b6" />
            <stop offset="100%" stopColor="#009698" />
          </linearGradient>

          <path id="mhcMottoArc" d="M 125,175 A 140,140 0 0,1 375,175" fill="none" />
        </defs>

        {/* Circular badge backing */}
        <circle cx="250" cy="190" r="145" fill="url(#mhcBadgeGrad)" stroke="#e2e8f0" strokeWidth="2" />

        {/* Outer Ring with Dynamic Healthcare Wave */}
        <path
          d="M 135,115 A 142,142 0 1,1 365,265"
          fill="none"
          stroke="#00b4b6"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Sweeping fluid wave flourish at bottom left */}
        <path
          d="M 132,142 C 145,190 120,240 145,275 C 170,305 210,325 270,322 C 320,320 365,285 385,245 C 360,270 315,296 265,295 C 205,294 165,268 152,225 C 142,192 145,160 132,142 Z"
          fill="#00b4b6"
        />

        {/* Secondary wave layer underneath */}
        <path
          d="M 135,225 C 140,265 170,305 230,325 C 280,340 330,325 365,295 C 330,318 285,324 240,312 C 185,298 152,260 142,220 Z"
          fill="#00b4b6"
          opacity="0.9"
        />

        {/* Motto along the upper curve: "Benevolence to humanity" */}
        <text
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="14.5"
          fontWeight="700"
          fill="#009698"
          letterSpacing="1"
        >
          <textPath href="#mhcMottoArc" startOffset="50%" textAnchor="middle">
            Benevolence to humanity
          </textPath>
        </text>

        {/* Central Intertwined Heart Knot Emblem */}
        <g transform="translate(250, 190) scale(0.95) translate(-250, -190)">
          {/* Main Heart Knot Boundary */}
          <path
            d="M 250,155 C 235,115 175,105 160,150 C 145,195 200,240 240,270 C 248,276 252,276 260,270 C 300,240 355,195 340,150 C 325,105 265,115 250,155 Z"
            fill="none"
            stroke="#00b4b6"
            strokeWidth="15"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Inner Interlocking Knot Loops */}
          <path
            d="M 215,145 C 230,125 270,125 285,145 C 305,170 295,200 270,225 C 255,240 245,240 230,225 C 205,200 195,170 215,145 Z"
            fill="none"
            stroke="#00b4b6"
            strokeWidth="11"
            strokeLinecap="round"
          />

          {/* Decorative central curls */}
          <path
            d="M 215,160 C 200,165 190,185 205,200 C 220,215 238,205 235,185"
            fill="none"
            stroke="#00b4b6"
            strokeWidth="9"
            strokeLinecap="round"
          />

          <path
            d="M 285,160 C 300,165 310,185 295,200 C 280,215 262,205 265,185"
            fill="none"
            stroke="#00b4b6"
            strokeWidth="9"
            strokeLinecap="round"
          />

          {/* Lower knot tails with terminal scrolls */}
          <path
            d="M 235,215 C 230,245 220,270 250,285 C 265,292 278,280 270,265 C 262,252 245,258 248,272"
            fill="none"
            stroke="#00b4b6"
            strokeWidth="10"
            strokeLinecap="round"
          />

          <path
            d="M 265,215 C 270,240 282,260 275,280"
            fill="none"
            stroke="#00b4b6"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </g>

        {/* MHC Text (Shown for full and badge variants) */}
        {variant !== 'emblem-only' && (
          <text
            x="250"
            y="445"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontSize="112"
            fontWeight="900"
            letterSpacing="2"
            fill="#009cb0"
          >
            MHC
          </text>
        )}
      </svg>
    </div>
  );
};
export default MHCLogo;
