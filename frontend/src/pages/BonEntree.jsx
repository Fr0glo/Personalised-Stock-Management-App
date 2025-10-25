import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Package, User, Calendar, Save, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const BonEntree = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [voucherData, setVoucherData] = useState({
    voucherNumber: '',
    date: new Date().toISOString().split('T')[0],
    handledBy: '',
    takenBy: '',
    notes: ''
  });

  const [adminUsers, setAdminUsers] = useState([]);
  const [workers, setWorkers] = useState([]);

  // Fetch users and workers on component mount
  useEffect(() => {
    const fetchUsersAndWorkers = async () => {
      try {
        // Fetch admin users
        const usersResponse = await fetch('http://localhost:5000/api/users');
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          setAdminUsers(users.filter(user => user.role === 'admin'));
        }

        // Fetch workers
        const workersResponse = await fetch('http://localhost:5000/api/workers');
        if (workersResponse.ok) {
          const workersData = await workersResponse.json();
          setWorkers(workersData);
        }
      } catch (error) {
        console.error('Error fetching users and workers:', error);
      }
    };

    fetchUsersAndWorkers();
  }, []);

  // Search for products in catalog
  const searchProducts = async (term) => {
    if (term.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(`http://localhost:5000/api/product-catalog?search=${encodeURIComponent(term)}&limit=20`);
      setSearchResults(response.data);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    searchProducts(value);
  };

  // Add item to selected items
  const addItem = (product) => {
    const existingItem = selectedItems.find(item => item.catalog_id === product.catalog_id);
    
    if (existingItem) {
      // Update quantity if item already exists
      setSelectedItems(prev => prev.map(item => 
        item.catalog_id === product.catalog_id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      // Add new item from catalog
      const newItem = {
        catalog_id: product.catalog_id,
        item_name: product.item_name,
        quantity: 1,
        unit: product.default_unit || 'pcs',
        notes: product.notes || '',
        current_stock: 0 // Will be updated when added to stock
      };
      setSelectedItems(prev => [...prev, newItem]);
    }
    
    // Clear search
    setSearchTerm('');
    setShowSearchResults(false);
  };

  // Update item quantity
  const updateQuantity = (catalogId, newQuantity) => {
    if (newQuantity < 0) return;
    
    setSelectedItems(prev => prev.map(item => 
      item.catalog_id === catalogId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  // Update item unit
  const updateUnit = (catalogId, newUnit) => {
    setSelectedItems(prev => prev.map(item => 
      item.catalog_id === catalogId 
        ? { ...item, unit: newUnit }
        : item
    ));
  };

  // Remove item from selected items
  const removeItem = (catalogId) => {
    setSelectedItems(prev => prev.filter(item => item.catalog_id !== catalogId));
  };

  // Add new product (if not found in search)
  const addNewProduct = () => {
    if (!searchTerm.trim()) return;
    
    const newItem = {
      catalog_id: `new_${Date.now()}`, // Temporary ID for new items
      item_name: searchTerm.trim(),
      quantity: 1,
      unit: 'pcs',
      notes: '',
      current_stock: 0,
      isNew: true
    };
    
    setSelectedItems(prev => [...prev, newItem]);
    setSearchTerm('');
    setShowSearchResults(false);
  };

  // Get next voucher number
  const getNextVoucherNumber = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/entry-vouchers');
      const vouchers = response.data;
      const nextNumber = vouchers.length + 1;
      return nextNumber.toString();
    } catch (error) {
      console.error('Error getting voucher number:', error);
      return '1';
    }
  };

  // Submit voucher
  const submitVoucher = async () => {
    if (selectedItems.length === 0) {
      alert('Veuillez ajouter au moins un article');
      return;
    }

    if (!voucherData.handledBy.trim()) {
      alert('Veuillez indiquer qui a géré ce bon');
      return;
    }

    if (!voucherData.takenBy.trim()) {
      alert('Veuillez indiquer qui a pris les articles');
      return;
    }


    try {
      // Get next voucher number
      const voucherNumber = voucherData.voucherNumber || await getNextVoucherNumber();

      // Create entry voucher
      const voucherResponse = await axios.post('http://localhost:5000/api/entry-vouchers', {
        voucher_number: voucherNumber,
        date: voucherData.date,
        handled_by: voucherData.handledBy,
        taken_by: voucherData.takenBy,
        notes: voucherData.notes
      });

      const voucherId = voucherResponse.data.voucher_id;

      // Add each item to the voucher and stock
      for (const item of selectedItems) {
        // Add item to stock (this will create new stock item or update existing)
        const stockResponse = await axios.post('http://localhost:5000/api/stock-items', {
          item_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes
        });

        const stockItem = stockResponse.data;

        // Add to voucher details
        await axios.post('http://localhost:5000/api/entry-vouchers/details', {
          voucher_id: voucherId,
          item_id: stockItem.item_id,
          quantity: item.quantity
        });
      }

      alert('Bon d\'entrée créé avec succès!');
      
      // Reset form
      setSelectedItems([]);
      setVoucherData({
        voucherNumber: '',
        date: new Date().toISOString().split('T')[0],
        handledBy: '',
        takenBy: '',
        notes: ''
      });
      
    } catch (error) {
      console.error('Error creating voucher:', error);
      alert('Erreur lors de la création du bon d\'entrée');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => window.history.back()}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Bon d'Entrée</h1>
            <p className="text-slate-600">Ajouter des articles au stock</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Search and Add Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Rechercher des Articles
              </h2>
              
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Tapez le nom de l'article..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500"></div>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                  {searchResults.map((product) => (
                    <div
                      key={product.catalog_id}
                      onClick={() => addItem(product)}
                      className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-slate-800">{product.item_name}</p>
                          <p className="text-sm text-slate-500">
                            Unité par défaut: {product.default_unit || 'pcs'}
                            {product.notes && ` • ${product.notes}`}
                          </p>
                        </div>
                        <Plus className="w-4 h-4 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Product Button */}
              {searchTerm && searchResults.length === 0 && !isSearching && (
                <div className="mt-4">
                  <button
                    onClick={addNewProduct}
                    className="w-full p-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter "{searchTerm}" comme nouveau produit
                  </button>
                </div>
              )}
            </div>

            {/* Selected Items */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Articles Sélectionnés ({selectedItems.length})
              </h2>

              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Aucun article sélectionné</p>
                  <p className="text-sm">Recherchez et ajoutez des articles ci-dessus</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map((item) => (
                    <div key={item.catalog_id} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium text-slate-800">{item.item_name}</h3>
                          {item.isNew && (
                            <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              Nouveau produit
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(item.catalog_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Quantity */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Quantité
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.catalog_id, item.quantity - 1)}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.catalog_id, parseInt(e.target.value))}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                              min="0"
                            />
                            <button
                              onClick={() => updateQuantity(item.catalog_id, item.quantity + 1)}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Unit */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Unité
                          </label>
                          <select
                            value={item.unit}
                            onChange={(e) => updateUnit(item.catalog_id, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          >
                            <option value="pcs">Pièces</option>
                            <option value="kg">Kilogrammes</option>
                            <option value="m">Mètres</option>
                            <option value="m²">Mètres carrés</option>
                            <option value="m³">Mètres cubes</option>
                            <option value="L">Litres</option>
                            <option value="sac">Sacs</option>
                            <option value="tonnes">Tonnes</option>
                            <option value="boîte">Boîtes</option>
                            <option value="rouleau">Rouleaux</option>
                          </select>
                        </div>

                        {/* Current Stock */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Stock Actuel
                          </label>
                          <div className="px-3 py-2 bg-slate-100 rounded-lg text-slate-600">
                            {item.current_stock} {item.unit}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Voucher Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Détails du Bon
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Numéro du Bon
                  </label>
                  <input
                    type="text"
                    value={voucherData.voucherNumber}
                    onChange={(e) => setVoucherData(prev => ({ ...prev, voucherNumber: e.target.value }))}
                    placeholder="Auto-généré si vide"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={voucherData.date}
                    onChange={(e) => setVoucherData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Géré par <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={voucherData.handledBy}
                    onChange={(e) => setVoucherData(prev => ({ ...prev, handledBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  >
                    <option value="">Sélectionner un administrateur</option>
                    {adminUsers.map(user => (
                      <option key={user.user_id} value={user.username}>
                        {user.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pris par <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={voucherData.takenBy}
                    onChange={(e) => setVoucherData(prev => ({ ...prev, takenBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  >
                    <option value="">Sélectionner un ouvrier</option>
                    {workers.map(worker => (
                      <option key={worker.worker_id} value={`${worker.F_Name} ${worker.Surname}`}>
                        {worker.F_Name} {worker.Surname}
                      </option>
                    ))}
                  </select>
                </div>


                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={voucherData.notes}
                    onChange={(e) => setVoucherData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notes additionnelles..."
                    rows="3"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  />
                </div>
              </div>

              <button
                onClick={submitVoucher}
                disabled={selectedItems.length === 0}
                className="w-full mt-6 bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Créer le Bon d'Entrée
              </button>
            </div>

            {/* Summary */}
            {selectedItems.length > 0 && (
              <div className="bg-slate-100 rounded-xl p-6">
                <h3 className="font-semibold text-slate-800 mb-3">Résumé</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Articles:</span>
                    <span className="font-medium">{selectedItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total quantité:</span>
                    <span className="font-medium">
                      {selectedItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BonEntree;
