import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle, Package, ArrowDownCircle,
  ArrowUpCircle, Coins, MapPin, CheckCircle, X
} from 'lucide-react';

const MONTH_LABELS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${MONTH_LABELS[Number(m) - 1]} ${y}`;
};
const monthShort = (ym) => MONTH_LABELS[Number(ym.split('-')[1]) - 1];

const fmtMoney = (n) => `${Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`;
const fmtNum = (n) => Number(n || 0).toLocaleString('fr-FR');

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const Analyse = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verification modal state
  const [verifyTarget, setVerifyTarget] = useState(null); // the hors-stock row being verified
  const [verifyForm, setVerifyForm] = useState({ quantity: '', unit: 'pcs', price: '', place: '' });
  const [verifyBusy, setVerifyBusy] = useState(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/analytics/overview');
      if (!res.ok) throw new Error('Échec du chargement');
      setData(await res.json());
    } catch (err) {
      console.error('Analyse load error:', err);
      setError('Impossible de charger les données.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openVerify = (row) => {
    setVerifyForm({ quantity: '', unit: 'pcs', price: '', place: '' });
    setVerifyTarget(row);
  };

  const submitVerify = async (promote) => {
    if (!verifyTarget) return;
    setVerifyBusy(true);
    try {
      const res = await fetch('/api/analytics/hors-stock/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: verifyTarget.name,
          promote,
          quantity: verifyForm.quantity,
          unit: verifyForm.unit,
          price: verifyForm.price === '' ? null : parseFloat(verifyForm.price),
          place: verifyForm.place,
          verified_by: user?.user_id ?? user?.username ?? null
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.details || e.error || 'Échec');
      }
      setVerifyTarget(null);
      await fetchData();
    } catch (err) {
      console.error('Verify error:', err);
      alert(`Erreur lors de la vérification: ${err.message}`);
    } finally {
      setVerifyBusy(false);
    }
  };

  // Admin-only page (client admin + platform owner)
  if (user && !['superadmin', 'owner'].includes(user.role)) return <Navigate to="/" replace />;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Analyse</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Analyse</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
          {error || 'Aucune donnée'}
        </div>
      </div>
    );
  }

  const { horsStock, mouvements, valeur } = data;
  const maxTrend = Math.max(1, ...horsStock.trend.map(t => t.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Analyse</h1>
        <p className="text-slate-600 mt-1">Tableau de bord — {monthLabel(data.month)}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Bons de sortie */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Bons de sortie (mois)</span>
            <ArrowDownCircle className="h-5 w-5 text-red-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800">{fmtNum(mouvements.exitCount)}</span>
            <span className="text-sm text-slate-400">bons</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{fmtNum(mouvements.exitQty)} unités sorties</p>
        </div>

        {/* Bons d'entrée */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Bons d'entrée (mois)</span>
            <ArrowUpCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800">{fmtNum(mouvements.entryCount)}</span>
            <span className="text-sm text-slate-400">bons</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{fmtNum(mouvements.entryQty)} unités entrées</p>
        </div>

        {/* Valeur */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Valeur du stock</span>
            <Coins className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-bold text-slate-800">{fmtMoney(valeur.total)}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {valeur.unpricedItems > 0
              ? `${fmtNum(valeur.unpricedItems)} article(s) sans prix — ajoutez-les dans Stock`
              : 'Tous les articles ont un prix'}
          </p>
        </div>
      </div>

      {/* Hors-stock: à vérifier + trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* À vérifier table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">À vérifier — articles hors stock du mois</h2>
          <p className="text-sm text-slate-500 mb-4">
            Articles sortis du dépôt sans figurer dans le stock. À contrôler dans le dépôt.
          </p>
          {horsStock.aVerifier.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Package className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              Aucun article hors stock ce mois-ci. 👍
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Article</th>
                    <th className="py-2 px-3 font-medium text-right">Qté</th>
                    <th className="py-2 px-3 font-medium text-right">Fois</th>
                    <th className="py-2 px-3 font-medium">Pris par</th>
                    <th className="py-2 px-3 font-medium">Bons</th>
                    <th className="py-2 pl-3 font-medium text-right">Dernier</th>
                    <th className="py-2 pl-3 font-medium text-right">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {horsStock.aVerifier.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{r.name}</td>
                      <td className="py-2 px-3 text-right">{fmtNum(r.total_qty)}</td>
                      <td className="py-2 px-3 text-right">{fmtNum(r.occurrences)}</td>
                      <td className="py-2 px-3 text-slate-600">{r.takers || '—'}</td>
                      <td className="py-2 px-3 text-slate-600">{r.vouchers || '—'}</td>
                      <td className="py-2 pl-3 text-right text-slate-500">{fmtDate(r.last_date)}</td>
                      <td className="py-2 pl-3 text-right">
                        <button
                          onClick={() => openVerify(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Vérifier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 6-month trend bars */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Hors stock — 6 mois</h2>
          <p className="text-sm text-slate-500 mb-4">Évolution des fautes par mois.</p>
          <div className="flex items-end justify-between gap-2 h-40">
            {horsStock.trend.map((t) => (
              <div key={t.month} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs font-medium text-slate-600 mb-1">{t.count}</span>
                <div
                  className={`w-full rounded-t ${t.month === data.month ? 'bg-yellow-500' : 'bg-slate-300'}`}
                  style={{ height: `${Math.max(4, (t.count / maxTrend) * 100)}%` }}
                  title={`${monthLabel(t.month)}: ${t.count}`}
                ></div>
                <span className="text-[10px] text-slate-400 mt-1">{monthShort(t.month)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Récurrents + Mouvements + Valeur par emplacement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recurrents */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Récurrents</h2>
          <p className="text-sm text-slate-500 mb-4">Noms qui reviennent souvent hors stock — à ajouter au stock.</p>
          {horsStock.recurrents.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun article récurrent.</p>
          ) : (
            <ul className="space-y-2">
              {horsStock.recurrents.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{r.name}</span>
                  <span className="text-slate-500">{fmtNum(r.occurrences)}× · {fmtNum(r.total_qty)} u.</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Articles hors stock */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" /> Articles hors stock
          </h2>
          <p className="text-sm text-slate-500 mb-4">Sortis du dépôt sans figurer dans le stock (ce mois-ci).</p>
          {horsStock.aVerifier.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun article hors stock ce mois-ci.</p>
          ) : (
            <ul className="space-y-2">
              {horsStock.aVerifier.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{r.name}</span>
                  <span className="font-medium text-slate-700">{fmtNum(r.total_qty)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Valeur par emplacement */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-400" /> Valeur par emplacement
          </h2>
          <p className="text-sm text-slate-500 mb-4">Répartition de la valeur du stock.</p>
          {valeur.byPlace.length === 0 ? (
            <p className="text-slate-400 text-sm">Ajoutez des prix aux articles pour voir la valeur.</p>
          ) : (
            <ul className="space-y-2">
              {valeur.byPlace.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{r.place}</span>
                  <span className="font-medium text-slate-700">{fmtMoney(r.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Verification modal */}
      {verifyTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Vérifier « {verifyTarget.name} »</h2>
              <button onClick={() => setVerifyTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Cet article est sorti du dépôt sans être dans le stock. Vérifiez dans le dépôt :
                s'il y en a encore, indiquez la quantité présente pour l'ajouter au stock.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantité présente dans le dépôt</label>
                <input
                  type="number" min="0" step="1"
                  value={verifyForm.quantity}
                  onChange={(e) => setVerifyForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ex: 12"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unité</label>
                  <input
                    type="text"
                    value={verifyForm.unit}
                    onChange={(e) => setVerifyForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="pcs, kg..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prix unitaire (DH)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={verifyForm.price}
                    onChange={(e) => setVerifyForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Optionnel"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Emplacement</label>
                <input
                  type="text"
                  value={verifyForm.place}
                  onChange={(e) => setVerifyForm(f => ({ ...f, place: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Optionnel"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 p-6 border-t border-slate-200">
              <button
                onClick={() => submitVerify(true)}
                disabled={verifyBusy}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" /> Ajouter au stock & vérifier
              </button>
              <button
                onClick={() => submitVerify(false)}
                disabled={verifyBusy}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Introuvable — marquer vérifié sans ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analyse;
