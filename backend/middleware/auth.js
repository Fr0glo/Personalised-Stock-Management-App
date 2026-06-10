import jwt from 'jsonwebtoken';
import { getRow } from '../database/connection.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'btpstock-saas-secret-2024';

/**
 * Verifies the Bearer token and attaches user + company info to req.
 * Also checks that the company's trial/plan is still active.
 */
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requis. Veuillez vous connecter.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify company still exists and is active
    const company = await getRow(
      'SELECT company_id, name, slug, plan, trial_ends_at FROM companies WHERE company_id = ?',
      [decoded.company_id]
    );

    if (!company) {
      return res.status(403).json({ error: 'Entreprise introuvable.' });
    }

    // Check trial expiry
    if (company.plan === 'trial' && company.trial_ends_at) {
      const trialEnd = new Date(company.trial_ends_at);
      if (new Date() > trialEnd) {
        return res.status(402).json({
          error: 'Période d\'essai expirée. Veuillez souscrire à un abonnement.',
          code: 'TRIAL_EXPIRED'
        });
      }
    }

    if (company.plan === 'cancelled') {
      return res.status(402).json({
        error: 'Abonnement annulé. Veuillez contacter le support.',
        code: 'SUBSCRIPTION_CANCELLED'
      });
    }

    req.user = decoded;
    req.companyId = decoded.company_id;
    req.company = company;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Token invalide.' });
  }
};
