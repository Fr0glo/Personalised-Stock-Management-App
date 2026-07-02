import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { UserPlus, Save, Trash2, Edit, X, KeyRound, Shield, ShieldOff, ChevronRight } from 'lucide-react';

const SYSTEM_ROLES = ['superadmin', 'owner', 'security', 'depot'];

const Comptes = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add-user form (asAdmin: owner can create admin accounts)
  const [newUser, setNewUser] = useState({ username: '', password: '', asAdmin: false });
  // Inline edit
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({ username: '', password: '' });
  // Per-admin limit drafts (owner card)
  const [limitDrafts, setLimitDrafts] = useState({});

  // Admin security
  const [adminPassword, setAdminPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const me = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
  const isOwner = me?.role === 'owner';

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Échec du chargement');
      setAllUsers(await res.json());
    } catch (err) {
      console.error('Comptes load error:', err);
      setError('Impossible de charger les comptes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  if (me && !['superadmin', 'owner'].includes(me.role)) return <Navigate to="/" replace />;

  // Derived views
  const admins = allUsers.filter(u => u.role === 'superadmin');
  const office = allUsers.filter(u => !SYSTEM_ROLES.includes(u.role));
  const subsOf = (adminId) => office.filter(o => o.created_by === adminId);
  const orphans = office.filter(o => !o.created_by || !admins.some(a => a.user_id === o.created_by));

  // The client admin's own plan limit + how many accounts they've created
  const meRecord = allUsers.find(u => u.user_id === me?.user_id);
  const myLimit = meRecord?.max_users || 0;
  const myCount = office.filter(o => o.created_by === me?.user_id || !o.created_by).length;
  const atLimit = !isOwner && myLimit > 0 && myCount >= myLimit;

  const addUser = async () => {
    if (!newUser.username.trim() || !newUser.password) {
      alert("Nom d'utilisateur et mot de passe requis");
      return;
    }
    if (atLimit) {
      alert(`Limite atteinte : ${myLimit} compte(s) maximum pour votre formule. Contactez votre fournisseur pour en ajouter.`);
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.username.trim(),
          password: newUser.password,
          role: (isOwner && newUser.asAdmin) ? 'superadmin' : 'admin',
          created_by: me?.user_id ?? null
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Échec');
      }
      setNewUser({ username: '', password: '', asAdmin: false });
      await loadUsers();
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const startEdit = (u) => {
    setEditId(u.user_id);
    setEditData({ username: u.username, password: '' });
  };

  const saveEdit = async (id) => {
    if (!editData.username.trim()) { alert("Nom d'utilisateur requis"); return; }
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editData.username.trim(), password: editData.password })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Échec');
      }
      setEditId(null);
      await loadUsers();
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Supprimer le compte « ${u.username} » ?`)) return;
    try {
      const res = await fetch(`/api/users/${u.user_id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Échec');
      await loadUsers();
    } catch {
      alert('Erreur lors de la suppression');
    }
  };

  // Owner: promote an account to admin (they'll get the company wizard on
  // their first login) or demote an admin back to a normal user.
  const setAdminRole = async (u, makeAdmin) => {
    const msg = makeAdmin
      ? `Donner les droits admin à « ${u.username} » ?`
      : `Retirer les droits admin de « ${u.username} » ?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`/api/users/${u.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u.username,
          role: makeAdmin ? 'superadmin' : 'admin',
          ...(makeAdmin ? {} : { first_login: 0 })
        })
      });
      if (!res.ok) throw new Error('Échec');
      await loadUsers();
    } catch {
      alert('Erreur lors du changement de rôle');
    }
  };

  const saveLimit = async (a) => {
    const n = Math.max(0, parseInt(limitDrafts[a.user_id], 10) || 0);
    try {
      const res = await fetch(`/api/users/${a.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: a.username, max_users: n })
      });
      if (!res.ok) throw new Error('Échec');
      await loadUsers();
      alert(`Limite de « ${a.username} » mise à jour (${n === 0 ? 'illimité' : n}).`);
    } catch {
      alert('Erreur lors de la mise à jour de la limite');
    }
  };

  const changeAdminPassword = async () => {
    if (!adminPassword) { alert('Entrez un nouveau mot de passe'); return; }
    if (!me?.user_id) { alert('Session admin introuvable'); return; }
    try {
      const res = await fetch(`/api/users/${me.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: me.username, role: me.role, password: adminPassword })
      });
      if (!res.ok) throw new Error('Échec');
      setAdminPassword('');
      alert('Mot de passe mis à jour.');
    } catch {
      alert('Erreur lors de la mise à jour du mot de passe');
    }
  };

  const changePin = async () => {
    if (!/^\d{4}$/.test(newPin)) { alert('Le code doit comporter 4 chiffres'); return; }
    if (newPin !== confirmPin) { alert('Les codes ne correspondent pas'); return; }
    try {
      const res = await fetch('/api/settings/admin-pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Échec');
      }
      setNewPin(''); setConfirmPin('');
      alert('Code admin (bouton) mis à jour.');
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // One account row (used in both flat and grouped views)
  const renderRow = (u, { indent = false, isAdminRow = false } = {}) => (
    <div key={u.user_id} className={`py-3 flex items-center gap-3 ${indent ? 'pl-8' : ''}`}>
      {editId === u.user_id ? (
        <>
          <input
            type="text" value={editData.username}
            onChange={(e) => setEditData(p => ({ ...p, username: e.target.value }))}
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            placeholder="Nom d'utilisateur"
          />
          <input
            type="text" value={editData.password}
            onChange={(e) => setEditData(p => ({ ...p, password: e.target.value }))}
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            placeholder="Nouveau mot de passe (vide = inchangé)"
          />
          <button onClick={() => saveEdit(u.user_id)} className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700" title="Enregistrer">
            <Save className="h-4 w-4" />
          </button>
          <button onClick={() => setEditId(null)} className="p-1.5 bg-slate-400 text-white rounded hover:bg-slate-500" title="Annuler">
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          {indent && <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />}
          <span className="flex-1 font-medium text-slate-800">
            {u.username}
            {isAdminRow && (
              <span className="ml-2 px-1.5 py-0.5 bg-navy-50 text-navy-700 text-xs font-medium rounded inline-flex items-center gap-1">
                <Shield className="h-3 w-3" /> Admin
              </span>
            )}
          </span>
          {isOwner && !isAdminRow && (
            <button onClick={() => setAdminRole(u, true)} className="p-1.5 text-navy-700 hover:text-navy-800" title="Donner les droits admin">
              <Shield className="h-4 w-4" />
            </button>
          )}
          {isOwner && isAdminRow && (
            <button onClick={() => setAdminRole(u, false)} className="p-1.5 text-orange-600 hover:text-orange-700" title="Retirer les droits admin">
              <ShieldOff className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => startEdit(u)} className="p-1.5 text-blue-600 hover:text-blue-800" title="Modifier">
            <Edit className="h-4 w-4" />
          </button>
          <button onClick={() => removeUser(u)} className="p-1.5 text-red-600 hover:text-red-800" title="Supprimer">
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Comptes &amp; Sécurité</h1>
        <p className="text-slate-600 mt-1">
          {isOwner ? 'Gérer les admins, leurs sous-comptes et leurs limites.' : 'Gérer les logins du bureau et les codes admin.'}
        </p>
      </div>

      {/* Accounts */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{isOwner ? 'Comptes' : 'Utilisateurs (bureau)'}</h2>
          {!isOwner && myLimit > 0 && (
            <span className={`text-sm font-medium ${atLimit ? 'text-red-600' : 'text-slate-500'}`}>
              {myCount} / {myLimit} comptes
            </span>
          )}
        </div>

        {/* Add */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <input
            type="text" value={newUser.username}
            onChange={(e) => setNewUser(p => ({ ...p, username: e.target.value }))}
            placeholder="Nom d'utilisateur"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text" value={newUser.password}
            onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))}
            placeholder="Mot de passe"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {isOwner && (
            <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox" checked={newUser.asAdmin}
                onChange={(e) => setNewUser(p => ({ ...p, asAdmin: e.target.checked }))}
                className="rounded"
              />
              <Shield className="h-4 w-4 text-navy-700" /> Admin
            </label>
          )}
          <button onClick={addUser} disabled={atLimit} title={atLimit ? 'Limite de comptes atteinte' : ''} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <UserPlus className="h-4 w-4" /> Ajouter
          </button>
        </div>

        {isLoading ? (
          <p className="text-slate-400 text-sm">Chargement…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : isOwner ? (
          /* Owner: admins with their sub-accounts grouped underneath */
          admins.length === 0 && orphans.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun compte pour le moment.</p>
          ) : (
            <div className="space-y-4">
              {admins.map(a => {
                const subs = subsOf(a.user_id);
                return (
                  <div key={a.user_id} className="border border-slate-200 rounded-lg px-4 py-1">
                    {renderRow(a, { isAdminRow: true })}
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {subs.length === 0
                        ? <p className="text-xs text-slate-400 py-2 pl-8">Aucun sous-compte</p>
                        : subs.map(s => renderRow(s, { indent: true }))}
                    </div>
                    <p className="text-[11px] text-slate-400 pb-2 pl-1">
                      {subs.length} sous-compte{subs.length > 1 ? 's' : ''}
                      {(a.max_users || 0) > 0 ? ` / limite ${a.max_users}` : ' · illimité'}
                    </p>
                  </div>
                );
              })}
              {orphans.length > 0 && (
                <div className="border border-dashed border-slate-200 rounded-lg px-4 py-1">
                  <p className="text-xs font-medium text-slate-500 pt-2">Autres comptes</p>
                  <div className="divide-y divide-slate-50">
                    {orphans.map(o => renderRow(o, { indent: true }))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* Client admin: flat list of office accounts */
          office.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun compte bureau pour le moment.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {office.map(u => renderRow(u))}
            </div>
          )
        )}
      </div>

      {/* Admin security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-400" /> Mot de passe
          </h2>
          <p className="text-sm text-slate-500 mb-4">Le mot de passe de votre propre compte.</p>
          <div className="flex gap-2">
            <input
              type="text" value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={changeAdminPassword} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Mettre à jour
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-400" /> Code admin (bouton)
          </h2>
          <p className="text-sm text-slate-500 mb-4">Le code à 4 chiffres pour débloquer l'édition (Stock, Personnel, Les Bons).</p>
          <div className="flex flex-col gap-2">
            <input
              type="password" inputMode="numeric" maxLength="4" value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Nouveau code (4 chiffres)"
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password" inputMode="numeric" maxLength="4" value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirmer le code"
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={changePin} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Changer le code
            </button>
          </div>
        </div>
      </div>

      {/* Owner-only: per-admin account limits */}
      {isOwner && admins.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-navy-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Shield className="h-5 w-5 text-navy-700" /> Limites par admin (super admin)
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Nombre maximum de sous-comptes que chaque admin peut créer. 0 = illimité. Visible uniquement par vous.
          </p>
          <div className="divide-y divide-slate-100">
            {admins.map(a => (
              <div key={a.user_id} className="py-3 flex items-center gap-3">
                <span className="flex-1 font-medium text-slate-800">{a.username}</span>
                <span className="text-xs text-slate-400">{subsOf(a.user_id).length} sous-compte(s)</span>
                <input
                  type="number" min="0"
                  value={limitDrafts[a.user_id] ?? (a.max_users || '')}
                  placeholder="0"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setLimitDrafts(p => ({ ...p, [a.user_id]: e.target.value }))}
                  className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-center"
                />
                <button onClick={() => saveLimit(a)} className="px-3 py-1.5 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-800">
                  Enregistrer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Comptes;
