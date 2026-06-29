import React, { useEffect, useState, useMemo } from 'react';
import { FileText, Plus, Minus, Calendar, User, Package, Search, Eye, Lock, Trash2, X, AlertTriangle } from 'lucide-react';

const Vouchers = () => {
  const [entryVouchers, setEntryVouchers] = useState([]);
  const [exitVouchers, setExitVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('entry');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState('all');
  const [workers, setWorkers] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [voucherDetails, setVoucherDetails] = useState({});
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);

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

  // Fetch the current list of workers from the database so the filter only
  // offers people who still exist (removed workers no longer clutter the list).
  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const res = await fetch('/api/workers');
        if (res.ok) {
          setWorkers(await res.json());
        }
      } catch (err) {
        console.error('Error fetching workers:', err);
      }
    };

    fetchWorkers();
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

  const handlePinChange = (index, value) => {
    if (!/^\d*$/.test(value) || value.length > 1) return;
    const newPin = [...pinCode];
    newPin[index] = value;
    setPinCode(newPin);
    setPinError(false);
    if (value && index < 3) document.getElementById(`vpin-${index + 1}`)?.focus();
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinCode[index] && index > 0)
      document.getElementById(`vpin-${index - 1}`)?.focus();
  };

  const verifyPin = async () => {
    try {
      const res = await fetch('/api/settings/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode.join('') })
      });
      const data = await res.json();
      if (data.valid) {
        setIsAdminMode(true);
        setShowPinModal(false);
        setPinCode(['', '', '', '']);
        setPinError(false);
      } else {
        setPinError(true);
        setPinCode(['', '', '', '']);
        document.getElementById('vpin-0')?.focus();
      }
    } catch {
      setPinError(true);
      setPinCode(['', '', '', '']);
    }
  };

  const deleteVoucher = async (voucherId, type) => {
    if (!window.confirm(`Supprimer ce bon définitivement ?`)) return;
    try {
      const res = await fetch(`/api/${type}-vouchers/${voucherId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      if (type === 'entry') {
        setEntryVouchers(prev => prev.filter(v => v.entry_id !== voucherId));
      } else {
        setExitVouchers(prev => prev.filter(v => v.exit_id !== voucherId));
      }
    } catch {
      alert('Erreur lors de la suppression');
    }
  };

  const resetAllVouchers = async () => {
    const label = activeTab === 'entry' ? "tous les bons d'entrée" : 'tous les bons de sortie';
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${label} ? Cette action est irréversible.`)) return;
    try {
      const res = await fetch(`/api/${activeTab}-vouchers`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      if (activeTab === 'entry') setEntryVouchers([]);
      else setExitVouchers([]);
    } catch {
      alert('Erreur lors de la réinitialisation');
    }
  };

  // Clear ALL bons — both entrée and sortie — in one action.
  const resetAllBons = async () => {
    if (!window.confirm('Réinitialiser TOUS les bons (entrée ET sortie) ? Cette action est irréversible.')) return;
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/entry-vouchers', { method: 'DELETE' }),
        fetch('/api/exit-vouchers', { method: 'DELETE' })
      ]);
      if (!r1.ok || !r2.ok) throw new Error('Failed');
      setEntryVouchers([]);
      setExitVouchers([]);
    } catch {
      alert('Erreur lors de la réinitialisation');
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

  // Worker names for the filter dropdown, built from the CURRENT workers in the
  // database — so people who were removed no longer appear here. Their old
  // vouchers stay visible in the list and remain findable via the search box.
  const allWorkers = useMemo(() => {
    return [
      ...new Set(
        workers
          .map(worker => `${worker.F_Name || ''} ${worker.Surname || ''}`.trim())
          .filter(Boolean)
      )
    ].sort();
  }, [workers]);

  // Extract a comparable YYYY-MM-DD day from any stored date format
  // (ISO, "YYYY-MM-DD HH:MM", or plain "YYYY-MM-DD").
  const getVoucherDay = (dateString) => {
    if (!dateString) return null;
    const direct = String(dateString).match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Memoize filtered vouchers to avoid recalculating on every render
  const filteredVouchers = useMemo(() => {
    const isEntry = activeTab === 'entry';
    const source = isEntry ? entryVouchers : exitVouchers;
    const idKey = isEntry ? 'entry_id' : 'exit_id';
    const handledKey = isEntry ? 'added_by_name' : 'handled_by_name';
    const lowerSearch = searchTerm.toLowerCase();

    return source.filter(voucher => {
      const voucherKey = `${activeTab}_${voucher[idKey]}`;
      const details = voucherDetails[voucherKey]?.details || [];

      // Names of the workers on this voucher (kept even if the worker was later
      // removed), so old vouchers stay findable by typing the person's name.
      const detailWorkerNames = details
        .map(detail =>
          (detail.worker_name?.trim() ||
           `${detail.F_Name || ''} ${detail.Surname || ''}`.trim()))
        .filter(Boolean);

      const matchesSearch = [
        voucher.voucher_number,
        voucher[handledKey],
        voucher.taken_by_name,
        voucher.notes,
        ...detailWorkerNames
      ].some(field => field?.toString().toLowerCase().includes(lowerSearch)) ||
        voucher[idKey]?.toString().includes(searchTerm);

      // Worker filter: a specific person selected from the dropdown.
      const hasWorker = selectedPersonnel === 'all' ||
        detailWorkerNames.some(name => name.toLowerCase() === selectedPersonnel.toLowerCase());

      // Date range filter (inclusive). Compares the YYYY-MM-DD day only.
      const day = getVoucherDay(voucher.date);
      const matchesDate =
        (!dateFrom && !dateTo) ||
        (day !== null &&
          (!dateFrom || day >= dateFrom) &&
          (!dateTo || day <= dateTo));

      return matchesSearch && hasWorker && matchesDate;
    });
  }, [activeTab, entryVouchers, exitVouchers, searchTerm, selectedPersonnel, voucherDetails, dateFrom, dateTo]);

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

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Du"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
              />
            </div>
            <span className="text-slate-400 text-sm">→</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                title="Au"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                title="Effacer les dates"
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
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

          {/* Admin Button */}
          <div className="flex items-center gap-2">
            {isAdminMode ? (
              <>
                <button
                  onClick={resetAllVouchers}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Trash2 className="h-4 w-4" />
                  Vider cette liste
                </button>
                <button
                  onClick={resetAllBons}
                  className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Trash2 className="h-4 w-4" />
                  Réinitialiser tous les bons
                </button>
                <button
                  onClick={() => setIsAdminMode(false)}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <X className="h-4 w-4" />
                  Quitter
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Lock className="h-4 w-4" />
                Admin
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vouchers List */}
      {filteredVouchers.length === 0 ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
          <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun bon trouvé</h3>
          <p className="text-slate-500">
            {(searchTerm || selectedPersonnel !== 'all' || dateFrom || dateTo)
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

                      {voucherData.destination && (
                        <div className="mt-3 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Destination:</span> {voucherData.destination}
                        </div>
                      )}

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
                              <div key={`${voucherId}-${detail.exit_detail_id ?? detail.item_id}`} className="flex items-start justify-between text-sm">
                                <div>
                                  <p className="font-medium text-slate-800">{detail.item_name}</p>
                                  {detail.is_unregistered && (
                                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[11px] font-medium rounded">
                                      <AlertTriangle className="h-3 w-3" />
                                      Hors stock
                                    </span>
                                  )}
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
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => fetchVoucherDetails(voucherId, activeTab)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Détails</span>
                      </button>
                      {isAdminMode && (
                        <button
                          onClick={() => deleteVoucher(voucherId, activeTab)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-sm w-full">
            <div className="text-center mb-6">
              <Lock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Code d'accès Admin</h2>
              <p className="text-slate-600">Entrez le code PIN à 4 chiffres</p>
            </div>

            <div className="flex justify-center gap-3 mb-4">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  id={`vpin-${index}`}
                  type="password"
                  inputMode="numeric"
                  maxLength="1"
                  value={pinCode[index]}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${pinError ? 'border-red-500' : 'border-slate-300'}`}
                />
              ))}
            </div>

            {pinError && (
              <div className="flex items-center justify-center gap-2 text-red-600 text-sm mb-4">
                <AlertTriangle className="h-4 w-4" />
                <span>Code PIN incorrect</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowPinModal(false); setPinCode(['', '', '', '']); setPinError(false); }}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={verifyPin}
                disabled={pinCode.join('').length !== 4}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Vérifier
              </button>
            </div>
          </div>
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
                    {selectedVoucher.destination && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Destination:</span>
                        <span className="font-medium text-right max-w-[220px]">{selectedVoucher.destination}</span>
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
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${detail.is_unregistered ? 'bg-yellow-50 border-yellow-300' : 'bg-slate-50'}`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600">Article:</span>
                            <p className="font-medium">{detail.item_name}</p>
                            {detail.is_unregistered && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[11px] font-medium rounded">
                                <AlertTriangle className="h-3 w-3" />
                                Article non trouvé · sorti hors stock
                              </span>
                            )}
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