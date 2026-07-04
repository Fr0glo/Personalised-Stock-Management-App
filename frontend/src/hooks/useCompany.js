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
  features: {},
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

// Per-client feature flags (enabled by the owner server-side). Gate optional/
// paid UI with one line, e.g.  const facture = useFeature('facture');
export const hasFeature = (company, name) => !!(company && company.features && company.features[name]);

export const useFeature = (name) => {
  const company = useCompany();
  return hasFeature(company, name);
};
