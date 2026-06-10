/**
 * Centralised API utility.
 * Automatically attaches the JWT Bearer token to every request and handles
 * 401/402 responses (token expired, trial expired) by redirecting to login.
 */

const BASE = '/api';

const getToken = () => localStorage.getItem('token');

const handleUnauthorised = (status, data) => {
  if (status === 401 || status === 402) {
    // Clear session and send to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('company');
    const message =
      data?.code === 'TRIAL_EXPIRED'
        ? 'Votre période d\'essai a expiré. Veuillez souscrire à un abonnement.'
        : 'Session expirée. Veuillez vous reconnecter.';
    // Store message to show on login page
    sessionStorage.setItem('authMessage', message);
    window.location.href = '/login';
  }
};

const buildHeaders = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

const request = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: buildHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));

  handleUnauthorised(res.status, data);

  return { ok: res.ok, status: res.status, data };
};

const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
};

export default api;
