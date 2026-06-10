import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, User, Lock, ArrowRight, CheckCircle } from 'lucide-react';

const Register = () => {
  const [form, setForm]       = useState({ company_name: '', username: '', password: '', confirm: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(null); // { slug, username }
  const navigate = useNavigate();

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          company_name: form.company_name.trim(),
          username:     form.username.trim(),
          password:     form.password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'inscription.');
        return;
      }

      // Store session
      localStorage.setItem('token',   data.token);
      localStorage.setItem('user',    JSON.stringify(data.user));
      localStorage.setItem('company', JSON.stringify(data.company));

      setDone({ slug: data.company.slug, username: data.user.username });
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Compte créé !</h2>
          <p className="text-slate-600 mb-6">Vous bénéficiez de <strong>30 jours d'essai gratuit</strong>.</p>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left space-y-2">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Code société :</span>
              <code className="ml-2 bg-slate-200 px-2 py-0.5 rounded text-slate-800">{done.slug}</code>
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Utilisateur admin :</span>
              <code className="ml-2 bg-slate-200 px-2 py-0.5 rounded text-slate-800">{done.username}</code>
            </p>
            <p className="text-sm text-slate-500 mt-3">
              Notez bien votre <strong>code société</strong> — il vous sera demandé à chaque connexion.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <span>Accéder au tableau de bord</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">BTP STOCK</h1>
          <p className="text-slate-500 text-sm">Créer un compte — 30 jours d'essai gratuit</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom de la société
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={form.company_name}
                onChange={set('company_name')}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="Ex: BTP Maroc SARL"
                required
              />
            </div>
          </div>

          {/* Admin username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom d'utilisateur (admin)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={form.username}
                onChange={set('username')}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="Ex: admin"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="Minimum 6 caractères"
                required
              />
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="Répétez le mot de passe"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-700 hover:bg-slate-800 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /><span>Création...</span></>
            ) : (
              <><span>Créer mon compte</span><ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-slate-700 font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
