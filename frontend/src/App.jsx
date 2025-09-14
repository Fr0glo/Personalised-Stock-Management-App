import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Orders from './pages/Orders';
import Vouchers from './pages/Vouchers';
import Personnel from './pages/Personnel';
import Security from './pages/Security';

function App() {
  return (
    <Router>
      <Routes>
        {/* Security page - no layout (full screen) */}
        <Route path="/security" element={<Security />} />
        
        
        
        {/* Main app pages - with layout */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/vouchers" element={<Vouchers />} />
              <Route path="/personnel" element={<Personnel />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App; 