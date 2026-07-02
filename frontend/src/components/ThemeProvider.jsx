import { useEffect } from 'react';
import { getCompany } from '../hooks/useCompany';

const hexToRgb = (hex) => {
  const m = (hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const darken = (rgb, f = 0.8) => rgb.map((v) => clamp(v * f));
const lighten = (rgb, f = 0.18) => rgb.map((v) => clamp(v + (255 - v) * f));
const toVar = (rgb) => rgb.join(' ');

// Applies the company's brand colours to the CSS variables that Tailwind's
// navy-600/700/800 and brand-orange resolve to, so the whole UI is themed.
const ThemeProvider = ({ children }) => {
  useEffect(() => {
    getCompany().then((c) => {
      const root = document.documentElement;
      const primary = hexToRgb(c.color_primary);
      const accent = hexToRgb(c.color_accent);
      if (primary) {
        root.style.setProperty('--brand-primary', toVar(primary));
        root.style.setProperty('--brand-primary-light', toVar(lighten(primary)));
        root.style.setProperty('--brand-primary-dark', toVar(darken(primary)));
      }
      if (accent) root.style.setProperty('--brand-accent', toVar(accent));
    });
  }, []);
  return children || null;
};

export default ThemeProvider;
