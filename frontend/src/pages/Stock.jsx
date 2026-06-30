import React, { useEffect, useState, useMemo } from 'react';
import { Package, Search, Filter, AlertTriangle, CheckCircle, Edit, Trash2, Plus, Save, X, Lock } from 'lucide-react';

const Stock = () => {
  const [stockItems, setStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState(['', '', '', '']);
  const [editingItems, setEditingItems] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ item_name: '', quantity: 0, unit: 'pcs', notes: '' });

  // The logged-in user, so manual stock edits can be recorded against them.
  const getCurrentUser = () => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const fetchStockItems = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // In edit mode, include items with zero quantity
        const url = isEditMode 
          ? '/api/stock-items?limit=500&includeZero=true'
          : '/api/stock-items?limit=500';
        
        const response = await fetch(url);
        
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
  }, [isEditMode]);

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

  // Split into items in stock vs. épuisé (0). Épuisé items only appear in
  // Admin Editing mode, grouped separately so they don't mix with real stock.
  const inStockItems = useMemo(() => filteredItems.filter(item => item.quantity > 0), [filteredItems]);
  const epuiseItems = useMemo(() => filteredItems.filter(item => item.quantity <= 0), [filteredItems]);

  // Get stock status based on quantity.
  // Uses literal Tailwind class names (not `bg-${color}-50`) so the build
  // actually generates them — dynamic class strings get purged otherwise.
  const getStockStatus = (quantity) => {
    if (quantity === 0) return { status: 'out', icon: AlertTriangle, text: 'Rupture', headerBg: 'bg-red-50', accentText: 'text-red-600' };
    if (quantity < 10) return { status: 'low', icon: AlertTriangle, text: 'Stock faible', headerBg: 'bg-orange-50', accentText: 'text-orange-600' };
    return { status: 'good', icon: CheckCircle, text: 'En stock', headerBg: 'bg-green-50', accentText: 'text-green-600' };
  };

  // Handle PIN code input
  const handlePinChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digit
    if (!/^\d*$/.test(value)) return; // Only allow numbers
    
    const newPin = [...pinCode];
    newPin[index] = value;
    setPinCode(newPin);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  // Handle PIN code backspace
  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinCode[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  // Verify PIN (against the admin code stored on the server) and enable edit mode
  const verifyPin = async () => {
    const enteredPin = pinCode.join('');
    try {
      const res = await fetch('/api/settings/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin })
      });
      const data = await res.json();
      if (data.valid) {
        setIsEditMode(true);
        setShowPinModal(false);
        setPinCode(['', '', '', '']);
      } else {
        alert('Code PIN incorrect');
        setPinCode(['', '', '', '']);
      }
    } catch {
      alert('Erreur de vérification du code');
      setPinCode(['', '', '', '']);
    }
  };

  // Disable edit mode
  const disableEditMode = () => {
    setIsEditMode(false);
    setEditingItems({});
  };

  // Update item quantity and/or unit
  const updateItem = async (itemId, updates) => {
    try {
      const item = stockItems.find(i => i.item_id === itemId);
      if (!item) return;

      const currentUser = getCurrentUser();
      const updateData = {
        item_name: item.item_name,
        quantity: updates.quantity !== undefined ? parseInt(updates.quantity) || 0 : item.quantity,
        unit: updates.unit !== undefined ? updates.unit : item.unit,
        notes: item.notes || '',
        is_dynamic: item.is_dynamic !== undefined ? item.is_dynamic : 1,
        // Unit price (for stock valuation). Empty clears to 0.
        price: updates.price !== undefined ? (parseFloat(updates.price) || 0) : item.price,
        // Record who made the change for the audit trail
        edited_by: currentUser?.user_id ?? currentUser?.username ?? null
      };

      const response = await fetch(`/api/stock-items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) throw new Error('Failed to update item');

      const updatedItem = await response.json();
      setStockItems(prev => prev.map(i => 
        i.item_id === itemId ? updatedItem : i
      ));
      
      // Also update catalog if unit changed
      if (updates.unit !== undefined && updates.unit !== item.unit) {
        try {
          // Find catalog entry by item name
          const catalogResponse = await fetch(`/api/product-catalog?search=${encodeURIComponent(item.item_name)}&limit=1`);
          if (catalogResponse.ok) {
            const catalogItems = await catalogResponse.json();
            const catalogItem = catalogItems.find(c => c.item_name.toLowerCase() === item.item_name.toLowerCase());
            if (catalogItem) {
              await fetch(`/api/product-catalog/${catalogItem.catalog_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  item_name: catalogItem.item_name,
                  default_unit: updates.unit,
                  default_price: catalogItem.default_price || null,
                  notes: catalogItem.notes || ''
                })
              });
            }
          }
        } catch (catalogError) {
          console.error('Error updating catalog:', catalogError);
        }
      }

      setEditingItems(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Erreur lors de la mise à jour de l\'article');
    }
  };

  // Delete item
  const deleteItem = async (itemId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet article?')) return;

    try {
      const item = stockItems.find(i => i.item_id === itemId);
      
      if (!item) {
        alert('Article introuvable');
        return;
      }

      console.log('Attempting to delete item:', itemId, item.item_name);
      
      const response = await fetch(`/api/stock-items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const responseData = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        console.error('Delete failed:', response.status, responseData);
        throw new Error(responseData.error || `Failed to delete item (Status: ${response.status})`);
      }

      console.log('Item deleted successfully:', responseData);
      
      // Remove from state immediately
      setStockItems(prev => {
        const filtered = prev.filter(i => i.item_id !== itemId);
        console.log('Updated stock items count:', filtered.length);
        return filtered;
      });
      
      // Also try to delete from catalog if it exists (non-blocking)
      if (item && item.item_name) {
        try {
          const catalogResponse = await fetch(`/api/product-catalog?search=${encodeURIComponent(item.item_name)}&limit=10`);
          if (catalogResponse.ok) {
            const catalogItems = await catalogResponse.json();
            const catalogItem = catalogItems.find(c => c.item_name.toLowerCase() === item.item_name.toLowerCase());
            if (catalogItem) {
              const catalogDeleteResponse = await fetch(`/api/product-catalog/${catalogItem.catalog_id}`, {
                method: 'DELETE'
              });
              if (catalogDeleteResponse.ok) {
                console.log('Also deleted from catalog');
              }
            }
          }
        } catch (catalogError) {
          console.error('Error deleting from catalog (non-critical):', catalogError);
          // Don't fail the whole operation if catalog delete fails
        }
      }
      
      // Refresh the list to ensure consistency
      setTimeout(async () => {
        try {
          const refreshResponse = await fetch(`/api/stock-items?limit=500&includeZero=${isEditMode ? 'true' : 'false'}`);
          if (refreshResponse.ok) {
            const items = await refreshResponse.json();
            setStockItems(items);
          }
        } catch (refreshError) {
          console.error('Error refreshing list:', refreshError);
        }
      }, 500);
      
    } catch (error) {
      console.error('Error deleting item:', error);
      alert(`Erreur lors de la suppression de l'article: ${error.message}\n\nVérifiez la console pour plus de détails.`);
    }
  };

  // Add new item
  const addNewItem = async () => {
    if (!newItem.item_name.trim()) {
      alert('Le nom de l\'article est requis');
      return;
    }

    try {
      const itemName = newItem.item_name.trim();
      
      // First, check if item exists in catalog
      const catalogSearchResponse = await fetch(`/api/product-catalog?search=${encodeURIComponent(itemName)}&limit=10`);
      let catalogItem = null;
      
      if (catalogSearchResponse.ok) {
        const catalogItems = await catalogSearchResponse.json();
        catalogItem = catalogItems.find(c => c.item_name.toLowerCase() === itemName.toLowerCase());
      }

      // Add or update in product catalog
      if (catalogItem) {
        // Update existing catalog item with new unit if different
        await fetch(`/api/product-catalog/${catalogItem.catalog_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_name: catalogItem.item_name,
            default_unit: newItem.unit || catalogItem.default_unit || 'pcs',
            default_price: catalogItem.default_price || null,
            notes: newItem.notes || catalogItem.notes || ''
          })
        });
      } else {
        // Add new item to catalog
        await fetch('/api/product-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_name: itemName,
            default_unit: newItem.unit || 'pcs',
            default_price: null,
            notes: newItem.notes || ''
          })
        });
      }

      // Then add to stock items
      const response = await fetch('/api/stock-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: itemName,
          quantity: newItem.quantity || 0,
          unit: newItem.unit || 'pcs',
          notes: newItem.notes || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add item');
      }

      const addedItem = await response.json();
      
      // Refresh the list to get all items including zero quantity
      const refreshResponse = await fetch('/api/stock-items?limit=500&includeZero=true');
      if (refreshResponse.ok) {
        const items = await refreshResponse.json();
        setStockItems(items);
      } else {
        setStockItems(prev => [...prev, addedItem]);
      }
      
      setShowAddModal(false);
      setNewItem({ item_name: '', quantity: 0, unit: 'pcs', notes: '' });
    } catch (error) {
      console.error('Error adding item:', error);
      alert(`Erreur lors de l'ajout de l'article: ${error.message}`);
    }
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

  // One stock item card — reused for both the in-stock and épuisé groups.
  const renderStockCard = (item) => {
    const stockStatus = getStockStatus(item.quantity);
    const StatusIcon = stockStatus.icon;

    return (
      <div
        key={item.item_id}
        className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-300 overflow-hidden"
      >
        {/* Card Header with Status */}
        <div className={`p-4 border-b border-slate-100 ${stockStatus.headerBg}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 text-lg leading-tight">
                {item.item_name}
              </h3>
              <div className="flex items-center space-x-2 mt-2">
                <StatusIcon className={`h-4 w-4 ${stockStatus.accentText}`} />
                <span className={`text-sm font-medium ${stockStatus.accentText}`}>
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
            {isEditMode && editingItems[item.item_id] ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={editingItems[item.item_id].quantity || ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setEditingItems(prev => ({
                    ...prev,
                    [item.item_id]: {
                      ...prev[item.item_id],
                      quantity: e.target.value
                    }
                  }))}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                />
                <button
                  onClick={() => updateItem(item.item_id, {
                    quantity: editingItems[item.item_id].quantity,
                    unit: editingItems[item.item_id].unit,
                    price: editingItems[item.item_id].price
                  })}
                  className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
                  title="Enregistrer"
                >
                  <Save className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setEditingItems(prev => {
                    const newState = { ...prev };
                    delete newState[item.item_id];
                    return newState;
                  })}
                  className="p-1 bg-slate-400 text-white rounded hover:bg-slate-500"
                  title="Annuler"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-800">
                  {item.quantity}
                </span>
                {isEditMode && (
                  <button
                    onClick={() => setEditingItems(prev => ({
                      ...prev,
                      [item.item_id]: {
                        quantity: item.quantity,
                        unit: item.unit,
                        price: item.price ?? ''
                      }
                    }))}
                    className="p-1 text-blue-600 hover:text-blue-800"
                    title="Modifier"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Unit */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Unité</span>
            {isEditMode && editingItems[item.item_id] ? (
              <input
                type="text"
                value={editingItems[item.item_id].unit || ''}
                onChange={(e) => setEditingItems(prev => ({
                  ...prev,
                  [item.item_id]: {
                    ...prev[item.item_id],
                    unit: e.target.value
                  }
                }))}
                className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                placeholder="kg, m, pcs..."
              />
            ) : (
              <span className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                {item.unit}
              </span>
            )}
          </div>

          {/* Prix unitaire (for valuation) */}
          {isEditMode && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Prix unitaire (DH)</span>
              {editingItems[item.item_id] ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingItems[item.item_id].price ?? ''}
                  onChange={(e) => setEditingItems(prev => ({
                    ...prev,
                    [item.item_id]: { ...prev[item.item_id], price: e.target.value }
                  }))}
                  className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                  placeholder="0"
                />
              ) : (
                <span className="text-sm font-medium text-slate-700">
                  {item.price ? `${Number(item.price).toLocaleString('fr-FR')} DH` : '—'}
                </span>
              )}
            </div>
          )}

          {/* Emplacement */}
          {item.place && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Emplacement</span>
              <span className="text-sm font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                {item.place}
              </span>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div>
              <span className="text-sm text-slate-600 block mb-1">Notes</span>
              <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded border">
                {item.notes}
              </p>
            </div>
          )}

          {/* Delete Button in Edit Mode */}
          {isEditMode && (
            <button
              onClick={() => deleteItem(item.item_id)}
              className="w-full mt-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          )}

        </div>
      </div>
    );
  };

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

          {/* Admin Editing Button */}
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter
                </button>
                <button
                  onClick={disableEditMode}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Quitter
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Admin Editing
              </button>
            )}
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
        <div className="space-y-8">
          {/* Items actually in stock */}
          {inStockItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {inStockItems.map((item) => renderStockCard(item))}
            </div>
          )}

          {/* Épuisé (à 0) — only appears in Admin Editing mode, grouped apart */}
          {epuiseItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded">
                  <AlertTriangle className="h-4 w-4" />
                  Épuisé ({epuiseItems.length})
                </span>
                <span className="text-sm text-slate-500">
                  articles à 0 — réapprovisionnez-les ou supprimez-les
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {epuiseItems.map((item) => renderStockCard(item))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PIN Code Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <Lock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Code d'accès Admin</h2>
              <p className="text-slate-600">Entrez le code PIN à 4 chiffres</p>
            </div>
            
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  type="password"
                  inputMode="numeric"
                  maxLength="1"
                  value={pinCode[index]}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  className="w-16 h-16 text-center text-2xl font-bold border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setPinCode(['', '', '', '']);
                }}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={verifyPin}
                disabled={pinCode.join('').length !== 4}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Vérifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Ajouter un article</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewItem({ item_name: '', quantity: 0, unit: 'pcs', notes: '' });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nom de l'article *
                </label>
                <input
                  type="text"
                  value={newItem.item_name}
                  onChange={(e) => setNewItem(prev => ({ ...prev, item_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Ciment 25kg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.quantity || ''}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unité
                  </label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="pcs, kg, m3..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newItem.notes}
                  onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Notes optionnelles..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewItem({ item_name: '', quantity: 0, unit: 'pcs', notes: '' });
                }}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={addNewItem}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock; 