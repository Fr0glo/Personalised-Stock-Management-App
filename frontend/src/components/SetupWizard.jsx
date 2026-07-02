import React, { useEffect, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Sparkles } from 'lucide-react';

// First-run onboarding: shown once to the admin until the company is configured.
const SetupWizard = () => {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '', logo: null, tagline: '',
    color_primary: '#14246B', color_accent: '#F1581A',
  });
  const fileRef = useRef(null);

  const me = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  useEffect(() => {
    if (!me || me.role !== 'superadmin') return;
    (async () => {
      try {
        const res = await fetch('/api/company');
        if (!res.ok) return;
        const d = await res.json();
        if (!d.setup_done) {
          setForm(f => ({
            ...f,
            company_name: d.company_name || '',
            color_primary: d.color_primary || f.color_primary,
            color_accent: d.color_accent || f.color_accent,
          }));
          setShow(true);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Logo trop lourd (max 2 Mo).'); return; }
    const reader = new FileReader();
    reader.onloadend = () => set('logo', reader.result);
    reader.readAsDataURL(file);
  };

  const finish = async () => {
    if (!form.company_name.trim()) { alert("Indiquez le nom de l'entreprise."); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, setup_done: 1 }),
      });
      if (!res.ok) throw new Error('Échec');
      setShow(false);
      window.location.reload(); // pick up the new branding everywhere
    } catch (e) {
      alert(`Erreur: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="bg-navy-700 text-white p-6">
          <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6" /> Bienvenue</h2>
          <p className="text-navy-200 mt-1">Configurons votre entreprise — cela apparaîtra sur l'application et vos bons.</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex gap-4 items-center">
            <div className="w-24 h-24 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden bg-white p-2 flex-shrink-0">
              {form.logo ? <img src={form.logo} alt="Logo" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="h-8 w-8 text-slate-300" />}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-1">
                <Upload className="h-4 w-4" /> Logo (optionnel)
              </button>
              <p className="text-xs text-slate-400 mt-1">PNG/JPG, max 2 Mo.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'entreprise *</label>
            <input
              type="text" value={form.company_name} onChange={(e) => set('company_name', e.target.value)}
              placeholder="Ex: BTP Oulime"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Slogan / activité (optionnel)</label>
            <input
              type="text" value={form.tagline} onChange={(e) => set('tagline', e.target.value)}
              placeholder="Ex: Bâtiment & Travaux Publics"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Couleur principale
              <input type="color" value={form.color_primary} onChange={(e) => set('color_primary', e.target.value)} className="w-10 h-8 rounded border border-slate-300" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Accent
              <input type="color" value={form.color_accent} onChange={(e) => set('color_accent', e.target.value)} className="w-10 h-8 rounded border border-slate-300" />
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex items-center justify-end">
          {/* No "later" — the company must be configured before using the app */}
          <button
            onClick={finish} disabled={saving}
            className="px-5 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50 font-medium"
          >
            {saving ? 'Enregistrement…' : 'Terminer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
