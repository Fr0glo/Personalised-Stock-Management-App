import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, RefreshCw, Building2, ShieldAlert } from 'lucide-react';
import {
  fetchClients, toggleClientFeature,
  getMonitorKey, setMonitorKey, verifyMonitorKey, monitoringStatus,
} from '../utils/monitoring';
import SolutionatyLogo from '../components/SolutionatyLogo';

// The optional/paid features you can turn on per client.
const KNOWN_FEATURES = [
  { key: 'facture', label: 'Facture' },
];

const Monitoring = () => {
  const navigate = useNavigate();
  const [needsKey, setNeedsKey] = useState(!getMonitorKey());
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Only the owner console has this.
  useEffect(() => { monitoringStatus().then((s) => { if (!s.enabled) navigate('/'); }); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try { setClients(await fetchClients()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!needsKey) load(); }, [needsKey]);

  const submitKey = async (e) => {
    e.preventDefault(); setKeyError('');
    if (await verifyMonitorKey(keyInput)) { setMonitorKey(keyInput); setNeedsKey(false); }
    else setKeyError('Clé invalide.');
  };

  const onToggle = async (client, key, enabled) => {
    setClients((cs) => cs.map((c) => (c.id === client.id ? { ...c, features: { ...c.features, [key]: enabled } } : c)));
    try { await toggleClientFeature(client.id, key, enabled); }
    catch (e) { setError(e.message); load(); }
  };

  if (needsKey) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <form onSubmit={submitKey} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm border border-brand-cream-dark">
          <ShieldAlert className="w-8 h-8 text-navy-700 mb-3" />
          <h1 className="text-xl font-bold text-navy-700 mb-1">Monitoring</h1>
          <p className="text-slate-500 text-sm mb-4">Entrez la clé de monitoring.</p>
          <input
            type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoFocus
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            placeholder="Clé"
          />
          {keyError && <p className="text-red-600 text-sm mt-2">{keyError}</p>}
          <button className="w-full mt-4 bg-navy-700 hover:bg-navy-800 text-white py-2 rounded-lg font-medium">Ouvrir</button>
          <button type="button" onClick={() => navigate('/console')} className="w-full mt-2 text-slate-400 text-sm">Retour</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/console')} className="text-slate-500 hover:text-navy-700"><ArrowLeft className="w-5 h-5" /></button>
            <SolutionatyLogo className="h-9 w-auto" showTagline={false} />
            <span className="text-slate-300 text-xl font-light">/</span>
            <h1 className="text-xl font-semibold text-navy-700">Monitoring</h1>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-navy-700 hover:text-navy-900">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
        {!loading && clients.length === 0 && !error && <p className="text-slate-500">Aucun client pour le moment.</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                {c.logo
                  ? <div className="w-12 h-12 rounded-lg bg-white border border-slate-100 p-1.5 flex items-center justify-center"><img src={c.logo} alt="" className="max-w-full max-h-full object-contain" /></div>
                  : <div className="w-12 h-12 rounded-lg bg-navy-50 flex items-center justify-center"><Building2 className="w-6 h-6 text-navy-300" /></div>}
                <div className="min-w-0">
                  <h3 className="font-semibold text-navy-700 truncate">{c.company_name}</h3>
                  <p className="text-xs text-slate-400">{c.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                <Users className="w-4 h-4 text-slate-400" />
                <span>{c.users}{c.limit ? ` / ${c.limit}` : ''} compte{c.users === 1 ? '' : 's'}{c.limit ? '' : ' (illimité)'}</span>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2.5">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Fonctionnalités</p>
                {KNOWN_FEATURES.map((f) => {
                  const on = !!c.features?.[f.key];
                  return (
                    <div key={f.key} className="flex items-center justify-between">
                      <span className="text-sm text-navy-700">{f.label}</span>
                      <button
                        type="button" onClick={() => onToggle(c, f.key, !on)}
                        className={`relative w-11 h-6 rounded-full transition ${on ? 'bg-brand-orange' : 'bg-slate-300'}`}
                        aria-pressed={on}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition ${on ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {c.error && <p className="text-xs text-red-500 mt-3">Lecture impossible : {c.error}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
