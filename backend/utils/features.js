import { getRow } from '../database/connection.js';

// Per-client feature flags live as JSON in companySettings.features (one row,
// id = 1). The owner enables/disables them server-side via database/setFeature.js;
// the app only READS them. This is the boundary that makes a feature "paid":
// a client can't turn it on without shell access to the server.

// Read this instance's flags, e.g. { facture: true }.
export const getFeatures = async () => {
  try {
    const row = await getRow('SELECT features FROM companySettings WHERE id = 1');
    return JSON.parse(row?.features || '{}');
  } catch {
    return {};
  }
};

// Express guard for optional/paid endpoints. Returns 403 unless the feature is
// enabled for this client. Usage:  router.use(requireFeature('facture'))
export const requireFeature = (name) => async (req, res, next) => {
  try {
    const features = await getFeatures();
    if (features[name]) return next();
    return res.status(403).json({ error: `La fonctionnalité « ${name} » n'est pas activée pour ce compte.` });
  } catch (e) {
    return res.status(500).json({ error: 'Feature check failed' });
  }
};
