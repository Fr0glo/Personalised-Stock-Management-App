import React, { useEffect, useState } from 'react';
import { Plus, Minus, Warehouse, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [stockNumber, setStockNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStockItems = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('http://localhost:5000/api/stock-items');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const stockItems = await response.json();
        // Now stockItems only contains items with actual stock (quantity > 0)
        setStockNumber(stockItems.length);
      } catch (err) {
        console.error('Error fetching stock items:', err);
        setError('Failed to load stock data');
        setStockNumber(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStockItems();
  }, []); // Empty dependency array - only run once on mount



  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Tableau de bord</h1>
        <p className="text-slate-600 mt-2">Gestion de stock BTP</p>
      </div>

      {/* Two Prominent Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bon d'entrée Button */}
        <button 
          onClick={() => navigate('/bon-entree')}
          className="bg-slate-700 hover:bg-slate-800 text-white p-8 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
        >
          <div className="flex items-center justify-center space-x-4">
            <Plus className="w-12 h-12" />
            <div className="text-left">
              <h2 className="text-2xl font-bold">Bon d'entrée</h2>
              <p className="text-slate-200">Ajouter du stock</p>
            </div>
          </div>
        </button>

        {/* Bon de sortie Button */}
        <button 
          onClick={() => navigate('/bon-sortie')}
          className="bg-slate-700 hover:bg-slate-800 text-white p-8 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
        >
          <div className="flex items-center justify-center space-x-4">
            <Minus className="w-12 h-12" />
            <div className="text-left">
              <h2 className="text-2xl font-bold">Bon de sortie</h2>
              <p className="text-slate-200">Retirer du stock</p>
            </div>
          </div>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stock Statistics */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-slate-100 rounded-lg">
              <Warehouse className="w-8 h-8 text-slate-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                Nombre de stock valable
              </h3>
              {isLoading ? (
                <p className="text-3xl font-bold text-slate-400">...</p>
              ) : error ? (
                <p className="text-lg font-bold text-red-500">Erreur</p>
              ) : (
                <p className="text-3xl font-bold text-slate-700">{stockNumber}</p>
              )}
              <p className="text-sm text-slate-500">
                {isLoading ? 'Chargement...' : error ? error : 'Articles en stock'}
              </p>
            </div>
          </div>
        </div>

        {/* Personnel Statistics */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Home className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                Nombre de personnel actif
              </h3>
              <p className="text-3xl font-bold text-emerald-600">24</p>
              <p className="text-sm text-slate-500">Employés actifs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 