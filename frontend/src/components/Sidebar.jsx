import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Package,
  FileText,
  Users,
  ShoppingCart,
  LayoutDashboard,
  User,
  LogOut,
  Clock,
  BarChart3
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
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

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    window.location.href = '/login';
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/stock', label: 'Stock', icon: Package },
    { path: '/orders', label: 'Commander', icon: ShoppingCart },
    { path: '/pending-orders', label: 'Commandes en Attente', icon: Clock },
    { path: '/vouchers', label: 'Les bons', icon: FileText },
    { path: '/personnel', label: 'Personnel', icon: Users },
    // Admin-only analytics dashboard
    ...(currentUser?.role === 'superadmin'
      ? [{ path: '/analyse', label: 'Analyse', icon: BarChart3 }]
      : []),
  ];

  return (
    <div className="w-64 bg-navy-700 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-navy-600">
        <div className="flex items-center space-x-3">
          <img src="/btp_logo_icon_512_transparent.png" alt="BTP Oulime" className="w-14 h-14 object-contain" />
          <div>
            <h1 className="text-lg font-display font-bold text-white tracking-wide">
              BTP OULIME
            </h1>
            <p className="text-[10px] text-navy-300 tracking-widest uppercase">Gestion de Stock</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-orange text-white shadow-sm font-medium'
                      : 'text-navy-200 hover:bg-navy-600 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Menu at Bottom */}
      <div className="p-4 border-t border-navy-600" ref={userMenuRef}>
        <div className="relative">
          <button
            className="w-full flex items-center px-4 py-3 rounded-lg text-navy-200 hover:bg-navy-600 hover:text-white transition-all duration-200"
            onClick={() => setIsUserMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
          >
            <User className="w-5 h-5 mr-3" />
            <span className="flex-1 text-left truncate">
              {currentUser?.username || 'Utilisateur'}
            </span>
          </button>

          {isUserMenuOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 w-full rounded-md border border-slate-200 bg-white shadow-lg z-50"
              role="menu"
            >
              <div className="py-1">
                <div className="px-4 py-2 text-xs text-slate-500 select-none" role="none">
                  Connecté en tant que
                </div>
                <div className="px-4 pb-2 text-sm text-navy-700 font-medium truncate" role="none">
                  {currentUser?.username || 'Guest'}
                </div>
                <div className="h-px bg-slate-200 my-1" />
                <button
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
