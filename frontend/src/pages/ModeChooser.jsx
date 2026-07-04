import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, BarChart3, LogOut } from 'lucide-react';
import { monitoringStatus } from '../utils/monitoring';

// Shown right after the owner logs in on the port-4000 console: pick a space.
const ModeChooser = () => {
  const navigate = useNavigate();

  // Only the owner console has this; on any other instance, go to the app.
  useEffect(() => { monitoringStatus().then((s) => { if (!s.enabled) navigate('/'); }); }, []);

  const logout = () => { localStorage.clear(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-navy-700">Monitoring Gestion de Stock</h1>
        <p className="text-slate-500 mt-2">Choisissez un espace</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 w-full max-w-2xl">
        <button
          onClick={() => navigate('/')}
          className="group bg-white rounded-2xl shadow-lg p-8 border border-brand-cream-dark hover:border-brand-orange hover:shadow-xl transition text-left"
        >
          <FlaskConical className="w-10 h-10 text-brand-orange mb-4" />
          <h2 className="text-xl font-bold text-navy-700">Testing</h2>
          <p className="text-slate-500 mt-2 text-sm">Parcourir l'application comme un client — idéal pour une démonstration.</p>
        </button>

        <button
          onClick={() => navigate('/monitoring')}
          className="group bg-white rounded-2xl shadow-lg p-8 border border-brand-cream-dark hover:border-navy-700 hover:shadow-xl transition text-left"
        >
          <BarChart3 className="w-10 h-10 text-navy-700 mb-4" />
          <h2 className="text-xl font-bold text-navy-700">Monitoring</h2>
          <p className="text-slate-500 mt-2 text-sm">Vue d'ensemble de vos clients : comptes et fonctionnalités.</p>
        </button>
      </div>

      <button onClick={logout} className="mt-10 text-slate-400 hover:text-slate-600 text-sm flex items-center gap-1">
        <LogOut className="w-4 h-4" /> Se déconnecter
      </button>
    </div>
  );
};

export default ModeChooser;
