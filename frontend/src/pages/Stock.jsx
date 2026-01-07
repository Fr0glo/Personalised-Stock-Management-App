import React, { useEffect, useState, useMemo } from 'react';
import { Package, Search, Filter, AlertTriangle, CheckCircle } from 'lucide-react';

const Stock = () => {
  const [stockItems, setStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');

  useEffect(() => {
    const fetchStockItems = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Limit to 500 items for performance (can be increased if needed)
        const response = await fetch('http://localhost:5000/api/stock-items?limit=500');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const items = await response.json();
        setStockItems(items);
      } catch (err) {
        console.error('Error fetching stock items:', err);
        setError('Failed to load stock data');
        setStockItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStockItems();
  }, []);

  // Memoize unique units calculation
  const uniqueUnits = useMemo(() => {
    return [...new Set(stockItems.map(item => item.unit))];
  }, [stockItems]);

  // Memoize filtered items to avoid recalculating on every render
  const filteredItems = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return stockItems.filter(item => {
      const matchesSearch = item.item_name.toLowerCase().includes(lowerSearch) ||
                           item.notes?.toLowerCase().includes(lowerSearch);
      const matchesUnit = filterUnit === 'all' || item.unit === filterUnit;
      return matchesSearch && matchesUnit;
    });
  }, [stockItems, searchTerm, filterUnit]);

  // Get stock status based on quantity
  const getStockStatus = (quantity) => {
    if (quantity === 0) return { status: 'out', color: 'red', icon: AlertTriangle, text: 'Rupture' };
    if (quantity < 10) return { status: 'low', color: 'orange', icon: AlertTriangle, text: 'Stock faible' };
    return { status: 'good', color: 'green', icon: CheckCircle, text: 'En stock' };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Gestion du Stock</h1>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Chargement du stock...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Gestion du Stock</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Erreur de chargement</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Gestion du Stock</h1>
        <p className="text-slate-600 mt-2">
          {filteredItems.length} article{filteredItems.length !== 1 ? 's' : ''} en stock
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Unit Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">Toutes les unités</option>
                {uniqueUnits.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
          <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun article trouvé</h3>
          <p className="text-slate-500">
            {searchTerm || filterUnit !== 'all' 
              ? 'Essayez de modifier vos critères de recherche' 
              : 'Commencez par ajouter des articles au stock'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => {
            const stockStatus = getStockStatus(item.quantity);
            const StatusIcon = stockStatus.icon;
            
            return (
              <div
                key={item.item_id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-300 overflow-hidden"
              >
                {/* Card Header with Status */}
                <div className={`p-4 border-b border-slate-100 bg-${stockStatus.color}-50`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 text-lg leading-tight">
                        {item.item_name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-2">
                        <StatusIcon className={`h-4 w-4 text-${stockStatus.color}-600`} />
                        <span className={`text-sm font-medium text-${stockStatus.color}-600`}>
                          {stockStatus.text}
                        </span>
                      </div>
                    </div>
                    <Package className="h-8 w-8 text-slate-400" />
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Quantity */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Quantité</span>
                    <span className="text-2xl font-bold text-slate-800">
                      {item.quantity}
                    </span>
                  </div>

                  {/* Unit */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Unité</span>
                    <span className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                      {item.unit}
                    </span>
                  </div>

                  {/* Notes */}
                  {item.notes && (
                    <div>
                      <span className="text-sm text-slate-600 block mb-1">Notes</span>
                      <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded border">
                        {item.notes}
                      </p>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Stock; 