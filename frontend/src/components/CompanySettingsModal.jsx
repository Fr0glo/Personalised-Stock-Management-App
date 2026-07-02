import React, { useEffect, useRef, useState } from 'react';
import { Building2, Upload, Save, Image as ImageIcon, X } from 'lucide-react';

const EMPTY = {
  company_name: '', logo: null, address: '', phone: '', ice: '', email: '',
  tagline: '', color_primary: '#14246B', color_accent: '#F1581A', bon_template: 'classic',
};

// Company settings as a popup (opened from the gear button in the topbar).
const CompanySettingsModal = ({ onClose }) => {
  const [form, setForm] = useState(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/company');
        if (res.ok) {
          const d = await res.json();
          setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(d).filter(([k, v]) => k in EMPTY && v !== null)) });
        }
      } catch (err) {
        console.error('Company load error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Logo trop lourd (max 2 Mo).'); return; }
    const reader = new FileReader();
    reader.onloadend = () => set('logo', reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.company_name.trim()) { alert("Le nom de l'entreprise est requis."); return; }
    setIsSaving(true);
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Échec');
      // Reload so the new logo, name and colours apply everywhere.
      window.location.reload();
    } catch (err) {
      alert(`Erreur lors de l'enregistrement: ${err.message}`);
      setIsSaving(false);
    }
  };

  const field = (label, key, placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text" value={form[key]} onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Réglages de l'entreprise
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600" /></div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Logo + colors + template */}
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden bg-white p-2 mb-2">
                  {form.logo
                    ? <img src={form.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    : <ImageIcon className="h-9 w-9 text-slate-300" />}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-1">
                  <Upload className="h-4 w-4" /> Choisir un logo
                </button>
                <p className="text-[11px] text-slate-400 mt-1">PNG transparent recommandé</p>
                {form.logo && (
                  <button onClick={() => set('logo', null)} className="mt-1 text-xs text-red-500 hover:text-red-700">Retirer</button>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Couleur principale</span>
                  <input type="color" value={form.color_primary} onChange={(e) => set('color_primary', e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Couleur accent</span>
                  <input type="color" value={form.color_accent} onChange={(e) => set('color_accent', e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
                </div>
                <div>
                  <span className="text-sm text-slate-600 block mb-2">Modèle de bon</span>
                  <div className="flex gap-2">
                    {[['classic', 'Classique'], ['epure', 'Épuré']].map(([val, lbl]) => (
                      <button
                        key={val} onClick={() => set('bon_template', val)}
                        className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${form.bon_template === val ? 'border-navy-700 bg-navy-50 text-navy-700 font-medium' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Company info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field("Nom de l'entreprise *", 'company_name', 'Ex: BTP Oulime')}
              {field('Slogan / activité', 'tagline', 'Ex: Bâtiment & Travaux Publics')}
              {field('Adresse', 'address')}
              {field('Téléphone', 'phone')}
              {field('ICE', 'ice')}
              {field('Email', 'email')}
            </div>
          </div>
        )}

        <div className="p-5 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Annuler</button>
          <button
            onClick={save} disabled={isSaving || isLoading}
            className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50 flex items-center gap-2 font-medium"
          >
            <Save className="h-4 w-4" /> {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanySettingsModal;
