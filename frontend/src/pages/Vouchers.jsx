import React, { useEffect, useState, useMemo } from 'react';
import { FileText, Plus, Minus, Calendar, User, Package, Search, Eye } from 'lucide-react';

const Vouchers = () => {
  const [entryVouchers, setEntryVouchers] = useState([]);
  const [exitVouchers, setExitVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('entry');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState('all');
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [voucherDetails, setVoucherDetails] = useState({});

  const toTitleCase = (value) => {
    if (!value) return null;
    return value
      .split(' ')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [entryResponse, exitResponse] = await Promise.all([
          fetch('/api/entry-vouchers'),
          fetch('/api/exit-vouchers')
        ]);
        
        if (!entryResponse.ok || !exitResponse.ok) {
          throw new Error('Failed to fetch vouchers');
        }
        
        const entryData = await entryResponse.json();
        const exitData = await exitResponse.json();
        
        setEntryVouchers(entryData);
        setExitVouchers(exitData);
        
      const detailsMap = {};
      entryData.forEach(voucher => {
        detailsMap[`entry_${voucher.entry_id}`] = voucher;
      });
      exitData.forEach(voucher => {
        detailsMap[`exit_${voucher.exit_id}`] = voucher;
      });
        setVoucherDetails(detailsMap);
        
      } catch (err) {
        console.error('Error fetching vouchers:', err);
        setError('Failed to load vouchers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVouchers();
  }, []);

  const fetchVoucherDetails = async (voucherId, type) => {
    const list = type === 'entry' ? entryVouchers : exitVouchers;
    const localVoucher = list.find(v => v[`${type}_id`] === voucherId);

    if (localVoucher) {
      setSelectedVoucher(localVoucher);
      setShowDetails(true);
    } else {
      setShowDetails(true);
    }

    try {
      const response = await fetch(`/api/${type}-vouchers/${voucherId}`);
      if (response.ok) {
        const details = await response.json();
        setSelectedVoucher(details);
        setVoucherDetails(prev => ({
          ...prev,
          [`${type}_${voucherId}`]: details
        }));
        if (type === 'entry') {
          setEntryVouchers(prev => prev.map(v => v.entry_id === voucherId ? { ...v, ...details } : v));
        } else {
          setExitVouchers(prev => prev.map(v => v.exit_id === voucherId ? { ...v, ...details } : v));
        }
      }
    } catch (err) {
      console.error('Error fetching voucher details:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non spécifiée';
    
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return 'Non spécifiée';
    
    // Check if the date string includes time information
    const hasTime = typeof dateString === 'string' && (
      dateString.includes('T') || 
      dateString.includes(' ') || 
      dateString.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
    );
    
    // If no time info, show date only (old vouchers)
    if (!hasTime && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    // Otherwise show date and time
    return d.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Memoize unique worker names for filter (actual workers who received items)
  const allWorkers = useMemo(() => {
    return [
      ...new Set(
        Object.values(voucherDetails)
          .flatMap(detail => detail.details || [])
          .map(detail => {
            if (detail.worker_name) {
              return detail.worker_name.trim();
            }
            const fallback = `${detail.F_Name || ''} ${detail.Surname || ''}`.trim();
            return fallback || null;
          })
          .filter(Boolean)
      )
    ].sort();
  }, [voucherDetails]);

  // Memoize filtered vouchers to avoid recalculating on every render
  const filteredVouchers = useMemo(() => {
    if (activeTab === 'entry') {
      const lowerSearch = searchTerm.toLowerCase();
      return entryVouchers.filter(voucher => {
        const matchesSearch = [
          voucher.voucher_number,
          voucher.added_by_name,
          voucher.taken_by_name,
          voucher.notes
        ].some(field => field?.toString().toLowerCase().includes(lowerSearch)) ||
        voucher.entry_id?.toString().includes(searchTerm);
        
        // Check if voucher has the selected worker
        const voucherKey = `entry_${voucher.entry_id}`;
        const details = voucherDetails[voucherKey];
        const hasWorker = selectedPersonnel === 'all' || 
          (details?.details && details.details.some(detail => {
            const name =
              (detail.worker_name?.trim() ||
               `${detail.F_Name || ''} ${detail.Surname || ''}`.trim());
            return name && name === selectedPersonnel;
          }));
        
        return matchesSearch && hasWorker;
      });
    } else {
      const lowerSearch = searchTerm.toLowerCase();
      return exitVouchers.filter(voucher => {
        const matchesSearch = [
          voucher.voucher_number,
          voucher.handled_by_name,
          voucher.taken_by_name,
          voucher.notes
        ].some(field => field?.toString().toLowerCase().includes(lowerSearch)) ||
        voucher.exit_id?.toString().includes(searchTerm);
        
        // Check if voucher has the selected worker
        const voucherKey = `exit_${voucher.exit_id}`;
        const details = voucherDetails[voucherKey];
        const hasWorker = selectedPersonnel === 'all' || 
          (details?.details && details.details.some(detail => 
            (detail.worker_name?.trim() || `${detail.F_Name || ''} ${detail.Surname || ''}`.trim()) === selectedPersonnel
          ));
        
        return matchesSearch && hasWorker;
      });
    }
  }, [activeTab, entryVouchers, exitVouchers, searchTerm, selectedPersonnel, voucherDetails]);

  const modalTakenByName = (() => {
    if (!selectedVoucher) return null;
    // Prefer header-level taken_by_name
    let name = toTitleCase(selectedVoucher.taken_by_name);
    // Fallback: derive from details worker_name values
    if (!name && selectedVoucher.details && selectedVoucher.details.length > 0) {
      const workerNames = [
        ...new Set(
          selectedVoucher.details
            .map(detail =>
              (detail.worker_name?.trim() ||
               `${detail.F_Name || ''} ${detail.Surname || ''}`.trim())
            )
            .filter(Boolean)
        )
      ];
      if (workerNames.length > 0) {
        name = workerNames.join(', ');
      }
    }
    return name;
  })();
  const modalVoucherNumber = selectedVoucher
    ? selectedVoucher.voucher_number || selectedVoucher.entry_id || selectedVoucher.exit_id
    : null;
  const modalTotalQuantity = selectedVoucher?.details
    ? selectedVoucher.details.reduce((total, detail) => total + (detail.quantity || 0), 0)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Les Bons</h1>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Chargement des bons...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Les Bons</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Erreur de chargement</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Les Bons</h1>
        <p className="text-slate-600 mt-2">
          Historique des bons d'entrée et de sortie
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('entry')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'entry'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Bons d'Entrée ({entryVouchers.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('exit')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'exit'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <Minus className="h-4 w-4" />
            <span>Bons de Sortie ({exitVouchers.length})</span>
          </div>
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder={`Rechercher dans les bons ${activeTab === 'entry' ? 'd\'entrée' : 'de sortie'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Personnel Filter */}
          <div className="sm:w-64">
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <select
                value={selectedPersonnel}
                onChange={(e) => setSelectedPersonnel(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">Tous les travailleurs</option>
                {allWorkers.map(worker => (
                  <option key={worker} value={worker}>{worker}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Vouchers List */}
      {filteredVouchers.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
          <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun bon trouvé</h3>
          <p className="text-slate-500">
            {searchTerm 
              ? 'Essayez de modifier vos critères de recherche' 
              : `Aucun bon ${activeTab === 'entry' ? 'd\'entrée' : 'de sortie'} créé pour le moment`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVouchers.map((voucher) => {
            const voucherIdKey = `${activeTab}_id`;
            const voucherId = voucher[voucherIdKey];
            const voucherKey = `${activeTab}_${voucherId}`;
            const voucherData = voucherDetails[voucherKey] || voucher;
            const details = voucherData.details || [];
            const handledByName = toTitleCase(
              activeTab === 'entry'
                ? voucherData.added_by_name
                : voucherData.handled_by_name
            );
            // Compute Pris par (taken by) with fallback to details worker_name
            let takenByName = toTitleCase(voucherData.taken_by_name);
            if (!takenByName && details.length > 0) {
              const workerNames = [
                ...new Set(
                  details
                    .map(detail =>
                      (detail.worker_name?.trim() ||
                       `${detail.F_Name || ''} ${detail.Surname || ''}`.trim())
                    )
                    .filter(Boolean)
                )
              ];
              if (workerNames.length > 0) {
                takenByName = workerNames.join(', ');
              }
            }
            const totalQuantity = details.reduce((total, detail) => total + (detail.quantity || 0), 0);
            const topDetails = details.slice(0, 3);
            const remainingCount = details.length - topDetails.length;
            const voucherNumber = voucherData.voucher_number || voucherId;
            const typeLabel = activeTab === 'entry' ? "Bon d'Entrée" : 'Bon de Sortie';

            return (
              <div
                key={voucherId}
              className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-300"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`p-2 rounded-lg ${activeTab === 'entry' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {activeTab === 'entry' ? (
                          <Plus className="h-5 w-5 text-green-600" />
                        ) : (
                          <Minus className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800">
                            {typeLabel} #{voucherNumber}
                        </h3>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            {activeTab === 'entry' ? 'Entrée' : 'Sortie'} • Identifiant #{voucherId}
                        </p>
                      </div>
                    </div>
                    
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">Date:</span>
                          <span className="font-medium">
                            {formatDate(voucherData.date || voucher.date)}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">Géré par:</span>
                          <span className="font-medium">{handledByName || 'Non spécifié'}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">Pris par:</span>
                          <span className="font-medium">{takenByName || 'Non spécifié'}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">Articles / Qté:</span>
                          <span className="font-medium">
                            {details.length} / {totalQuantity}
                          </span>
                        </div>
                      </div>

                      {voucherData.notes && (
                        <div className="mt-3 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Notes:</span> {voucherData.notes}
                        </div>
                      )}

                      {details.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-slate-500 mb-2">Articles</h4>
                          <div className="space-y-2">
                            {topDetails.map(detail => (
                              <div key={`${voucherId}-${detail.item_id}`} className="flex items-start justify-between text-sm">
                                <div>
                                  <p className="font-medium text-slate-800">{detail.item_name}</p>
                                  {/* Per-article personnel is shown in the popup details */}
                                </div>
                                <span className="font-semibold text-slate-700">{detail.quantity}</span>
                              </div>
                            ))}
                            {remainingCount > 0 && (
                              <p className="text-xs text-slate-500">
                                + {remainingCount} autre{remainingCount > 1 ? 's' : ''} article{remainingCount > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                    <button
                        onClick={() => fetchVoucherDetails(voucherId, activeTab)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Détails</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Voucher Details Modal */}
      {showDetails && selectedVoucher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                  Détails du Bon {selectedVoucher.entry_id ? 'd\'Entrée' : 'de Sortie'} #{modalVoucherNumber}
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Informations Générales</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Numéro:</span>
                      <span className="font-medium">{modalVoucherNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Date:</span>
                      <span className="font-medium">
                        {formatDate(selectedVoucher.date || (selectedVoucher.date === '' ? null : selectedVoucher.date))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Géré par:</span>
                      <span className="font-medium">
                        {toTitleCase(selectedVoucher.added_by_name || selectedVoucher.handled_by_name) || 'Non spécifié'}
                      </span>
                    </div>
                    {modalTakenByName && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Pris par:</span>
                        <span className="font-medium">{modalTakenByName}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Résumé</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Nombre d'articles:</span>
                      <span className="font-medium">{selectedVoucher.details?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Quantité totale:</span>
                      <span className="font-medium">{modalTotalQuantity}</span>
                    </div>
                    {selectedVoucher.notes && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Notes:</span>
                        <span className="font-medium text-right max-w-[220px]">
                          {selectedVoucher.notes}
                      </span>
                    </div>
                    )}
                  </div>
                </div>
              </div>
              
              {selectedVoucher.details && selectedVoucher.details.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-4">Articles</h3>
                  <div className="space-y-3">
                    {selectedVoucher.details.map((detail, index) => (
                      <div key={index} className="bg-slate-50 p-4 rounded-lg border">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600">Article:</span>
                            <p className="font-medium">{detail.item_name}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Quantité:</span>
                            <p className="font-medium">{detail.quantity}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Personnel:</span>
                            <p className="font-medium">
                              {toTitleCase(detail.worker_name) || 'Non spécifié'}
                            </p>
                            {detail.worker_id && (
                              <p className="text-xs text-slate-500 mt-1">ID: {detail.worker_id}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vouchers; 