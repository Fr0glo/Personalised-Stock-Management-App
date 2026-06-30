import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, Plus, FileText, Calendar, User } from 'lucide-react';
import { generateBonCommandePdf } from '../utils/generateBonCommandePdf';

const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const BonCommandeHistorique = () => {
  const navigate = useNavigate();
  const [bons, setBons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/bon-commande');
        if (!res.ok) throw new Error('Échec du chargement');
        setBons(await res.json());
      } catch (err) {
        console.error('Historique load error:', err);
        setError('Impossible de charger l\'historique.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const download = async (bon) => {
    try {
      await generateBonCommandePdf(bon);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Erreur lors de la génération du PDF');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Historique des bons de commande</h1>
          <p className="text-slate-600 mt-1">Tous les bons de commande créés.</p>
        </div>
        <button
          onClick={() => navigate('/bon-commande')}
          className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nouveau bon
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">{error}</div>
      ) : bons.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
          <FileText className="h-14 w-14 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">Aucun bon de commande</h3>
          <p className="text-slate-500">Créez votre premier bon depuis la page Bon de Commande.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bons.map((bon) => (
            <div key={bon.bc_id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-navy-700 rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-mono font-semibold text-slate-800">{bon.numero}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {bon.demande_par}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDateTime(bon.created_at)}</span>
                    <span>{bon.items?.length || 0} article{(bon.items?.length || 0) > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => download(bon)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
              >
                <FileDown className="h-4 w-4" /> Télécharger PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BonCommandeHistorique;
