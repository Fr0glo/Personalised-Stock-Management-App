import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, Trash2, FileDown, ClipboardList, Package, Check } from 'lucide-react';
import axios from 'axios';
import { generateBonCommandePdf } from '../utils/generateBonCommandePdf';

const BonCommande = () => {
  const navigate = useNavigate();
  const [stockItems, setStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [order, setOrder] = useState([]); // { item_id, article, qte, unite }
  const [isGenerating, setIsGenerating] = useState(false);

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await axios.get('/api/stock-items?limit=1000'); // only items in stock (qty > 0)
        setStockItems(res.data || []);
      } catch (err) {
        console.error('Stock load failed:', err);
        setStockItems([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return stockItems;
    return stockItems.filter(s => s.item_name.toLowerCase().includes(f));
  }, [stockItems, filter]);

  const inOrder = (id) => order.find(o => o.item_id === id);

  const add = (s) => setOrder(prev => prev.some(o => o.item_id === s.item_id)
    ? prev
    : [...prev, { item_id: s.item_id, article: s.item_name, qte: 1, unite: s.unit || 'U' }]);
  const setQte = (id, qte) => setOrder(prev => prev.map(o => o.item_id === id ? { ...o, qte: Math.max(0, qte) } : o));
  const remove = (id) => setOrder(prev => prev.filter(o => o.item_id !== id));

  const generate = async () => {
    if (order.length === 0) { alert('Ajoutez au moins un article'); return; }
    setIsGenerating(true);
    try {
      const res = await axios.post('/api/bon-commande', {
        demande_par: currentUser?.username || 'Inconnu',
        items: order.map(o => ({ article: o.article, qte: o.qte, unite: o.unite }))
      });
      await generateBonCommandePdf(res.data);
      setOrder([]);
    } catch (err) {
      console.error('Error generating bon de commande:', err);
      alert(`Erreur lors de la génération: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Bon de Commande</h1>
          <p className="text-slate-600 mt-1">Choisissez les articles en stock à préparer, puis générez le PDF.</p>
        </div>
        <button
          onClick={() => navigate('/bon-commande/historique')}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <ClipboardList className="h-4 w-4" /> Historique
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: browsable stock */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Package className="h-5 w-5" /> Articles en stock
          </h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer les articles…"
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">
              {stockItems.length === 0 ? 'Aucun article en stock.' : 'Aucun article ne correspond au filtre.'}
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {filtered.map((s) => {
                const sel = inOrder(s.item_id);
                return (
                  <div key={s.item_id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{s.item_name}</p>
                      <p className="text-xs text-slate-500">Disponible : {s.quantity} {s.unit}</p>
                    </div>
                    {sel ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQte(s.item_id, sel.qte - 1)} className="p-1 hover:bg-slate-100 rounded"><Minus className="h-4 w-4" /></button>
                        <input
                          type="number" min="0" value={sel.qte || ''} placeholder="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setQte(s.item_id, parseInt(e.target.value) || 0)}
                          className="w-14 px-1 py-1 border border-slate-300 rounded text-center text-sm"
                        />
                        <button onClick={() => setQte(s.item_id, sel.qte + 1)} className="p-1 hover:bg-slate-100 rounded"><Plus className="h-4 w-4" /></button>
                        <span className="text-xs text-slate-500 w-10 text-center">{sel.unite}</span>
                        <button onClick={() => remove(s.item_id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => add(s)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1 whitespace-nowrap"
                      >
                        <Plus className="h-4 w-4" /> Ajouter
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: order summary + generate */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Document</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Demandé par</span>
                <span className="font-medium text-slate-800">{currentUser?.username || 'Inconnu'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Articles choisis</span>
                <span className="font-medium text-slate-800">{order.length}</span>
              </div>
              <p className="text-xs text-slate-400 pt-2">Le numéro, la date et l'heure sont ajoutés automatiquement.</p>
            </div>

            {order.length > 0 && (
              <div className="mt-4 max-h-48 overflow-y-auto space-y-1 border-t border-slate-100 pt-3">
                {order.map(o => (
                  <div key={o.item_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-slate-700 truncate">
                      <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" /> {o.article}
                    </span>
                    <span className="text-slate-500 whitespace-nowrap ml-2">{o.qte} {o.unite}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={generate}
              disabled={order.length === 0 || isGenerating}
              className="w-full mt-5 bg-navy-700 text-white py-3 px-4 rounded-lg hover:bg-navy-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <FileDown className="h-5 w-5" />
              {isGenerating ? 'Génération…' : 'Générer un PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BonCommande;
