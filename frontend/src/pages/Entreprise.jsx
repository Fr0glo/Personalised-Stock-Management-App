import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, Upload, Save, Image as ImageIcon } from 'lucide-react';

const EMPTY = {
  company_name: '', logo: null, address: '', phone: '', ice: '', email: '',
  tagline: '', color_primary: '#14246B', color_accent: '#F1581A', bon_template: 'classic',
};

const Entreprise = () => {
  const [form, setForm] = useState(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const fileRef = useRef(null);

  const me = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  useEffect(() => {
    const load = async () => {
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
    };
    load();
  }, []);

  if (me && me.role !== 'superadmin') return <Navigate to="/" replace />;

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
      setSavedAt(Date.now());
    } catch (err) {
      alert(`Erreur lors de l'enregistrement: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-600" /></div>;
  }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="h-7 w-7" /> Entreprise
          </h1>
          <p className="text-slate-600 mt-1">Votre logo, vos coordonnées et vos couleurs — utilisés sur l'application et les bons.</p>
        </div>
        <button
          onClick={save} disabled={isSaving}
          className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 disabled:opacity-50 flex items-center gap-2 font-medium"
        >
          <Save className="h-4 w-4" /> {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {savedAt && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">Enregistré ✓</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logo + colors */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Logo &amp; couleurs</h2>
          <div className="flex flex-col items-center">
            <div className="w-40 h-40 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 mb-3">
              {form.logo
                ? <img src={form.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                : <ImageIcon className="h-10 w-10 text-slate-300" />}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-1">
              <Upload className="h-4 w-4" /> Choisir un logo
            </button>
            {form.logo && (
              <button onClick={() => set('logo', null)} className="mt-1 text-xs text-red-500 hover:text-red-700">Retirer</button>
            )}
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Couleur principale</span>
              <input type="color" value={form.color_primary} onChange={(e) => set('color_primary', e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Couleur accent</span>
              <input type="color" value={form.color_accent} onChange={(e) => set('color_accent', e.target.value)} className="w-12 h-8 rounded border border-slate-300" />
            </div>
          </div>
        </div>

        {/* Company info */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Coordonnées</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field("Nom de l'entreprise *", 'company_name', 'Ex: BTP Oulime')}
            {field('Slogan / activité', 'tagline', 'Ex: Bâtiment & Travaux Publics')}
            {field('Adresse', 'address')}
            {field('Téléphone', 'phone')}
            {field('ICE', 'ice')}
            {field('Email', 'email')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Entreprise;
