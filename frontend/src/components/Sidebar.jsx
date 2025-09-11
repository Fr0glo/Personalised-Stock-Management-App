import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Package, 
  FileText, 
  Users, 
  ShoppingCart,
  LayoutDashboard
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/stock', label: 'Stock', icon: Package },
    { path: '/orders', label: 'Commander', icon: ShoppingCart },
    { path: '/vouchers', label: 'Les bons', icon: FileText },
    { path: '/personnel', label: 'Personnel', icon: Users },
  ];

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      {/* BTP STOCK Logo */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          {/* House Logo */}
          <div className="flex items-center space-x-1">
            <div className="w-8 h-6 relative">
              {/* Left House */}
              <div className="absolute left-0 bottom-0 w-4 h-4 bg-slate-800 rounded-t-sm"></div>
              <div className="absolute left-0 bottom-0 w-4 h-3 bg-white rounded-t-sm"></div>
              <div className="absolute left-1 bottom-1 w-1 h-1 bg-slate-800 rounded-sm"></div>
              {/* Right House */}
              <div className="absolute right-0 bottom-0 w-3 h-3 bg-slate-800 rounded-t-sm"></div>
              <div className="absolute right-0 bottom-0 w-3 h-2 bg-white rounded-t-sm"></div>
              <div className="absolute right-0.5 bottom-0.5 w-0.5 h-0.5 bg-slate-800 rounded-sm"></div>
              {/* Connecting Base */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 rounded-full"></div>
            </div>
          </div>
          <h1 className="text-xl font-display font-semibold text-slate-800 tracking-wide">
            BTP STOCK
          </h1>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-50 text-slate-800 border-r-2 border-slate-600 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
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
    </div>
  );
};

export default Sidebar; 