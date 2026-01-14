import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children, requireSecurity = false }) => {
  const location = useLocation();
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If route requires security role and user is not security, redirect
  if (requireSecurity && user.role !== 'security') {
    return <Navigate to="/" replace />;
  }

  // If user is security but trying to access normal pages, redirect to security
  // Exception: allow access to security-specific bon-entree and bon-sortie routes
  if (user.role === 'security' && !requireSecurity) {
    const currentPath = location.pathname;
    if (currentPath !== '/security/bon-entree' && currentPath !== '/security/bon-sortie') {
      return <Navigate to="/security" replace />;
    }
  }

  // Depot workers can access normal pages but not security page
  if (user.role === 'depot' && requireSecurity) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;



