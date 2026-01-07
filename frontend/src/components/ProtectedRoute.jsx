import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requireSecurity = false }) => {
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
  if (user.role === 'security' && !requireSecurity) {
    return <Navigate to="/security" replace />;
  }

  return children;
};

export default ProtectedRoute;



