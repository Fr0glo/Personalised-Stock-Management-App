import React, { useEffect, useRef, useState } from 'react';

import { Search, User } from 'lucide-react';

const Topbar = ({ user = null, onLogout = () => {} }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

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

  return (
    <div className="bg-white shadow-sm border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-4" ref={userMenuRef}>
          <div className="relative">
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
                    {user?.name || user?.username || 'Guest'}
                  </div>
                  <div className="h-px bg-slate-200 my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
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
    </div>
  );
};

export default Topbar; 