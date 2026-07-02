import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ThemeProvider from './components/ThemeProvider';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Orders from './pages/Orders';
import PendingOrders from './pages/PendingOrders';
import BonCommande from './pages/BonCommande';
import BonCommandeHistorique from './pages/BonCommandeHistorique';
import Vouchers from './pages/Vouchers';
import Personnel from './pages/Personnel';
import Analyse from './pages/Analyse';
import Comptes from './pages/Comptes';
import Security from './pages/Security';
import BonEntree from './pages/BonEntree';
import BonSortie from './pages/BonSortie';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <Router>
      <Routes>
        {/* Login page - public */}
        <Route path="/login" element={<Login />} />
        
        {/* Security page - protected, security role only */}
        <Route 
          path="/security" 
          element={
            <ProtectedRoute requireSecurity={true}>
              <Security />
            </ProtectedRoute>
          } 
        />
        
        {/* Bon d'Entrée and Bon de Sortie for security users (without Layout) */}
        <Route 
          path="/security/bon-entree" 
          element={
            <ProtectedRoute requireSecurity={true}>
              <BonEntree />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/security/bon-sortie" 
          element={
            <ProtectedRoute requireSecurity={true}>
              <BonSortie />
            </ProtectedRoute>
          } 
        />
        
        {/* Main app pages - protected, normal access */}
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/stock" element={<Stock />} />
                  {/* Bon de Commande (replaces the order pages in the sidebar) */}
                  <Route path="/bon-commande" element={<BonCommande />} />
                  <Route path="/bon-commande/historique" element={<BonCommandeHistorique />} />
                  {/* Old ordering system — kept reachable by URL so it can be brought back */}
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/pending-orders" element={<PendingOrders />} />
                  <Route path="/vouchers" element={<Vouchers />} />
                  <Route path="/personnel" element={<Personnel />} />
                  <Route path="/analyse" element={<Analyse />} />
                  <Route path="/comptes" element={<Comptes />} />
                  <Route path="/bon-entree" element={<BonEntree />} />
                  <Route path="/bon-sortie" element={<BonSortie />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
    </ThemeProvider>
  );
}

export default App; 