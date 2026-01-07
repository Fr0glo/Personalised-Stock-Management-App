import React, { useEffect, useState } from 'react';
import { Users, User, Package, Search, Eye, Plus, Minus, FileText, Badge } from 'lucide-react';

const BUREAU_TEAM = [
  {
    id: 'rachida',
    displayName: 'Rachida',
    aliases: ['rachida']
  },
  {
    id: 'touria',
    displayName: 'Touria',
    aliases: ['touria']
  },
  {
    id: 'brahim-bureau',
    displayName: 'Brahim',
    aliases: ['brahim', 'brahim bahessin', 'brahim bahessi', 'brahim bahessine']
  }
];

const DEPOT_TEAM = [
  {
    id: 'brahim-bahessin',
    displayName: 'Brahim Bahessin',
    aliases: ['brahim bahessin', 'brahim bahessi', 'brahim bahessine']
  },
  {
    id: 'mohamad-baadi',
    displayName: 'Mohamad Baadi',
    aliases: ['mohamad baadi', 'mohamed baadi', 'mohammed baadi', 'mohammad baadi']
  }
];

const Personnel = () => {
  const [workers, setWorkers] = useState([]);
  const [entryVouchers, setEntryVouchers] = useState([]);
  const [exitVouchers, setExitVouchers] = useState([]);
  const [bureauStaff, setBureauStaff] = useState([]);
  const [depotStaff, setDepotStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkerDetails, setShowWorkerDetails] = useState(false);
  const [workerVouchers, setWorkerVouchers] = useState([]);
  const [selectedStaffMember, setSelectedStaffMember] = useState(null);
  const [showStaffDetails, setShowStaffDetails] = useState(false);

  const toTitleCase = (value) => {
    if (!value) return '';
    return value
      .split(' ')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const normalizeName = (value) => value
    ? value
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
    : '';

  const matchesBureauStaff = (voucher, staff) => {
    const candidates = [
      voucher.added_by_name,
      voucher.handled_by_name,
      ...(voucher.office_staff || []).map(member => member.username || member.display_name)
    ];

    return candidates.some(name => {
      const normalized = normalizeName(name);
      if (!normalized) return false;
      if (normalized === normalizeName(staff.displayName)) return true;
      return (staff.aliases || []).some(alias => alias === normalized);
    });
  };

  const matchesDepotStaff = (voucher, staff) => {
    const candidates = [
      voucher.taken_by_name,
      ...(voucher.details || []).map(detail => detail.worker_name)
    ];

    return candidates.some(name => {
      const normalized = normalizeName(name);
      if (!normalized) return false;
      if (normalized === normalizeName(staff.displayName)) return true;
      return (staff.aliases || []).some(alias => alias === normalized);
    });
  };

  const buildStaffSummaries = (team, matcher, entryList, exitList, role) => {
    return team.map(staff => {
      const entryMatches = entryList.filter(voucher => matcher(voucher, staff));
      const exitMatches = exitList.filter(voucher => matcher(voucher, staff));

      const vouchers = [
        ...entryMatches.map(voucher => ({ ...voucher, type: 'entry' })),
        ...exitMatches.map(voucher => ({ ...voucher, type: 'exit' }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        ...staff,
        displayName: staff.displayName,
        role,
        total: vouchers.length,
        entryCount: entryMatches.length,
        exitCount: exitMatches.length,
        vouchers
      };
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [workersResponse, entryResponse, exitResponse] = await Promise.all([
          fetch('http://localhost:5000/api/workers'),
          fetch('http://localhost:5000/api/entry-vouchers'),
          fetch('http://localhost:5000/api/exit-vouchers')
        ]);

        if (!workersResponse.ok) {
          throw new Error('Failed to fetch workers');
        }

        const workersData = await workersResponse.json();
        setWorkers(workersData);

        let entryData = [];
        let exitData = [];

        if (entryResponse.ok) {
          entryData = await entryResponse.json();
        } else {
          console.error('Failed to fetch entry vouchers');
        }

        if (exitResponse.ok) {
          exitData = await exitResponse.json();
        } else {
          console.error('Failed to fetch exit vouchers');
        }

        setEntryVouchers(entryData);
        setExitVouchers(exitData);
        setBureauStaff(buildStaffSummaries(BUREAU_TEAM, matchesBureauStaff, entryData, exitData, 'bureau'));
        setDepotStaff(buildStaffSummaries(DEPOT_TEAM, matchesDepotStaff, entryData, exitData, 'depot'));
      } catch (err) {
        console.error('Error fetching personnel data:', err);
        setError('Failed to load personnel data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const ensureVoucherDetails = async (voucher) => {
    if (voucher.details && voucher.details.length > 0) {
      return voucher;
    }

    const type = voucher.type === 'exit' ? 'exit' : 'entry';
    const idField = type === 'entry' ? 'entry_id' : 'exit_id';
    const voucherId = voucher[idField];

    if (!voucherId) {
      return voucher;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/${type}-vouchers/${voucherId}`);
      if (response.ok) {
        const fullVoucher = await response.json();
        return { ...voucher, ...fullVoucher };
      }
    } catch (err) {
      console.error(`Error fetching ${type} voucher ${voucherId}:`, err);
    }

    return voucher;
  };

  const fetchWorkerVouchers = async (workerId) => {
    const entryMatches = entryVouchers
      .filter(voucher =>
        voucher.taken_by === workerId ||
        (voucher.details || []).some(detail => detail.worker_id === workerId)
      )
      .map(voucher => ({ ...voucher, type: 'entry' }));

    const exitMatches = exitVouchers
      .filter(voucher =>
        voucher.taken_by === workerId ||
        (voucher.details || []).some(detail => detail.worker_id === workerId)
      )
      .map(voucher => ({ ...voucher, type: 'exit' }));

    const combined = [...entryMatches, ...exitMatches].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const enriched = await Promise.all(combined.map(ensureVoucherDetails));
    setWorkerVouchers(enriched);
  };

  const showWorkerInfo = async (worker) => {
    setSelectedWorker(worker);
    await fetchWorkerVouchers(worker.worker_id);
    setShowWorkerDetails(true);
  };

  const openStaffDetails = async (staff) => {
    const enrichedVouchers = await Promise.all((staff.vouchers || []).map(ensureVoucherDetails));
    setSelectedStaffMember({ ...staff, vouchers: enrichedVouchers });
    setShowStaffDetails(true);
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

      {/* Bureau Staff Section */}
      {bureauStaff.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Suivi des bons par le bureau</h2>
              <p className="text-sm text-slate-500">
                Agents ayant validé ou géré les bons
              </p>
            </div>
            <div className="text-sm text-slate-500">
              {bureauStaff.reduce((sum, staff) => sum + staff.total, 0)} bon{bureauStaff.reduce((sum, staff) => sum + staff.total, 0) !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {bureauStaff.map((staff) => (
              <div
                key={staff.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {toTitleCase(staff.displayName)}
                      </h3>
                    </div>
                    <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                      {staff.total} bon{staff.total !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Plus className="h-4 w-4" />
                      {staff.entryCount}
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <Minus className="h-4 w-4" />
                      {staff.exitCount}
                    </span>
                  </div>

                  {staff.total > 0 ? (
                    <p className="text-xs text-slate-500 mt-3">
                      Dernier bon: {formatDate(staff.vouchers[0].date)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-3">
                      Aucun bon enregistré pour le moment
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => openStaffDetails(staff)}
                    disabled={staff.total === 0}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Voir les bons
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dépôt Staff Section */}
      {depotStaff.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Équipe dépôt</h2>
              <p className="text-sm text-slate-500">
                Suivi des bons gérés ou retirés par l'équipe du dépôt
              </p>
            </div>
            <div className="text-sm text-slate-500">
              {depotStaff.reduce((sum, staff) => sum + staff.total, 0)} bon{depotStaff.reduce((sum, staff) => sum + staff.total, 0) !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {depotStaff.map((staff) => (
              <div
                key={staff.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {toTitleCase(staff.displayName)}
                      </h3>
                    </div>
                    <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
                      {staff.total} bon{staff.total !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Plus className="h-4 w-4" />
                      {staff.entryCount}
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <Minus className="h-4 w-4" />
                      {staff.exitCount}
                    </span>
                  </div>

                  {staff.total > 0 ? (
                    <p className="text-xs text-slate-500 mt-3">
                      Dernier bon: {formatDate(staff.vouchers[0].date)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-3">
                      Aucun bon enregistré pour le moment
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => openStaffDetails(staff)}
                    disabled={staff.total === 0}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Voir les bons
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    {workerVouchers.map((voucher, index) => {
                      const voucherId = voucher.entry_id || voucher.exit_id;
                      const voucherNumber = voucher.voucher_number || voucherId;
                      const handledByName = toTitleCase(voucher.added_by_name || voucher.handled_by_name);
                      const takenByName = toTitleCase(voucher.taken_by_name);
                      const totalQuantity = voucher.details?.reduce((sum, detail) => sum + (detail.quantity || 0), 0) || 0;

                      return (
                        <div key={`${voucher.type}-${voucherId}-${index}`} className="bg-slate-50 p-4 rounded-lg border">
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
                                  Bon {voucher.type === 'entry' ? "d'Entrée" : 'de Sortie'} #{voucherNumber}
                                </h4>
                                <p className="text-sm text-slate-600">
                                  {formatDate(voucher.date)}
                                </p>
                              </div>
                            </div>
                            <div className="text-sm text-slate-500">
                              {voucher.details?.length || 0} article{(voucher.details?.length || 0) !== 1 ? 's' : ''} • Qté {totalQuantity}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                           <div>
                             <span className="text-slate-600">Géré par:</span>
                             <p className="font-medium">{handledByName || 'Non spécifié'}</p>
                           </div>
                            <div>
                              <span className="text-slate-600">Pris par:</span>
                              <p className="font-medium">{takenByName || 'Non spécifié'}</p>
                            </div>
                          </div>
                          
                          {voucher.details && voucher.details.length > 0 && (
                            <div className="mt-4 space-y-2 text-sm">
                              {voucher.details.map((detail, detailIndex) => (
                                <div key={`${voucherId}-worker-detail-${detailIndex}`} className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium text-slate-800">{detail.item_name}</p>
                                    {detail.worker_name && (
                                      <p className="text-xs text-slate-500">
                                        Géré par {toTitleCase(detail.worker_name)}
                                      </p>
                                    )}
                                  </div>
                                  <span className="font-semibold text-slate-700">{detail.quantity}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {voucher.notes && (
                            <div className="mt-3">
                              <span className="text-slate-600">Notes:</span>
                              <p className="font-medium text-sm">{voucher.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
      
      {showStaffDetails && selectedStaffMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">
                    {toTitleCase(selectedStaffMember.displayName)}
                  </h2>
                   <p className="text-slate-600">
                     {selectedStaffMember.total} bon{selectedStaffMember.total !== 1 ? 's' : ''} {selectedStaffMember.role === 'bureau' ? 'géré(s) par le bureau' : 'pris en charge par l\'équipe dépôt'}
                   </p>
                </div>
                <button
                  onClick={() => setShowStaffDetails(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {selectedStaffMember.vouchers && selectedStaffMember.vouchers.length > 0 ? (
                <div className="space-y-4">
                  {selectedStaffMember.vouchers.map((voucher, index) => {
                    const voucherId = voucher.entry_id || voucher.exit_id;
                    const voucherNumber = voucher.voucher_number || voucherId;
                    const totalQuantity = voucher.details?.reduce((total, detail) => total + detail.quantity, 0) || 0;
                    const detailCount = voucher.details?.length || 0;
                    const handledNames = Array.from(new Set([
                      voucher.added_by_name,
                      voucher.handled_by_name,
                      ...(voucher.office_staff || []).map(member => member.username || member.display_name)
                    ].filter(Boolean))).map(toTitleCase);
                    const takenNames = Array.from(new Set([
                      voucher.taken_by_name,
                      ...(voucher.details || []).map(detail => detail.worker_name)
                    ].filter(Boolean))).map(toTitleCase);
                    const primaryLabel = selectedStaffMember.role === 'bureau' ? 'Géré par:' : 'Pris par:';
                    const primaryValue = selectedStaffMember.role === 'bureau'
                      ? (handledNames.length > 0 ? handledNames.join(', ') : 'Non spécifié')
                      : (takenNames.length > 0 ? takenNames.join(', ') : 'Non spécifié');
                    const secondaryLabel = selectedStaffMember.role === 'bureau' ? 'Responsable terrain:' : 'Personnel bureau:';
                    const secondaryValue = selectedStaffMember.role === 'bureau'
                      ? (takenNames.length > 0 ? takenNames.join(', ') : 'Non spécifié')
                      : (handledNames.length > 0 ? handledNames.join(', ') : 'Non spécifié');

                    return (
                      <div key={`${voucher.type}-${voucherId}-${index}`} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
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
                                Bon {voucher.type === 'entry' ? "d'Entrée" : 'de Sortie'} #{voucherNumber}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {formatDate(voucher.date)}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm text-slate-500">
                            {detailCount} article{detailCount !== 1 ? 's' : ''} • Qté totale {totalQuantity}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600">{primaryLabel}</span>
                            <p className="font-medium">{primaryValue}</p>
                          </div>
                          <div>
                            <span className="text-slate-600">{secondaryLabel}</span>
                            <p className="font-medium">{secondaryValue}</p>
                          </div>
                        </div>

                        {voucher.notes && (
                          <div className="mt-3 text-sm text-slate-600">
                            <span className="font-medium text-slate-700">Notes:</span> {voucher.notes}
                          </div>
                        )}

                        {voucher.details && voucher.details.length > 0 && (
                          <div className="mt-4 space-y-2 text-sm">
                            {voucher.details.map((detail, detailIndex) => (
                              <div key={`${voucherId}-detail-${detailIndex}`} className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-slate-800">{detail.item_name}</p>
                                  {detail.worker_name && (
                                    <p className="text-xs text-slate-500">Géré par {toTitleCase(detail.worker_name)}</p>
                                  )}
                                </div>
                                <span className="font-semibold text-slate-700">{detail.quantity}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun bon trouvé</h3>
                  <p className="text-slate-500">Ce membre du bureau n'a pas encore géré de bons.</p>
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