import React, { useState } from 'react';
import { Settings, User } from 'lucide-react';
import CompanySettingsModal from './CompanySettingsModal';

const ADMIN_ROLES = ['superadmin', 'owner'];

const Topbar = () => {
  const [showSettings, setShowSettings] = useState(false);
  const me = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
  const isAdmin = ADMIN_ROLES.includes(me?.role);

  return (
    <div className="bg-white shadow-sm border-b border-brand-cream-dark px-6 py-3">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="h-4 w-4 text-slate-400" />
          <span className="font-medium">{me?.username || 'Utilisateur'}</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            title="Réglages de l'entreprise"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Settings className="h-5 w-5" />
          </button>
        )}
      </div>

      {showSettings && <CompanySettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default Topbar;
