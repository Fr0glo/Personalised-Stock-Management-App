import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Package, User, Calendar, AlertTriangle } from 'lucide-react';

const Security = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/orders?status=pending');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const ordersData = await response.json();
        setOrders(ordersData);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('Failed to load orders');
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
    
    // Refresh orders every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-orange-600 bg-orange-100';
      case 'completed': return 'text-green-600 bg-green-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'completed': return 'Terminé';
      default: return 'Inconnu';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Poste de Sécurité</h1>
              <p className="text-slate-600">Gestion des bons et commandes</p>
            </div>
            <div className="relative" ref={userMenuRef}>
              <button
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
                onClick={() => setIsUserMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
              >
                <User className="h-6 w-6 text-slate-600" />
              </button>

              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-md border border-slate-200 bg-white shadow-lg z-50"
                  role="menu"
                >
                  <div className="py-1">
                    <div className="px-4 py-2 text-xs text-slate-500 select-none" role="none">
                      Signed in as
                    </div>
                    <div className="px-4 pb-2 text-sm text-slate-700 font-medium truncate" role="none">
                      Security
                    </div>
                    <div className="h-px bg-slate-200 my-1" />
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        localStorage.removeItem('user');
                        localStorage.removeItem('isAuthenticated');
                        window.location.href = '/login';
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Section - Action Buttons */}
        <div className="w-1/3 bg-white border-r border-slate-200 p-6">
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Actions Rapides</h2>
            
            {/* Bon d'Entrée Button */}
            <button 
              onClick={() => navigate('/security/bon-entree')}
              className="w-full bg-slate-700 hover:bg-slate-800 text-white p-8 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
            >
                <div className="flex items-center justify-center space-x-4">
                    <Plus className="w-12 h-12" />
                    <div className="text-left">
                      <h2 className="text-2xl font-bold">Bon d'Entrée</h2>
                      <p className="text-slate-200">Ajouter du stock</p>
                    </div>
                </div>
            </button>
           
           

            {/* Bon de Sortie Button */}
            <button 
              onClick={() => navigate('/security/bon-sortie')}
              className="w-full bg-slate-700 hover:bg-slate-800 text-white p-8 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
            >
              <div className="flex items-center justify-center space-x-4">
                <Minus className="w-12 h-12" />
                <div className="text-left">
                  <h2 className="text-2xl font-bold">Bon de Sortie</h2>
                  <p className="text-slate-200">Retirer du stock</p>
                </div>
              </div>
            </button>

          </div>
        </div>

        {/* Right Section - Orders List */}
        <div className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Liste des Commandes</h2>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4" />
              <span>{new Date().toLocaleDateString('fr-FR')}</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Chargement des commandes...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">Erreur de chargement</h3>
              <p className="text-red-600">{error}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
              <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucune commande</h3>
              <p className="text-slate-500">Aucune commande reçue pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-300"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Package className="h-6 w-6 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-800">
                            Commande #{order.id}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {formatDate(order.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-600 mb-3">Articles commandés:</h4>
                      <div className="space-y-2">
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded">
                              <div className="flex-1">
                                <span className="text-slate-700 font-medium">{item.name}</span>
                                {item.place && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    📍 Emplacement: {item.place}
                                  </div>
                                )}
                              </div>
                              <span className="text-slate-800 font-medium">
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Aucun article</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center space-x-2 text-sm text-slate-600">
                        <User className="h-4 w-4" />
                        <span>Commandé par: {order.created_by || 'Bureau'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Security;
