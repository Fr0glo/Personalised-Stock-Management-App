// Owner monitoring console API. The secret key is entered once by the owner and
// kept in sessionStorage; every data request carries it as x-monitor-key.
const KEY = 'monitorKey';

export const getMonitorKey = () => sessionStorage.getItem(KEY) || '';
export const setMonitorKey = (k) => sessionStorage.setItem(KEY, k);
export const clearMonitorKey = () => sessionStorage.removeItem(KEY);

const authHeaders = () => ({ 'Content-Type': 'application/json', 'x-monitor-key': getMonitorKey() });

// Is this the owner console instance? (safe boolean, no key required)
export const monitoringStatus = async () => {
  try {
    const r = await fetch('/api/monitoring/status');
    return r.ok ? r.json() : { enabled: false };
  } catch {
    return { enabled: false };
  }
};

export const verifyMonitorKey = async (key) => {
  try {
    const r = await fetch('/api/monitoring/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-monitor-key': key },
    });
    return r.ok;
  } catch {
    return false;
  }
};

export const fetchClients = async () => {
  const r = await fetch('/api/monitoring/clients', { headers: authHeaders() });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur de chargement');
  return (await r.json()).clients || [];
};

export const toggleClientFeature = async (id, feature, enabled) => {
  const r = await fetch(`/api/monitoring/clients/${id}/feature`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ feature, enabled }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur');
  return (await r.json()).features;
};
