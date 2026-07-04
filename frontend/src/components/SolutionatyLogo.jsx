import React from 'react';

// Solutionaty wordmark — code brackets (orange) around the name (navy).
// showTagline=false gives a compact lockup for headers/badges.
const SolutionatyLogo = ({ className = '', showTagline = true }) => (
  <svg
    className={className}
    viewBox={showTagline ? '0 0 500 116' : '0 0 500 84'}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Solutionaty"
  >
    <text
      x="250" y="64" textAnchor="middle" fontWeight="800" fontSize="52"
      fontFamily="'Segoe UI','Helvetica Neue',Arial,sans-serif"
    >
      <tspan fill="#F1581A" fontFamily="'SFMono-Regular','Consolas','Menlo',monospace">{'</'}</tspan>
      <tspan fill="#14246B" dx="8">Solutionaty</tspan>
      <tspan fill="#F1581A" dx="8" fontFamily="'SFMono-Regular','Consolas','Menlo',monospace">{'/>'}</tspan>
    </text>
    {showTagline && (
      <text
        x="250" y="92" textAnchor="middle" fontWeight="600" fontSize="13"
        letterSpacing="6" fill="#64748b" fontFamily="'Segoe UI',Arial,sans-serif"
      >
        CUSTOM SOFTWARE · MAROC
      </text>
    )}
  </svg>
);

export default SolutionatyLogo;
