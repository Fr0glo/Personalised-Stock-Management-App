import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, Building2 } from 'lucide-react';
import { useCompany } from '../hooks/useCompany';
import { monitoringStatus } from '../utils/monitoring';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const company = useCompany();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isAuthenticated', 'true');

        // On the owner console instance, send owner/admin to the Testing/Monitoring chooser.
        const { enabled } = await monitoringStatus();
        if (enabled && (data.user.role === 'owner' || data.user.role === 'superadmin')) {
          navigate('/console');
        } else if (data.user.role === 'security') {
          navigate('/security');
        } else if (data.user.role === 'superadmin' || data.user.role === 'owner') {
          navigate('/analyse');
        } else {
          navigate('/');
        }
      } else {
        setError(data.error || 'Invalid username or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-brand-cream-dark">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          {company?.logo
            ? <div className="w-24 h-24 rounded-xl bg-white border border-slate-100 shadow-sm p-2.5 flex items-center justify-center mx-auto mb-4"><img src={company.logo} alt="Logo" className="max-w-full max-h-full object-contain" /></div>
            : <div className="w-24 h-24 rounded-xl bg-navy-50 flex items-center justify-center mx-auto mb-4"><Building2 className="w-12 h-12 text-navy-300" /></div>}
          <h1 className="text-2xl font-bold text-navy-700">{company?.company_name || 'Gestion de Stock'}</h1>
          {company?.tagline && <p className="text-xs text-navy-400 tracking-widest uppercase mt-1">{company.tagline}</p>}
          <p className="text-slate-500 mt-3">Connexion au système</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-navy-700 mb-2">
              Nom d'utilisateur
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                placeholder="Entrez votre nom d'utilisateur"
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-navy-700 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                placeholder="Entrez votre mot de passe"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-navy-700 hover:bg-navy-800 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Connexion...</span>
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
