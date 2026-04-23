'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import type { Profile, Equipo, Rol } from '@/types';
import { rolColor, equipoColor } from '@/lib/utils';
import { UserCog, Search, Mail, Phone, Plus, Edit2, X, UserPlus, Shield, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  miembros: Profile[];
}

const EQUIPOS: (Equipo | 'todos')[] = ['todos', 'soporte', 'financiero', 'administrativo'];
const ROLES: Rol[] = ['admin', 'soporte', 'financiero', 'administrativo'];
const EQUIPO_OPTIONS: (Equipo | '')[] = ['', 'soporte', 'financiero', 'administrativo'];

const avatarColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-yellow-500',
  'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(nombre: string, apellido: string): string {
  return `${nombre.charAt(0)}${(apellido || '').charAt(0)}`.toUpperCase();
}

const emptyForm = {
  email: '',
  password: '',
  nombre: '',
  apellido: '',
  rol: 'soporte' as Rol,
  equipo: '' as Equipo | '',
  telefono: '',
};

export default function EquipoClient({ miembros: initialMiembros }: Props) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const isAdmin = profile?.rol === 'admin';

  const [miembros, setMiembros] = useState(initialMiembros);
  const [search, setSearch] = useState('');
  const [equipoFilter, setEquipoFilter] = useState<Equipo | 'todos'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ nombre: '', apellido: '', rol: 'soporte' as Rol, equipo: '' as Equipo | '', telefono: '', activo: true });
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<Profile | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowModal(false); setShowEditModal(false); setShowResetPassword(false); }
    };
    if (showModal || showEditModal || showResetPassword) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => { document.removeEventListener('keydown', handleEscape); document.body.style.overflow = ''; };
  }, [showModal, showEditModal, showResetPassword]);

  const filtered = miembros.filter((m) => {
    const matchEquipo = equipoFilter === 'todos' || m.equipo === equipoFilter;
    const term = search.toLowerCase();
    const matchSearch = !term ||
      m.nombre.toLowerCase().includes(term) ||
      (m.apellido || '').toLowerCase().includes(term) ||
      (m.email || '').toLowerCase().includes(term);
    return matchEquipo && matchSearch;
  });

  const grouped = filtered.reduce<Record<string, Profile[]>>((acc, m) => {
    const key = m.equipo ?? 'sin_equipo';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const equipoLabels: Record<string, string> = {
    soporte: 'Soporte', financiero: 'Financiero', administrativo: 'Administrativo', sin_equipo: 'Sin Equipo',
  };

  const countByEquipo = (equipo: Equipo | 'todos') =>
    equipo === 'todos' ? miembros.length : miembros.filter((m) => m.equipo === equipo).length;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.nombre) {
      toast.error('Email, contraseña y nombre son requeridos');
      return;
    }
    if (form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      // Usar API Route de Next.js — no tiene problemas de JWT expirado
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          apellido: form.apellido || '',
          rol: form.rol,
          equipo: form.equipo || null,
          telefono: form.telefono || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Error ${response.status}: ${response.statusText}`);
      }

      toast.success(`Usuario ${form.nombre} creado exitosamente`);
      setShowModal(false);
      setForm(emptyForm);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear usuario';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: editForm.nombre,
          apellido: editForm.apellido,
          rol: editForm.rol,
          equipo: editForm.equipo || null,
          telefono: editForm.telefono || null,
          activo: editForm.activo,
        })
        .eq('id', editingProfile.id);

      if (error) throw error;

      setMiembros(prev => prev.map(m =>
        m.id === editingProfile.id
          ? { ...m, ...editForm, equipo: (editForm.equipo || null) as Equipo | null, telefono: editForm.telefono || null }
          : m
      ));
      toast.success('Perfil actualizado');
      setShowEditModal(false);
      setEditingProfile(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (m: Profile) => {
    setEditingProfile(m);
    setEditForm({
      nombre: m.nombre,
      apellido: m.apellido || '',
      rol: m.rol,
      equipo: m.equipo || '',
      telefono: m.telefono || '',
      activo: m.activo,
    });
    setShowEditModal(true);
  };

  const openResetPassword = (m: Profile) => {
    setResetPasswordTarget(m);
    setTempPassword('');
    setShowResetPassword(true);
  };

  function generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTarget || !tempPassword) return;
    if (tempPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: resetPasswordTarget.id,
          newPassword: tempPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al resetear contraseña');
      }
      toast.success(`Contraseña temporal asignada a ${resetPasswordTarget.nombre}`);
      setShowResetPassword(false);
      setResetPasswordTarget(null);
      setTempPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al resetear contraseña';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Equipo</h1>
            <p className="text-sm text-gray-400">{miembros.length} miembros del equipo</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <UserPlus size={16} /> Nuevo Usuario
          </button>
        )}
      </div>

      <div className="card p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" placeholder="Buscar por nombre o email..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-10 w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {EQUIPOS.map((equipo) => (
            <button key={equipo} onClick={() => setEquipoFilter(equipo)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                equipoFilter === equipo ? 'bg-blue-600 text-white' : 'bg-[#1C2333] text-gray-400 hover:text-gray-200'
              }`}>
              {equipo === 'todos' ? 'Todos' : equipo.charAt(0).toUpperCase() + equipo.slice(1)}{' '}
              <span className="ml-1 text-xs opacity-70">({countByEquipo(equipo)})</span>
            </button>
          ))}
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="card p-12 text-center text-gray-500">No se encontraron miembros del equipo</div>
      ) : (
        Object.entries(grouped).map(([equipo, members]) => (
          <div key={equipo} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${
                equipo === 'soporte' ? 'bg-blue-400' : equipo === 'financiero' ? 'bg-emerald-400'
                  : equipo === 'administrativo' ? 'bg-yellow-400' : 'bg-gray-400'
              }`} />
              {equipoLabels[equipo] ?? equipo}
              <span className="text-sm text-gray-500 font-normal">({members.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((m) => (
                <div key={m.id} className="card p-4 hover:bg-[#1C2333]/50 transition-colors group relative">
                  {isAdmin && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openResetPassword(m)}
                        className="p-1.5 rounded hover:bg-[#1C2333] text-gray-600 hover:text-yellow-400"
                        title="Resetear contraseña">
                        <KeyRound size={14} />
                      </button>
                      <button onClick={() => openEdit(m)}
                        className="p-1.5 rounded hover:bg-[#1C2333] text-gray-600 hover:text-blue-400"
                        title="Editar perfil">
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(m.nombre + (m.apellido || ''))}`}>
                      {getInitials(m.nombre, m.apellido || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-100 truncate">{m.nombre} {m.apellido}</h3>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.activo ? 'bg-emerald-400' : 'bg-gray-500'}`}
                          title={m.activo ? 'Activo' : 'Inactivo'} />
                      </div>
                      {m.email && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-400">
                          <Mail className="h-3 w-3 flex-shrink-0" /><span className="truncate">{m.email}</span>
                        </div>
                      )}
                      {m.telefono && (
                        <div className="flex items-center gap-1 mt-0.5 text-sm text-gray-400">
                          <Phone className="h-3 w-3 flex-shrink-0" /><span>{m.telefono}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`badge text-xs ${rolColor(m.rol)}`}>{m.rol}</span>
                        {m.equipo && <span className={`badge text-xs ${equipoColor(m.equipo)}`}>{m.equipo}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal Crear Usuario */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserPlus size={20} className="text-blue-400" /> Nuevo Usuario
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateUser} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input className="input" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">Contraseña *</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres" required minLength={6} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rol</label>
                  <select className="input" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Equipo</label>
                  <select className="input" value={form.equipo} onChange={(e) => setForm({ ...form, equipo: e.target.value as Equipo | '' })}>
                    <option value="">Sin equipo</option>
                    {EQUIPO_OPTIONS.filter(Boolean).map((eq) => (
                      <option key={eq} value={eq}>{(eq as string).charAt(0).toUpperCase() + (eq as string).slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div className="bg-[#1C2333] rounded-lg p-3 text-xs text-gray-400 flex items-start gap-2">
                <Shield size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <span>El usuario podrá iniciar sesión con el email y contraseña asignados. Los permisos se definen por el rol seleccionado.</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resetear Contraseña */}
      {showResetPassword && resetPasswordTarget && (
        <div className="modal-overlay" onClick={() => setShowResetPassword(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <KeyRound size={20} className="text-yellow-400" /> Resetear Contraseña
              </h2>
              <button onClick={() => setShowResetPassword(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleResetPassword} className="p-4 space-y-4">
              <div className="bg-[#1C2333] rounded-lg p-3 text-sm text-gray-300">
                <span className="text-white font-medium">{resetPasswordTarget.nombre} {resetPasswordTarget.apellido}</span>
                {resetPasswordTarget.email && (
                  <span className="text-gray-500 ml-2 text-xs">{resetPasswordTarget.email}</span>
                )}
              </div>
              <div>
                <label className="label">Nueva Contraseña Temporal</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setTempPassword(generateTempPassword())}
                    className="btn-secondary text-xs px-3 whitespace-nowrap"
                  >
                    Generar
                  </button>
                </div>
              </div>
              {tempPassword && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
                  <p className="text-yellow-400 font-medium text-xs mb-1">Contraseña a asignar:</p>
                  <p className="text-white font-mono text-lg tracking-wider select-all">{tempPassword}</p>
                  <p className="text-yellow-400/60 text-xs mt-1">Copia y comparte esta contraseña con el usuario</p>
                </div>
              )}
              <div className="bg-[#1C2333] rounded-lg p-3 text-xs text-gray-400 flex items-start gap-2">
                <Shield size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <span>El usuario podrá iniciar sesión con esta nueva contraseña inmediatamente. Se recomienda que el usuario cambie su contraseña después.</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowResetPassword(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading || !tempPassword} className="btn-primary">
                  {loading ? 'Reseteando...' : 'Asignar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Perfil */}
      {showEditModal && editingProfile && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Edit2 size={20} className="text-blue-400" /> Editar Perfil
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleEditProfile} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre</label>
                  <input className="input" value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input className="input" value={editForm.apellido} onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rol</label>
                  <select className="input" value={editForm.rol} onChange={(e) => setEditForm({ ...editForm, rol: e.target.value as Rol })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Equipo</label>
                  <select className="input" value={editForm.equipo} onChange={(e) => setEditForm({ ...editForm, equipo: e.target.value as Equipo | '' })}>
                    <option value="">Sin equipo</option>
                    {EQUIPO_OPTIONS.filter(Boolean).map((eq) => (
                      <option key={eq} value={eq}>{(eq as string).charAt(0).toUpperCase() + (eq as string).slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <label className="label mb-0">Estado</label>
                <button type="button"
                  onClick={() => setEditForm({ ...editForm, activo: !editForm.activo })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.activo ? 'bg-emerald-600' : 'bg-gray-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.activo ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={`text-sm ${editForm.activo ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {editForm.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
