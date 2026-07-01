import { useEffect, useState } from 'react';

// Company branding, fetched once and cached at module level so login, sidebar
// and the PDF generator all share it.
let cache = null;
let inflight = null;

const DEFAULTS = {
  company_name: 'Gestion de Stock',
  logo: null,
  address: '',
  phone: '',
  ice: '',
  email: '',
  tagline: '',
  color_primary: '#14246B',
  color_accent: '#F1581A',
  bon_template: 'classic',
};

export const getCompany = async () => {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/api/company')
      .then(r => (r.ok ? r.json() : {}))
      .then(d => { cache = { ...DEFAULTS, ...Object.fromEntries(Object.entries(d || {}).filter(([, v]) => v !== null && v !== '')) }; return cache; })
      .catch(() => { cache = { ...DEFAULTS }; return cache; });
  }
  return inflight;
};

export const clearCompanyCache = () => { cache = null; inflight = null; };

export const useCompany = () => {
  const [company, setCompany] = useState(cache || DEFAULTS);
  useEffect(() => { getCompany().then(setCompany); }, []);
  return company;
};
