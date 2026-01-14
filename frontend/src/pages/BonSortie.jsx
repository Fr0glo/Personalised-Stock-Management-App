import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Minus, Package, User, Calendar, Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const BonSortie = () => {
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
    handledBy: '',
    takenBy: '',
    notes: ''
  });

  const [adminUsers, setAdminUsers] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [showOrdersSection, setShowOrdersSection] = useState(false);

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

  // Fetch pending orders if coming from Security page
  useEffect(() => {
    if (isFromSecurity) {
      const fetchPendingOrders = async () => {
        try {
          const response = await fetch('http://localhost:5000/api/orders?status=pending');
          if (response.ok) {
            const orders = await response.json();
            // Filter to only show pending orders
            const pendingOnly = orders.filter(order => order.status === 'pending');
            setPendingOrders(pendingOnly);
            // Auto-expand orders section if there are pending orders
            if (pendingOnly.length > 0) {
              setShowOrdersSection(true);
            }
          }
        } catch (error) {
          console.error('Error fetching pending orders:', error);
        }
      };
      fetchPendingOrders();
    }
  }, [isFromSecurity]);

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

  // Search for available stock items (quantity > 0) - server-side search only
  const searchProducts = async (term) => {
    const trimmedTerm = term.trim();

    // Don't search if term is too short
    if (trimmedTerm.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      // Use server-side search with limit for performance - include items with zero quantity
      const response = await axios.get(`http://localhost:5000/api/stock-items?search=${encodeURIComponent(trimmedTerm)}&limit=50&includeZero=true`);
      setSearchResults(response.data); // Shows all stock items including zero quantity
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

  const handleSearchFocus = () => {
    // Only show results if user has typed something (server-side search)
    if (searchTerm.trim().length >= 2) {
      searchProducts(searchTerm);
    } else {
      setShowSearchResults(false);
    }
  };

  // Add item to selected items
  const addItem = (product) => {
    const existingItem = selectedItems.find(item => item.item_id === product.item_id);
    
    if (existingItem) {
      // Update quantity if item already exists
      setSelectedItems(prev => prev.map(item => 
        item.item_id === product.item_id 
          ? { ...item, quantity: Math.min(item.quantity + 1, product.quantity) }
          : item
      ));
    } else {
      // Add new item
      const newItem = {
        item_id: product.item_id,
        item_name: product.item_name,
        quantity: 1,
        unit: product.unit || 'pcs',
        notes: product.notes || '',
        current_stock: product.quantity || 0,
        max_quantity: product.quantity || 0
      };
      setSelectedItems(prev => [...prev, newItem]);
    }
    
    // Clear search
    setSearchTerm('');
    setShowSearchResults(false);
  };

  // Update item quantity
  const updateQuantity = (itemId, newQuantity) => {
    const item = selectedItems.find(i => i.item_id === itemId);
    if (!item) return;
    
    // Allow any positive quantity - backend will validate stock availability
    const validQuantity = Math.max(0, newQuantity);
    
    setSelectedItems(prev => prev.map(item => 
      item.item_id === itemId 
        ? { ...item, quantity: validQuantity }
        : item
    ));
  };

  // Remove item from selected items
  const removeItem = (itemId) => {
    setSelectedItems(prev => prev.filter(item => item.item_id !== itemId));
  };

  // Get next voucher number
  const getNextVoucherNumber = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/exit-vouchers');
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
      // Get next voucher number (always auto-generated)
      const voucherNumber = await getNextVoucherNumber();

      // Use current date and time automatically
      const fullDateTime = new Date().toISOString();

      // Create exit voucher
      console.log('🔍 Creating exit voucher with data:', {
        voucher_number: voucherNumber,
        date: fullDateTime,
        handled_by: voucherData.handledBy,
        taken_by: voucherData.takenBy,
        notes: voucherData.notes
      });
      
      const voucherResponse = await axios.post('http://localhost:5000/api/exit-vouchers', {
        voucher_number: voucherNumber,
        date: fullDateTime,
        handled_by: voucherData.handledBy,
        taken_by: voucherData.takenBy,
        place: null,
        notes: voucherData.notes
      });

      console.log('✅ Exit voucher created:', voucherResponse.data);
      const voucherId = voucherResponse.data.voucher_id || voucherResponse.data.exit_id;
      
      if (!voucherId) {
        console.error('❌ Voucher response:', voucherResponse.data);
        throw new Error('Voucher ID is missing from response');
      }
      
      console.log('🔍 Using voucher ID:', voucherId);

      // Add each item to the voucher (backend will handle stock reduction)
      for (const item of selectedItems) {
        try {
          console.log('🔍 Adding item to exit voucher:', {
            voucher_id: voucherId,
            item_id: item.item_id,
            quantity: item.quantity,
            item_name: item.item_name
          });
          
          // Validate data before sending
          if (!item.item_id) {
            throw new Error('Item ID is missing');
          }
          if (!item.quantity || item.quantity <= 0) {
            throw new Error('Invalid quantity');
          }
          
          // Add to voucher details (this will also reduce stock in the backend)
          const detailResponse = await axios.post('http://localhost:5000/api/exit-vouchers/details', {
            voucher_id: voucherId,
            item_id: item.item_id,
            quantity: item.quantity
          });
          
          console.log('✅ Item added to exit voucher:', detailResponse.data);
        } catch (error) {
          console.error('❌ Error adding item to exit voucher:', error.response?.data || error.message);
          throw error; // Re-throw to trigger the catch block
        }
      }

      alert('Bon de sortie créé avec succès!');
      
      // Reset form
      setSelectedItems([]);
      setVoucherData({
        voucherNumber: '',
        handledBy: '',
        takenBy: '',
        notes: ''
      });
      
    } catch (error) {
      console.error('Error creating voucher:', error);
      console.error('Full error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Erreur inconnue';
      alert(`Erreur lors de la création du bon de sortie:\n${errorMessage}`);
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
            <h1 className="text-3xl font-bold text-slate-800">Bon de Sortie</h1>
            <p className="text-slate-600">Retirer des articles du stock</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Search and Add Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending Orders Section (only shown when coming from Security page) */}
            {isFromSecurity && pendingOrders.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Articles à Retirer (Commandes en Attente)
                  </h2>
                  <button
                    onClick={() => setShowOrdersSection(!showOrdersSection)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {showOrdersSection ? 'Masquer' : 'Afficher'}
                  </button>
                </div>

                {showOrdersSection && (
                  <div className="space-y-4">
                    {pendingOrders.map((order) => (
                      <div key={order.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-slate-800">Commande #{order.id}</h3>
                            <p className="text-sm text-slate-600">
                              Par: {order.created_by} • {new Date(order.date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              // Add all items from this order to selected items
                              for (const orderItem of order.items) {
                                try {
                                  // Fetch stock item by name
                                  const searchResponse = await axios.get(
                                    `http://localhost:5000/api/stock-items?search=${encodeURIComponent(orderItem.name)}&limit=10&includeZero=true`
                                  );
                                  const foundItems = searchResponse.data;
                                  const matchingItem = foundItems.find(si => 
                                    si.item_name.toLowerCase() === orderItem.name.toLowerCase()
                                  );
                                  
                                  if (matchingItem && matchingItem.quantity > 0) {
                                    const existingItem = selectedItems.find(item => item.item_id === matchingItem.item_id);
                                    if (existingItem) {
                                      // Update quantity
                                      setSelectedItems(prev => prev.map(item =>
                                        item.item_id === matchingItem.item_id
                                          ? { ...item, quantity: Math.min(item.quantity + orderItem.quantity, matchingItem.quantity) }
                                          : item
                                      ));
                                    } else {
                                      // Add new item
                                      setSelectedItems(prev => [...prev, {
                                        item_id: matchingItem.item_id,
                                        item_name: matchingItem.item_name,
                                        quantity: Math.min(orderItem.quantity, matchingItem.quantity),
                                        unit: orderItem.unit || matchingItem.unit || 'pcs',
                                        notes: '',
                                        current_stock: matchingItem.quantity,
                                        max_quantity: matchingItem.quantity
                                      }]);
                                    }
                                  }
                                } catch (error) {
                                  console.error(`Error fetching item ${orderItem.name}:`, error);
                                }
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Ajouter Tous
                          </button>
                        </div>
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                              <div className="flex-1">
                                <span className="font-medium text-slate-800">{item.name}</span>
                                {item.place && (
                                  <div className="text-xs text-slate-500 mt-1">📍 {item.place}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-600">
                                  {item.quantity} {item.unit}
                                </span>
                                <button
                                  onClick={async () => {
                                    try {
                                      // Search for the item in stock
                                      const searchResponse = await axios.get(
                                        `http://localhost:5000/api/stock-items?search=${encodeURIComponent(item.name)}&limit=10&includeZero=true`
                                      );
                                      const foundItems = searchResponse.data;
                                      const matchingItem = foundItems.find(si => 
                                        si.item_name.toLowerCase() === item.name.toLowerCase()
                                      );
                                      
                                      if (matchingItem && matchingItem.quantity > 0) {
                                        const existingItem = selectedItems.find(sel => sel.item_id === matchingItem.item_id);
                                        if (existingItem) {
                                          // Update quantity
                                          setSelectedItems(prev => prev.map(sel =>
                                            sel.item_id === matchingItem.item_id
                                              ? { ...sel, quantity: Math.min(sel.quantity + item.quantity, matchingItem.quantity) }
                                              : sel
                                          ));
                                        } else {
                                          // Add new item
                                          setSelectedItems(prev => [...prev, {
                                            item_id: matchingItem.item_id,
                                            item_name: matchingItem.item_name,
                                            quantity: Math.min(item.quantity, matchingItem.quantity),
                                            unit: item.unit || matchingItem.unit || 'pcs',
                                            notes: '',
                                            current_stock: matchingItem.quantity,
                                            max_quantity: matchingItem.quantity
                                          }]);
                                        }
                                      } else if (matchingItem && matchingItem.quantity === 0) {
                                        alert(`Article "${item.name}" n'a pas de stock disponible`);
                                      } else {
                                        alert(`Article "${item.name}" non trouvé dans le stock`);
                                      }
                                    } catch (error) {
                                      console.error('Error adding item:', error);
                                      alert(`Erreur lors de l'ajout de "${item.name}"`);
                                    }
                                  }}
                                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                                >
                                  Ajouter
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Rechercher des Articles Disponibles
              </h2>
              
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  placeholder="Tapez le nom de l'article disponible..."
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
                      key={product.item_id}
                      onClick={() => addItem(product)}
                      className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-slate-800">{product.item_name}</p>
                          <p className="text-sm text-slate-500">
                            Stock disponible: <span className="font-medium text-emerald-600">{product.quantity} {product.unit}</span>
                            {product.notes && ` • ${product.notes}`}
                          </p>
                        </div>
                        <Minus className="w-4 h-4 text-red-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchTerm && searchResults.length === 0 && !isSearching && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">Aucun article disponible trouvé pour "{searchTerm}"</span>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Items */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Articles à Retirer ({selectedItems.length})
              </h2>

              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Aucun article sélectionné</p>
                  <p className="text-sm">Recherchez et ajoutez des articles disponibles ci-dessus</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map((item) => (
                    <div key={item.item_id} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium text-slate-800">{item.item_name}</h3>
                          <p className="text-sm text-slate-500">
                            Stock disponible: {item.max_quantity} {item.unit}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.item_id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Quantity */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Quantité à Retirer
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.item_id, parseInt(e.target.value))}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                              min="0"
                              max={item.max_quantity}
                            />
                            <button
                              onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              <Minus className="w-4 h-4 rotate-180" />
                            </button>
                          </div>
                          {item.quantity > item.max_quantity && (
                            <p className="text-xs text-red-600 mt-1">
                              Quantité supérieure au stock disponible
                            </p>
                          )}
                        </div>

                        {/* Stock After */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Stock Restant
                          </label>
                          <div className="px-3 py-2 bg-slate-100 rounded-lg text-slate-600">
                            {item.max_quantity - item.quantity} {item.unit}
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
                className="w-full mt-6 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Créer le Bon de Sortie
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

export default BonSortie;
