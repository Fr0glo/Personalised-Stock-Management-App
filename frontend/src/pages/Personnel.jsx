import React, { useEffect, useState } from 'react';
import { Users, User, Calendar, Package, Search, Eye, Plus, Minus, FileText, Badge } from 'lucide-react';

const Personnel = () => {
  const [workers, setWorkers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkerDetails, setShowWorkerDetails] = useState(false);
  const [workerVouchers, setWorkerVouchers] = useState([]);

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('http://localhost:5000/api/workers');
        
        if (!response.ok) {
          throw new Error('Failed to fetch workers');
        }
        
        const workersData = await response.json();
        setWorkers(workersData);
      } catch (err) {
        console.error('Error fetching workers:', err);
        setError('Failed to load workers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkers();
  }, []);

  const fetchWorkerVouchers = async (workerId) => {
    try {
      // Fetch entry vouchers for this worker
      const entryResponse = await fetch('http://localhost:5000/api/entry-vouchers');
      const exitResponse = await fetch('http://localhost:5000/api/exit-vouchers');
      
      if (entryResponse.ok && exitResponse.ok) {
        const entryVouchers = await entryResponse.json();
        const exitVouchers = await exitResponse.json();
        
        // Get details for all vouchers to find ones with this worker
        const allVouchers = [...entryVouchers, ...exitVouchers];
        const workerVouchersList = [];
        
        for (const voucher of allVouchers) {
          const type = voucher.entry_id ? 'entry' : 'exit';
          const id = voucher.entry_id || voucher.exit_id;
          
          try {
            const detailsResponse = await fetch(`http://localhost:5000/api/${type}-vouchers/${id}`);
            if (detailsResponse.ok) {
              const details = await detailsResponse.json();
              
              // Check if this worker is in the voucher details
              const workerInVoucher = details.details?.find(detail => detail.worker_id === workerId);
              
              if (workerInVoucher) {
                workerVouchersList.push({
                  ...voucher,
                  type,
                  workerDetail: workerInVoucher,
                  voucherDetails: details
                });
              }
            }
          } catch (err) {
            console.error(`Error fetching details for ${type} voucher ${id}:`, err);
          }
        }
        
        setWorkerVouchers(workerVouchersList);
      }
    } catch (err) {
      console.error('Error fetching worker vouchers:', err);
    }
  };

  const showWorkerInfo = async (worker) => {
    setSelectedWorker(worker);
    await fetchWorkerVouchers(worker.worker_id);
    setShowWorkerDetails(true);
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

  const filteredWorkers = workers.filter(worker => 
    `${worker.F_Name} ${worker.Surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.Role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.Carte_National?.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Personnel</h1>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Chargement du personnel...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Personnel</h1>
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
        <h1 className="text-3xl font-bold text-slate-800">Personnel</h1>
        <p className="text-slate-600 mt-2">
          {workers.length} travailleur{workers.length !== 1 ? 's' : ''} enregistré{workers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un travailleur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Workers List */}
      {filteredWorkers.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
          <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun travailleur trouvé</h3>
          <p className="text-slate-500">
            {searchTerm 
              ? 'Essayez de modifier vos critères de recherche' 
              : 'Aucun travailleur enregistré pour le moment'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkers.map((worker) => (
            <div
              key={worker.worker_id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-300 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <User className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {worker.F_Name} {worker.Surname}
                      </h3>
                      <p className="text-sm text-slate-600">ID: {worker.worker_id}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Badge className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Rôle:</span>
                    <span className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                      {worker.Role || 'Non spécifié'}
                    </span>
                  </div>
                  
                  {worker.Carte_National && (
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-600">Carte National:</span>
                      <span className="text-sm font-medium text-slate-700">
                        {worker.Carte_National}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => showWorkerInfo(worker)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Eye className="h-4 w-4" />
                  <span>Voir l'historique</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Worker Details Modal */}
      {showWorkerDetails && selectedWorker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">
                    {selectedWorker.F_Name} {selectedWorker.Surname}
                  </h2>
                  <p className="text-slate-600">
                    {selectedWorker.Role} • ID: {selectedWorker.worker_id}
                  </p>
                </div>
                <button
                  onClick={() => setShowWorkerDetails(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Worker Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Informations Personnelles</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Nom complet:</span>
                      <span className="font-medium">{selectedWorker.F_Name} {selectedWorker.Surname}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Rôle:</span>
                      <span className="font-medium">{selectedWorker.Role || 'Non spécifié'}</span>
                    </div>
                    {selectedWorker.Carte_National && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Carte National:</span>
                        <span className="font-medium">{selectedWorker.Carte_National}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Statistiques</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total de bons:</span>
                      <span className="font-medium">{workerVouchers.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Bons d'entrée:</span>
                      <span className="font-medium">
                        {workerVouchers.filter(v => v.type === 'entry').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Bons de sortie:</span>
                      <span className="font-medium">
                        {workerVouchers.filter(v => v.type === 'exit').length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Vouchers History */}
              {workerVouchers.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-4">Historique des Bons</h3>
                  <div className="space-y-4">
                    {workerVouchers.map((voucher, index) => (
                      <div key={index} className="bg-slate-50 p-4 rounded-lg border">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${voucher.type === 'entry' ? 'bg-green-100' : 'bg-red-100'}`}>
                              {voucher.type === 'entry' ? (
                                <Plus className="h-4 w-4 text-green-600" />
                              ) : (
                                <Minus className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium text-slate-800">
                                Bon {voucher.type === 'entry' ? 'd\'Entrée' : 'de Sortie'} #{voucher.entry_id || voucher.exit_id}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {formatDate(voucher.date)}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600">Article:</span>
                            <p className="font-medium">{voucher.workerDetail.item_name}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Quantité:</span>
                            <p className="font-medium">{voucher.workerDetail.quantity}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">Type:</span>
                            <p className="font-medium">{voucher.type === 'entry' ? 'Entrée' : 'Sortie'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun bon trouvé</h3>
                  <p className="text-slate-500">Ce travailleur n'a pas encore de bons d'entrée ou de sortie.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Personnel; 