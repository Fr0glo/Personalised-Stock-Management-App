import React, { useEffect, useState } from 'react';
import { FileText, Plus, Minus, Calendar, User, Package, Search, Filter, Eye, Download } from 'lucide-react';

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

  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [entryResponse, exitResponse] = await Promise.all([
          fetch('http://localhost:5000/api/entry-vouchers'),
          fetch('http://localhost:5000/api/exit-vouchers')
        ]);
        
        if (!entryResponse.ok || !exitResponse.ok) {
          throw new Error('Failed to fetch vouchers');
        }
        
        const entryData = await entryResponse.json();
        const exitData = await exitResponse.json();
        
        setEntryVouchers(entryData);
        setExitVouchers(exitData);
        
        // Fetch details for all vouchers to get worker information
        const allVouchers = [...entryData, ...exitData];
        const detailsPromises = allVouchers.map(async (voucher) => {
          const type = voucher.entry_id ? 'entry' : 'exit';
          const id = voucher.entry_id || voucher.exit_id;
          try {
            const response = await fetch(`http://localhost:5000/api/${type}-vouchers/${id}`);
            if (response.ok) {
              const details = await response.json();
              return { [`${type}_${id}`]: details };
            }
          } catch (err) {
            console.error(`Error fetching details for ${type} voucher ${id}:`, err);
          }
          return {};
        });
        
        const allDetails = await Promise.all(detailsPromises);
        const detailsMap = allDetails.reduce((acc, detail) => ({ ...acc, ...detail }), {});
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
    try {
      const response = await fetch(`http://localhost:5000/api/${type}-vouchers/${voucherId}`);
      if (response.ok) {
        const details = await response.json();
        setSelectedVoucher(details);
        setShowDetails(true);
      }
    } catch (err) {
      console.error('Error fetching voucher details:', err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get unique worker names for filter (actual workers who received items)
  const allWorkers = [
    ...new Set(
      Object.values(voucherDetails)
        .flatMap(detail => detail.details || [])
        .map(detail => `${detail.F_Name} ${detail.Surname}`)
        .filter(Boolean)
    )
  ].sort();

  const filteredVouchers = activeTab === 'entry' 
    ? entryVouchers.filter(voucher => {
        const matchesSearch = voucher.added_by_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             voucher.entry_id.toString().includes(searchTerm);
        
        // Check if voucher has the selected worker
        const voucherKey = `entry_${voucher.entry_id}`;
        const details = voucherDetails[voucherKey];
        const hasWorker = selectedPersonnel === 'all' || 
          (details?.details && details.details.some(detail => 
            `${detail.F_Name} ${detail.Surname}` === selectedPersonnel
          ));
        
        return matchesSearch && hasWorker;
      })
    : exitVouchers.filter(voucher => {
        const matchesSearch = voucher.handled_by_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             voucher.exit_id.toString().includes(searchTerm);
        
        // Check if voucher has the selected worker
        const voucherKey = `exit_${voucher.exit_id}`;
        const details = voucherDetails[voucherKey];
        const hasWorker = selectedPersonnel === 'all' || 
          (details?.details && details.details.some(detail => 
            `${detail.F_Name} ${detail.Surname}` === selectedPersonnel
          ));
        
        return matchesSearch && hasWorker;
      });

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
          {filteredVouchers.map((voucher) => (
            <div
              key={voucher[`${activeTab}_id`]}
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
                          Bon {activeTab === 'entry' ? 'd\'Entrée' : 'de Sortie'} #{voucher[`${activeTab}_id`]}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {activeTab === 'entry' ? 'Ajouté par' : 'Géré par'}: {voucher[`${activeTab === 'entry' ? 'added_by_name' : 'handled_by_name'}`]}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">Date:</span>
                        <span className="font-medium">{formatDate(voucher.date)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">Personnel:</span>
                        <span className="font-medium">{voucher[`${activeTab === 'entry' ? 'added_by_name' : 'handled_by_name'}`]}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-600">Type:</span>
                        <span className="font-medium">{activeTab === 'entry' ? 'Entrée' : 'Sortie'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => fetchVoucherDetails(voucher[`${activeTab}_id`], activeTab)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Détails</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Voucher Details Modal */}
      {showDetails && selectedVoucher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                  Détails du Bon {selectedVoucher.entry_id ? 'd\'Entrée' : 'de Sortie'} #{selectedVoucher.entry_id || selectedVoucher.exit_id}
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
                      <span className="text-slate-600">Date:</span>
                      <span className="font-medium">{formatDate(selectedVoucher.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Géré par:</span>
                      <span className="font-medium">{selectedVoucher.added_by_name || selectedVoucher.handled_by_name}</span>
                    </div>
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
                      <span className="font-medium">
                        {selectedVoucher.details?.reduce((total, detail) => total + detail.quantity, 0) || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedVoucher.details && selectedVoucher.details.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-4">Articles</h3>
                  <div className="space-y-3">
                    {selectedVoucher.details.map((detail, index) => (
                      <div key={index} className="bg-slate-50 p-4 rounded-lg border">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
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
                            <p className="font-medium">{detail.F_Name} {detail.Surname}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">ID Personnel:</span>
                            <p className="font-medium">{detail.worker_id}</p>
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