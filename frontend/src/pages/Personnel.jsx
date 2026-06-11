import React, { useEffect, useState } from 'react';
import { Users, User, Package, Search, Eye, Plus, Minus, FileText, Badge, Trash2, X, Lock } from 'lucide-react';


const Personnel = () => {
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [entryVouchers, setEntryVouchers] = useState([]);
  const [exitVouchers, setExitVouchers] = useState([]);
  const [bureauStaff, setBureauStaff] = useState([]);
  const [depotStaff, setDepotStaff] = useState([]);
  const [securityStaff, setSecurityStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkerDetails, setShowWorkerDetails] = useState(false);
  const [workerVouchers, setWorkerVouchers] = useState([]);
  const [selectedStaffMember, setSelectedStaffMember] = useState(null);
  const [showStaffDetails, setShowStaffDetails] = useState(false);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [newWorker, setNewWorker] = useState({ F_Name: '', Surname: '', Carte_National: '', Role: '' });
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState(['', '', '', '']);

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

  const matchesSecurityStaff = (voucher, staff) => {
    const candidates = [
      voucher.added_by_name,
      voucher.handled_by_name
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

  const handlePinChange = (index, value) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pinCode];
    newPin[index] = value;
    setPinCode(newPin);
    if (value && index < 3) {
      const nextInput = document.getElementById(`personnel-pin-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinCode[index] && index > 0) {
      const prevInput = document.getElementById(`personnel-pin-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const verifyPin = () => {
    const enteredPin = pinCode.join('');
    if (enteredPin === '3739') {
      setIsEditMode(true);
      setShowPinModal(false);
      setPinCode(['', '', '', '']);
    } else {
      alert('Code PIN incorrect');
      setPinCode(['', '', '', '']);
    }
  };

  const rebuildTeams = (usersData, workersData, entryData, exitData) => {
    const bureauUsers = usersData.filter(u => u.role === 'admin').map(u => ({
      id: `user-${u.user_id}`,
      displayName: u.username,
      aliases: [u.username.toLowerCase()]
    }));
    const bureauWorkers = workersData.filter(w =>
      w.Role && w.Role.toLowerCase().includes('bureau')
    ).map(w => ({
      id: `worker-${w.worker_id}`,
      displayName: `${w.F_Name} ${w.Surname}`,
      aliases: [w.F_Name.toLowerCase(), w.Surname.toLowerCase(), `${w.F_Name} ${w.Surname}`.toLowerCase()]
    }));
    setBureauStaff(buildStaffSummaries([...bureauUsers, ...bureauWorkers], matchesBureauStaff, entryData, exitData, 'bureau'));

    const depotWorkers = workersData.filter(w => {
      const role = (w.Role || '').toLowerCase();
      return role.includes('depot') || role.includes('worker') || role.includes('dépôt') ||
             (!role.includes('bureau') && !role.includes('security') && w.Role);
    }).map(w => ({
      id: `worker-${w.worker_id}`,
      displayName: `${w.F_Name} ${w.Surname}`,
      aliases: [w.F_Name.toLowerCase(), w.Surname.toLowerCase(), `${w.F_Name} ${w.Surname}`.toLowerCase()]
    }));
    setDepotStaff(buildStaffSummaries(depotWorkers, matchesDepotStaff, entryData, exitData, 'depot'));

    const securityUsers = usersData.filter(u => u.role === 'security').map(u => ({
      id: `user-${u.user_id}`,
      displayName: u.username,
      aliases: [u.username.toLowerCase()]
    }));
    setSecurityStaff(buildStaffSummaries(securityUsers, matchesSecurityStaff, entryData, exitData, 'security'));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [workersResponse, usersResponse, entryResponse, exitResponse] = await Promise.all([
          fetch('/api/workers'),
          fetch('/api/users'),
          fetch('/api/entry-vouchers'),
          fetch('/api/exit-vouchers')
        ]);

        if (!workersResponse.ok) {
          throw new Error('Failed to fetch workers');
        }

        const workersData = await workersResponse.json();
        setWorkers(workersData);

        let usersData = [];
        if (usersResponse.ok) {
          usersData = await usersResponse.json();
          setUsers(usersData);
        }

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
        
        // Build bureau team from users with role 'admin' + workers with Role="bureau"
        const bureauUsers = usersData.filter(u => u.role === 'admin').map(u => ({
          id: `user-${u.user_id}`,
          displayName: u.username,
          aliases: [u.username.toLowerCase()]
        }));
        const bureauWorkers = workersData.filter(w =>
          w.Role && w.Role.toLowerCase().includes('bureau')
        ).map(w => ({
          id: `worker-${w.worker_id}`,
          displayName: `${w.F_Name} ${w.Surname}`,
          aliases: [w.F_Name.toLowerCase(), w.Surname.toLowerCase(), `${w.F_Name} ${w.Surname}`.toLowerCase()]
        }));
        const allBureauTeam = [...bureauUsers, ...bureauWorkers];
        setBureauStaff(buildStaffSummaries(allBureauTeam, matchesBureauStaff, entryData, exitData, 'bureau'));

        // Build depot team: workers with Role containing "depot", "worker", or similar
        const depotWorkers = workersData.filter(w => {
          const role = (w.Role || '').toLowerCase();
          return role.includes('depot') || role.includes('worker') || role.includes('dépôt') ||
                 (!role.includes('bureau') && !role.includes('security') && w.Role);
        }).map(w => ({
          id: `worker-${w.worker_id}`,
          displayName: `${w.F_Name} ${w.Surname}`,
          aliases: [w.F_Name.toLowerCase(), w.Surname.toLowerCase(), `${w.F_Name} ${w.Surname}`.toLowerCase()]
        }));
        setDepotStaff(buildStaffSummaries(depotWorkers, matchesDepotStaff, entryData, exitData, 'depot'));

        // Build security team from users with role 'security'
        const securityUsers = usersData.filter(u => u.role === 'security').map(u => ({
          id: `user-${u.user_id}`,
          displayName: u.username,
          aliases: [u.username.toLowerCase()]
        }));
        setSecurityStaff(buildStaffSummaries(securityUsers, matchesSecurityStaff, entryData, exitData, 'security'));
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
      const response = await fetch(`/api/${type}-vouchers/${voucherId}`);
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

  // Combine workers and users for display
  const allPersonnel = [
    ...users.map(user => ({
      id: `user-${user.user_id}`,
      type: 'user',
      displayName: toTitleCase(user.username),
      F_Name: user.username.split(' ')[0] || user.username,
      Surname: user.username.split(' ').slice(1).join(' ') || '',
      Role: user.role || 'admin',
      Carte_National: null,
      user_id: user.user_id
    })),
    ...workers.map(worker => ({
      ...worker,
      id: `worker-${worker.worker_id}`,
      type: 'worker',
      displayName: `${worker.F_Name} ${worker.Surname}`
    }))
  ];

  const filteredPersonnel = allPersonnel.filter(person => 
    person.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.Role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.Carte_National?.includes(searchTerm) ||
    (person.F_Name && person.F_Name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (person.Surname && person.Surname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Add new worker
  const addWorker = async () => {
    if (!newWorker.F_Name.trim() || !newWorker.Surname.trim()) {
      alert('Le prénom et le nom sont requis');
      return;
    }

    try {
      const response = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorker)
      });

      if (!response.ok) throw new Error('Failed to add worker');

      const addedWorker = await response.json();
      setWorkers(prev => [...prev, addedWorker]);
      
      // Refresh all data to rebuild teams
      const [usersRes, entryRes, exitRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/entry-vouchers'),
        fetch('/api/exit-vouchers')
      ]);

      const refreshedUsers = usersRes.ok ? await usersRes.json() : users;
      setUsers(refreshedUsers);

      const entryData = entryRes.ok ? await entryRes.json() : entryVouchers;
      const exitData = exitRes.ok ? await exitRes.json() : exitVouchers;
      setEntryVouchers(entryData);
      setExitVouchers(exitData);

      const updatedWorkers = [...workers, addedWorker];
      rebuildTeams(refreshedUsers, updatedWorkers, entryData, exitData);

      setShowAddWorkerModal(false);
      setNewWorker({ F_Name: '', Surname: '', Carte_National: '', Role: '' });
    } catch (error) {
      console.error('Error adding worker:', error);
      alert('Erreur lors de l\'ajout du travailleur');
    }
  };

  // Delete user (soft delete)
  const deleteUser = async (userId) => {
    if (!window.confirm('Supprimer cet utilisateur ? Son nom restera sur les bons existants.')) return;

    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete user');
      }

      const [workersRes, usersRes, entryRes, exitRes] = await Promise.all([
        fetch('/api/workers'),
        fetch('/api/users'),
        fetch('/api/entry-vouchers'),
        fetch('/api/exit-vouchers')
      ]);

      const refreshedWorkers = workersRes.ok ? await workersRes.json() : workers;
      setWorkers(refreshedWorkers);
      const refreshedUsers = usersRes.ok ? await usersRes.json() : users.filter(u => u.user_id !== userId);
      setUsers(refreshedUsers);
      const entryData = entryRes.ok ? await entryRes.json() : entryVouchers;
      const exitData = exitRes.ok ? await exitRes.json() : exitVouchers;
      setEntryVouchers(entryData);
      setExitVouchers(exitData);
      rebuildTeams(refreshedUsers, refreshedWorkers, entryData, exitData);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  // Delete worker
  const deleteWorker = async (workerId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce travailleur?')) return;

    try {
      const response = await fetch(`/api/workers/${workerId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete worker');
      }

      // Remove from state
      setWorkers(prev => prev.filter(worker => worker.worker_id !== workerId));
      
      // Refresh all data and rebuild teams
      const [workersRes, usersRes, entryRes, exitRes] = await Promise.all([
        fetch('/api/workers'),
        fetch('/api/users'),
        fetch('/api/entry-vouchers'),
        fetch('/api/exit-vouchers')
      ]);

      const refreshedWorkers = workersRes.ok ? await workersRes.json() : workers.filter(w => w.worker_id !== workerId);
      setWorkers(refreshedWorkers);

      const refreshedUsers = usersRes.ok ? await usersRes.json() : users;
      setUsers(refreshedUsers);

      const entryData = entryRes.ok ? await entryRes.json() : entryVouchers;
      const exitData = exitRes.ok ? await exitRes.json() : exitVouchers;
      setEntryVouchers(entryData);
      setExitVouchers(exitData);

      rebuildTeams(refreshedUsers, refreshedWorkers, entryData, exitData);
    } catch (error) {
      console.error('Error deleting worker:', error);
      alert(`Erreur lors de la suppression du travailleur: ${error.message}`);
    }
  };

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
          {allPersonnel.length} membre{allPersonnel.length !== 1 ? 's' : ''} du personnel
        </p>
      </div>

      {/* Search Bar and Admin Editing */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un travailleur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <button
                  onClick={() => setShowAddWorkerModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter
                </button>
                <button
                  onClick={() => setIsEditMode(false)}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Quitter
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Admin Editing
              </button>
            )}
          </div>
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

      {/* Security Team Section */}
      {securityStaff.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Équipe Sécurité</h2>
              <p className="text-slate-600 mt-1">
                {securityStaff.reduce((sum, staff) => sum + staff.total, 0)} bon{securityStaff.reduce((sum, staff) => sum + staff.total, 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {securityStaff.map((staff) => (
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

      {/* All Personnel Section - Show at bottom */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Tout le Personnel</h2>
            <p className="text-slate-600 mt-1">
              Liste complète de tous les travailleurs
            </p>
          </div>
        </div>

        {/* Personnel List */}
        {filteredPersonnel.length === 0 ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
            <Users className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">Aucun personnel trouvé</h3>
            <p className="text-slate-500">
              {searchTerm 
                ? 'Essayez de modifier vos critères de recherche' 
                : 'Aucun personnel enregistré pour le moment'
              }
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPersonnel.map((person) => (
            <div
              key={person.id}
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
                        {person.displayName}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {person.type === 'user' ? 'Utilisateur' : 'Travailleur'} • ID: {person.type === 'user' ? person.user_id : person.worker_id}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Badge className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Rôle:</span>
                    <span className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                      {person.Role ? toTitleCase(person.Role) : 'Non spécifié'}
                    </span>
                  </div>
                  
                  {person.Carte_National && (
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-600">Carte National:</span>
                      <span className="text-sm font-medium text-slate-700">
                        {person.Carte_National}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {person.type === 'worker' && (
                    <>
                      <button
                        onClick={() => showWorkerInfo(person)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Voir l'historique</span>
                      </button>
                      {isEditMode && (
                        <button
                          onClick={() => deleteWorker(person.worker_id)}
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                          title="Supprimer le travailleur"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                  {person.type === 'user' && (
                    <div className="flex gap-2 w-full">
                      <div className="flex-1 text-center text-sm text-slate-500 py-2">
                        Membre du bureau
                      </div>
                      {isEditMode && (
                        <button
                          onClick={() => deleteUser(person.user_id)}
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                          title="Supprimer l'utilisateur"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

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

      {/* Add Worker Modal */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Ajouter un travailleur</h2>
              <button
                onClick={() => {
                  setShowAddWorkerModal(false);
                  setNewWorker({ F_Name: '', Surname: '', Carte_National: '', Role: '' });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={newWorker.F_Name}
                    onChange={(e) => setNewWorker(prev => ({ ...prev, F_Name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Prénom"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={newWorker.Surname}
                    onChange={(e) => setNewWorker(prev => ({ ...prev, Surname: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carte National
                </label>
                <input
                  type="text"
                  value={newWorker.Carte_National}
                  onChange={(e) => setNewWorker(prev => ({ ...prev, Carte_National: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Numéro de carte nationale (optionnel)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rôle
                </label>
                <select
                  value={newWorker.Role}
                  onChange={(e) => setNewWorker(prev => ({ ...prev, Role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Sélectionner un rôle</option>
                  <option value="Depot">Dépôt</option>
                  <option value="Bureau">Bureau</option>
                  <option value="Security">Sécurité</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddWorkerModal(false);
                  setNewWorker({ F_Name: '', Surname: '', Carte_National: '', Role: '' });
                }}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={addWorker}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Code Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <Lock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Code d'accès Admin</h2>
              <p className="text-slate-600">Entrez le code PIN à 4 chiffres</p>
            </div>

            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  id={`personnel-pin-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={pinCode[index]}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  className="w-16 h-16 text-center text-2xl font-bold border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setPinCode(['', '', '', '']);
                }}
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
    </div>
  );
};

export default Personnel; 