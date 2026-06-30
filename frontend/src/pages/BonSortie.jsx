import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Minus, Plus, Package, User, Calendar, Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import axios from 'axios';

// Format a typed number into the printed voucher format, e.g. 1 -> "S-0001"
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

const BonSortie = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isFromSecurity = location.pathname.includes('/security/');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [voucherData, setVoucherData] = useState({
    voucherNumber: '',
    date: getTodayDate(),
    time: '',
    handledBy: '',
    takenBy: '',
    destination: '',
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

  // Fetch pending orders if coming from Security page
  useEffect(() => {
    if (isFromSecurity) {
      const fetchPendingOrders = async () => {
        try {
          const response = await fetch('/api/orders?status=pending');
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

  // Fetch a default list of available stock items when focusing the search field.
  // Only items actually in stock (quantity > 0) — an item at 0 can't be taken out,
  // so it's offered through the catalogue suggestions / "non trouvé" flow instead.
  const fetchAllStockItems = async () => {
    setIsSearching(true);
    try {
      const response = await axios.get('/api/stock-items?limit=50');
      setSearchResults(response.data);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error fetching stock items:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

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
      // Only items actually in stock (quantity > 0). Items at 0 fall through to
      // the catalogue suggestions / "article non trouvé" flow below.
      const response = await axios.get(`/api/stock-items?search=${encodeURIComponent(trimmedTerm)}&limit=50`);
      setSearchResults(response.data);
      setShowSearchResults(true);

      // If nothing is in stock, offer canonical names from the catalogue so a
      // "not found" item is recorded under a known name (avoids variants like
      // "tube T" vs "tube en T"). Otherwise clear any stale suggestions.
      if (response.data.length === 0) {
        try {
          const cat = await axios.get(`/api/product-catalog?search=${encodeURIComponent(trimmedTerm)}&limit=8`);
          setCatalogSuggestions(cat.data || []);
        } catch {
          setCatalogSuggestions([]);
        }
      } else {
        setCatalogSuggestions([]);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
      setCatalogSuggestions([]);
      setShowSearchResults(false);
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
    const trimmed = searchTerm.trim();

    if (trimmed.length >= 2) {
      // If user already typed enough characters, run a filtered search
      searchProducts(trimmed);
    } else {
      // Otherwise, show a default list of stock items on focus
      fetchAllStockItems();
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
    setCatalogSuggestions([]);
  };

  // Add an item that was NOT found in the stock. It leaves the depot and is
  // recorded on the voucher as "article non trouvé", but never touches stock.
  // `unit` is passed when the name was chosen from the catalogue.
  const addUnregisteredItem = (name, unit = 'pcs') => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Avoid duplicate not-found entries with the same name
    const alreadyAdded = selectedItems.some(
      item => item.is_unregistered && item.item_name.toLowerCase() === trimmed.toLowerCase()
    );

    if (!alreadyAdded) {
      setSelectedItems(prev => [...prev, {
        item_id: `unreg_${Date.now()}`, // string id: unique and never matches a real stock item
        item_name: trimmed,
        quantity: 1,
        unit: unit || 'pcs',
        is_unregistered: true
      }]);
    }

    setSearchTerm('');
    setShowSearchResults(false);
    setCatalogSuggestions([]);
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

    // The voucher number must match the physical voucher book (S-0001, S-0025, ...)
    const formattedVoucherNumber = formatVoucherNumber('S', voucherData.voucherNumber);
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

      // Build the items list: real stock items vs. "not found" items.
      const items = selectedItems.map(item => (
        item.is_unregistered
          ? { is_unregistered: true, item_name: item.item_name, quantity: item.quantity }
          : { item_id: item.item_id, quantity: item.quantity }
      ));

      // Create the voucher and all its items in ONE atomic request. If any item
      // fails (e.g. insufficient stock), nothing is saved — no partial voucher.
      await axios.post('/api/exit-vouchers', {
        voucher_number: formattedVoucherNumber,
        date: fullDateTime,
        handled_by: voucherData.handledBy,
        taken_by: voucherData.takenBy,
        place: null,
        destination: voucherData.destination,
        notes: voucherData.notes,
        items
      });

      alert('Bon de sortie créé avec succès!');
      
      // Reset form (keep the logged-in handler pre-filled)
      setSelectedItems([]);
      setVoucherData(prev => ({
        voucherNumber: '',
        date: getTodayDate(),
        time: '',
        handledBy: prev.handledBy,
        takenBy: '',
        destination: '',
        notes: ''
      }));
      
    } catch (error) {
      console.error('Error creating voucher:', error);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Erreur inconnue';
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
            {/* Pending Orders Section (shown when coming from Security page) */}
            {isFromSecurity && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Articles à Retirer (Commandes en Attente)
                  </h2>
                  {pendingOrders.length > 0 && (
                    <button
                      onClick={() => setShowOrdersSection(!showOrdersSection)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {showOrdersSection ? 'Masquer' : 'Afficher'}
                    </button>
                  )}
                </div>

                {/* Empty state when there are no pending orders */}
                {pendingOrders.length === 0 && (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-sm text-slate-600">
                    Aucune commande en attente pour le moment. Les commandes sont automatiquement retirées de cette liste une fois entièrement servies.
                  </div>
                )}

                {pendingOrders.length > 0 && showOrdersSection && (
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
                                    `/api/stock-items?search=${encodeURIComponent(orderItem.name)}&limit=10&includeZero=true`
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
                                        `/api/stock-items?search=${encodeURIComponent(item.name)}&limit=10&includeZero=true`
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

              {/* Catalogue suggestions: known item names (not currently in stock).
                  Picking one keeps naming consistent and avoids variants. */}
              {searchTerm && searchResults.length === 0 && catalogSuggestions.length > 0 && !isSearching && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Noms existants dans le catalogue — choisissez-en un si c'est le bon article :
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                    {catalogSuggestions.map((product) => (
                      <div
                        key={product.catalog_id}
                        onClick={() => addUnregisteredItem(product.item_name, product.default_unit)}
                        className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-b-0 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium text-slate-800">{product.item_name}</p>
                          <p className="text-xs text-slate-500">
                            Pas en stock actuellement{product.default_unit ? ` • ${product.default_unit}` : ''}
                          </p>
                        </div>
                        <Plus className="w-4 h-4 text-emerald-600" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchTerm && searchResults.length === 0 && !isSearching && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">Aucun article disponible trouvé pour "{searchTerm}"</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addUnregisteredItem(searchTerm)}
                      className="px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter comme article non trouvé
                    </button>
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    {catalogSuggestions.length > 0
                      ? "Si aucun nom ci-dessus ne correspond, ajoutez-le comme nouvel article non trouvé."
                      : "L'article sera enregistré sur le bon comme sorti du dépôt, sans être ajouté au stock."}
                  </p>
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
                    <div
                      key={item.item_id}
                      className={`p-4 border rounded-lg ${item.is_unregistered ? 'border-yellow-300 bg-yellow-50' : 'border-slate-200'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium text-slate-800">{item.item_name}</h3>
                          {item.is_unregistered ? (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                              <AlertTriangle className="w-3 h-3" />
                              Article non trouvé · hors stock
                            </span>
                          ) : (
                            <p className="text-sm text-slate-500">
                              Stock disponible: {item.max_quantity} {item.unit}
                            </p>
                          )}
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
                              value={item.quantity || ''}
                              placeholder="0"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateQuantity(item.item_id, parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                              min="0"
                              max={item.is_unregistered ? undefined : item.max_quantity}
                            />
                            <button
                              onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              <Minus className="w-4 h-4 rotate-180" />
                            </button>
                          </div>
                          {!item.is_unregistered && item.quantity > item.max_quantity && (
                            <p className="text-xs text-red-600 mt-1">
                              Quantité supérieure au stock disponible
                            </p>
                          )}
                        </div>

                        {/* Stock After (registered items only) */}
                        {!item.is_unregistered && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Stock Restant
                            </label>
                            <div className="px-3 py-2 bg-slate-100 rounded-lg text-slate-600">
                              {item.max_quantity - item.quantity} {item.unit}
                            </div>
                          </div>
                        )}
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
                      S-
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
                  {formatVoucherNumber('S', voucherData.voucherNumber) && (
                    <p className="text-xs text-slate-500 mt-1">
                      Enregistré comme{' '}
                      <span className="font-semibold text-emerald-600">
                        {formatVoucherNumber('S', voucherData.voucherNumber)}
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Destination
                  </label>
                  <input
                    type="text"
                    value={voucherData.destination}
                    onChange={(e) => setVoucherData(prev => ({ ...prev, destination: e.target.value }))}
                    placeholder="Où vont les articles (chantier, lieu...)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
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
