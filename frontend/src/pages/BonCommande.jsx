import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, Trash2, FileDown, ClipboardList } from 'lucide-react';
import axios from 'axios';
import { generateBonCommandePdf } from '../utils/generateBonCommandePdf';

const BonCommande = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [items, setItems] = useState([]); // { key, article, qte, unite }
  const [isGenerating, setIsGenerating] = useState(false);

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  const search = async (term) => {
    if (term.trim().length < 2) { setSearchResults([]); setShowResults(false); return; }
    setIsSearching(true);
    try {
      // Only items we actually have in stock (the magasinier prepares from stock)
      const res = await axios.get(`/api/stock-items?search=${encodeURIComponent(term.trim())}&limit=20`);
      setSearchResults(res.data || []);
      setShowResults(true);
    } catch (err) {
      console.error('Stock search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addItem = (article, unite) => {
    setItems(prev => {
      const i = prev.findIndex(it => it.article.toLowerCase() === article.toLowerCase());
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], qte: copy[i].qte + 1 };
        return copy;
      }
      return [...prev, { key: `${Date.now()}_${Math.random()}`, article, qte: 1, unite: unite || 'U' }];
    });
    setSearchTerm('');
    setShowResults(false);
    setSearchResults([]);
  };

  const updateQte = (key, qte) => setItems(prev => prev.map(it => it.key === key ? { ...it, qte: Math.max(0, qte) } : it));
  const updateUnite = (key, unite) => setItems(prev => prev.map(it => it.key === key ? { ...it, unite } : it));
  const removeItem = (key) => setItems(prev => prev.filter(it => it.key !== key));

  const generate = async () => {
    if (items.length === 0) { alert('Ajoutez au moins un article'); return; }
    setIsGenerating(true);
    try {
      const res = await axios.post('/api/bon-commande', {
        demande_par: currentUser?.username || 'Inconnu',
        items: items.map(it => ({ article: it.article, qte: it.qte, unite: it.unite }))
      });
      await generateBonCommandePdf(res.data);
      // Reset the form after a successful generation
      setItems([]);
    } catch (err) {
      console.error('Error generating bon de commande:', err);
      const msg = err.response?.data?.error || err.message;
      alert(`Erreur lors de la génération: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Bon de Commande</h1>
          <p className="text-slate-600 mt-1">Sélectionnez les articles, puis générez le PDF à envoyer au magasinier.</p>
        </div>
        <button
          onClick={() => navigate('/bon-commande/historique')}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <ClipboardList className="h-4 w-4" /> Historique
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: search + items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Search className="h-5 w-5" /> Rechercher un article
            </h2>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); search(e.target.value); }}
                placeholder="Tapez le nom de l'article en stock…"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {isSearching && (
                <div className="absolute right-3 top-3 animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              )}
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="mt-3 max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                {searchResults.map((p) => (
                  <div
                    key={p.item_id}
                    onClick={() => addItem(p.item_name, p.unit)}
                    className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center"
                  >
                    <span className="font-medium text-slate-800">{p.item_name}</span>
                    <span className="text-xs text-slate-500">Stock : {p.quantity} {p.unit}</span>
                  </div>
                ))}
              </div>
            )}

            {searchTerm.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">
                Aucun article en stock pour « {searchTerm.trim()} ». Seuls les articles disponibles en stock peuvent être commandés.
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Articles ({items.length})</h2>
            {items.length === 0 ? (
              <p className="text-slate-400 text-sm py-6 text-center">Aucun article. Recherchez et ajoutez des articles ci-dessus.</p>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.key} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                    <span className="flex-1 font-medium text-slate-800">{it.article}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQte(it.key, it.qte - 1)} className="p-1 hover:bg-slate-100 rounded"><Minus className="h-4 w-4" /></button>
                      <input
                        type="number" min="0" value={it.qte}
                        onChange={(e) => updateQte(it.key, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                      />
                      <button onClick={() => updateQte(it.key, it.qte + 1)} className="p-1 hover:bg-slate-100 rounded"><Plus className="h-4 w-4" /></button>
                    </div>
                    <input
                      type="text" value={it.unite}
                      onChange={(e) => updateUnite(it.key, e.target.value)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                      placeholder="Unité"
                    />
                    <button onClick={() => removeItem(it.key)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: summary + generate */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Document</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Demandé par</span>
                <span className="font-medium text-slate-800">{currentUser?.username || 'Inconnu'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Articles</span>
                <span className="font-medium text-slate-800">{items.length}</span>
              </div>
              <p className="text-xs text-slate-400 pt-2">Le numéro, la date et l'heure sont ajoutés automatiquement.</p>
            </div>
            <button
              onClick={generate}
              disabled={items.length === 0 || isGenerating}
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
