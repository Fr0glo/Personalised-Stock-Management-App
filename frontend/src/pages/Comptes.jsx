import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { UserPlus, Save, Trash2, Edit, X, KeyRound, Shield } from 'lucide-react';

const SYSTEM_ROLES = ['superadmin', 'security', 'depot'];

const Comptes = () => {
  const [users, setUsers] = useState([]);
  const [maxUsers, setMaxUsers] = useState(0); // 0 = unlimited
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add-user form
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  // Inline edit
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({ username: '', password: '' });

  // Admin security
  const [adminPassword, setAdminPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const me = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Échec du chargement');
      const all = await res.json();
      // Office staff = everyone except the system accounts (admin, security, depot)
      setUsers(all.filter(u => !SYSTEM_ROLES.includes(u.role)));
    } catch (err) {
      console.error('Comptes load error:', err);
      setError('Impossible de charger les comptes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    fetch('/api/settings/limits').then(r => r.ok ? r.json() : null).then(d => { if (d) setMaxUsers(d.max_users || 0); }).catch(() => {});
  }, []);

  if (me && me.role !== 'superadmin') return <Navigate to="/" replace />;

  const atLimit = maxUsers > 0 && users.length >= maxUsers;

  const addUser = async () => {
    if (!newUser.username.trim() || !newUser.password) {
      alert("Nom d'utilisateur et mot de passe requis");
      return;
    }
    if (atLimit) {
      alert(`Limite atteinte : ${maxUsers} compte(s) maximum pour votre formule. Contactez votre fournisseur pour en ajouter.`);
      return;
    }
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUser.username.trim(), password: newUser.password, role: 'admin' })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Échec');
      }
      setNewUser({ username: '', password: '' });
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

  const changeAdminPassword = async () => {
    if (!adminPassword) { alert('Entrez un nouveau mot de passe'); return; }
    if (!me?.user_id) { alert('Session admin introuvable'); return; }
    try {
      const res = await fetch(`/api/users/${me.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: me.username, role: 'superadmin', password: adminPassword })
      });
      if (!res.ok) throw new Error('Échec');
      setAdminPassword('');
      alert('Mot de passe admin mis à jour.');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Comptes &amp; Sécurité</h1>
        <p className="text-slate-600 mt-1">Gérer les logins du bureau et les codes admin.</p>
      </div>

      {/* Office users */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Utilisateurs (bureau)</h2>
          {maxUsers > 0 && (
            <span className={`text-sm font-medium ${atLimit ? 'text-red-600' : 'text-slate-500'}`}>
              {users.length} / {maxUsers} comptes
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
          <button onClick={addUser} disabled={atLimit} title={atLimit ? 'Limite de comptes atteinte' : ''} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <UserPlus className="h-4 w-4" /> Ajouter
          </button>
        </div>

        {isLoading ? (
          <p className="text-slate-400 text-sm">Chargement…</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : users.length === 0 ? (
          <p className="text-slate-400 text-sm">Aucun compte bureau pour le moment.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map(u => (
              <div key={u.user_id} className="py-3 flex items-center gap-3">
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
                    <span className="flex-1 font-medium text-slate-800">{u.username}</span>
                    <button onClick={() => startEdit(u)} className="p-1.5 text-blue-600 hover:text-blue-800" title="Modifier">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => removeUser(u)} className="p-1.5 text-red-600 hover:text-red-800" title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-400" /> Mot de passe admin
          </h2>
          <p className="text-sm text-slate-500 mb-4">Le mot de passe pour se connecter en tant qu'admin.</p>
          <div className="flex gap-2">
            <input
              type="text" value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Nouveau mot de passe admin"
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
    </div>
  );
};

export default Comptes;
