import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, Minus, Package, User, Calendar, Save, ArrowLeft } from 'lucide-react';
import axios from 'axios';

// Format a typed number into the printed voucher format, e.g. 1 -> "E-0001"
const formatVoucherNumber = (prefix, value) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return '';
  return `${prefix}-${String(n).padStart(4, '0')}`;
};

// Today's date as YYYY-MM-DD in local time (for the date input default)
const getTodayDate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const BonEntree = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isFromSecurity = location.pathname.includes('/security/');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [voucherData, setVoucherData] = useState({
    voucherNumber: '',
    date: getTodayDate(),
    time: '',
    handledBy: '',
    takenBy: '',
    place: '',
    notes: ''
  });

  const [adminUsers, setAdminUsers] = useState([]);
  const [workers, setWorkers] = useState([]);

  // Fetch users and workers on component mount
  useEffect(() => {
    const fetchUsersAndWorkers = async () => {
      try {
        // Fetch admin users
        const usersResponse = await fetch('/api/users');
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          setAdminUsers(users.filter(user => user.role === 'admin'));
        }

        // Fetch workers
        const workersResponse = await fetch('/api/workers');
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

  // Auto-fill "Géré par" with logged-in user
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const loggedInUser = JSON.parse(userStr);
      // Auto-fill for all users including security
      if (loggedInUser && loggedInUser.username) {
        setVoucherData(prev => ({
          ...prev,
          handledBy: loggedInUser.username
        }));
      }
    }
  }, [adminUsers]); // Run after adminUsers are loaded

  // Search for products in catalog
  const searchProducts = async (term) => {
    if (term.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(`/api/product-catalog?search=${encodeURIComponent(term)}&limit=20`);
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
        quantity: 0,
        unit: product.default_unit || 'pcs',
        notes: product.notes || '',
        place: '', // Individual place for this item
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

  // Update item place/emplacement
  const updatePlace = (catalogId, newPlace) => {
    setSelectedItems(prev => prev.map(item => 
      item.catalog_id === catalogId 
        ? { ...item, place: newPlace }
        : item
    ));
  };

  // Remove item from selected items
  const removeItem = (catalogId) => {
    setSelectedItems(prev => prev.filter(item => item.catalog_id !== catalogId));
  };

  // Add a typed product. If the name already exists in the catalogue, reuse its
  // remembered unit (e.g. "metre") instead of defaulting to "pcs" — so the unit
  // stays consistent and the database stays clean.
  const addNewProduct = async () => {
    const name = searchTerm.trim();
    if (!name) return;

    let match = null;
    try {
      const res = await axios.get(`/api/product-catalog?search=${encodeURIComponent(name)}&limit=20`);
      match = (res.data || []).find(p => (p.item_name || '').trim().toLowerCase() === name.toLowerCase());
    } catch (error) {
      console.error('Catalog lookup failed:', error);
    }

    setSelectedItems(prev => {
      // If this catalogue item is already in the list, just bump its quantity
      if (match && prev.some(i => i.catalog_id === match.catalog_id)) {
        return prev.map(i => i.catalog_id === match.catalog_id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      const newItem = match
        ? {
            catalog_id: match.catalog_id,
            item_name: match.item_name,
            quantity: 0,
            unit: match.default_unit || 'pcs',
            notes: match.notes || '',
            place: '',
            current_stock: 0
          }
        : {
            catalog_id: `new_${Date.now()}`,
            item_name: name,
            quantity: 0,
            unit: 'pcs',
            notes: '',
            place: '',
            current_stock: 0,
            isNew: true
          };
      return [...prev, newItem];
    });

    setSearchTerm('');
    setShowSearchResults(false);
  };

  // Submit voucher
  const submitVoucher = async () => {
    if (selectedItems.length === 0) {
      alert('Veuillez ajouter au moins un article');
      return;
    }

    if (selectedItems.some(it => !it.quantity || it.quantity <= 0)) {
      alert('Veuillez indiquer la quantité pour chaque article');
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

    // The voucher number must match the physical voucher book (E-0001, E-0025, ...)
    const formattedVoucherNumber = formatVoucherNumber('E', voucherData.voucherNumber);
    if (!formattedVoucherNumber) {
      alert('Veuillez indiquer le numéro du bon (ex: 1)');
      return;
    }

    if (!voucherData.time) {
      alert("Veuillez indiquer l'heure du bon");
      return;
    }


    try {
      // Combine the (editable) date with the manually entered time.
      // Stored as a local datetime so the time shows exactly as typed.
      const voucherDate = voucherData.date || getTodayDate();
      const fullDateTime = `${voucherDate}T${voucherData.time}`;

      // Best-effort: remember each item's name/unit in the catalogue so the name
      // suggestions stay complete. Non-critical and never touches stock.
      for (const item of selectedItems) {
        try {
          await axios.post('/api/product-catalog', {
            item_name: item.item_name,
            default_unit: item.unit,
            notes: item.notes || ''
          });
        } catch (catalogError) {
          console.error('Catalog update failed (non-critical):', catalogError);
        }
      }

      // Create the voucher and add every item to stock in ONE atomic request.
      // Stock increases exactly once per item (the old flow added it twice).
      const items = selectedItems.map(item => ({
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        notes: item.notes || '',
        place: (item.place || '').trim() || null
      }));

      await axios.post('/api/entry-vouchers', {
        voucher_number: formattedVoucherNumber,
        date: fullDateTime,
        handled_by: voucherData.handledBy,
        taken_by: voucherData.takenBy,
        place: voucherData.place || null,
        notes: voucherData.notes,
        items
      });

      alert('Bon d\'entrée créé avec succès!');
      
      // Reset form (keep the logged-in handler pre-filled)
      setSelectedItems([]);
      setVoucherData(prev => ({
        voucherNumber: '',
        date: getTodayDate(),
        time: '',
        handledBy: prev.handledBy,
        takenBy: '',
        place: '',
        notes: ''
      }));
      
    } catch (error) {
      console.error('Error creating voucher:', error);
      const msg = error.response?.data?.details || error.response?.data?.error || error.message;
      alert(msg || 'Erreur lors de la création du bon d\'entrée');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => isFromSecurity ? navigate('/security') : window.history.back()}
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

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                              value={item.quantity || ''}
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateQuantity(item.catalog_id, parseInt(e.target.value) || 0)}
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

                        {/* Emplacement */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Emplacement
                          </label>
                          <input
                            type="text"
                            value={item.place || ''}
                            onChange={(e) => updatePlace(item.catalog_id, e.target.value)}
                            placeholder="Ex: A-13, B-19"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          />
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
                    Numéro du bon <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg font-semibold text-slate-700">
                      E-
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={voucherData.voucherNumber}
                      onChange={(e) => setVoucherData(prev => ({ ...prev, voucherNumber: e.target.value }))}
                      placeholder="Ex: 1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-r-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  {formatVoucherNumber('E', voucherData.voucherNumber) && (
                    <p className="text-xs text-slate-500 mt-1">
                      Enregistré comme{' '}
                      <span className="font-semibold text-emerald-600">
                        {formatVoucherNumber('E', voucherData.voucherNumber)}
                      </span>
                    </p>
                  )}
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
                    Heure <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={voucherData.time}
                    onChange={(e) => setVoucherData(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Géré par <span className="text-red-500">*</span>
                  </label>
                  <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 flex items-center">
                    <User className="h-4 w-4 mr-2 text-slate-500" />
                    <span className="font-medium">{voucherData.handledBy || 'Non défini'}</span>
                  </div>
                  <input
                    type="hidden"
                    value={voucherData.handledBy}
                    required
                  />
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
