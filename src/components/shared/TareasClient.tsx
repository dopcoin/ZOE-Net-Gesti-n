'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createTarea, updateTarea, deleteTarea, toggleTarea, getErrorMessage, syncInstalacionPorTarea } from '@/lib/services';
import { formatDate, prioridadColor } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, X, CheckSquare, Square, AlertTriangle, ChevronDown, ChevronRight, History } from 'lucide-react';
import type { Tarea, Equipo, Prioridad, Profile } from '@/types';

interface MiembroOption {
  id: string;
  nombre: string;
  apellido: string;
  equipo: Equipo | null;
  rol?: string;
}

interface ClienteOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface Props {
  tareas: (Tarea & { profiles?: Profile; clientes?: { nombre: string; apellido: string } | null })[];
  miembros: MiembroOption[];
  clientes: ClienteOption[];
  userId: string | null;
  userRole: string | null;
}

const equipoLabels: Record<Equipo, string> = {
  soporte: 'Soporte',
  financiero: 'Financiero',
  administrativo: 'Administrativo',
};

const equipoColors: Record<Equipo, { header: string; border: string }> = {
  soporte: { header: 'text-blue-400', border: 'border-blue-500/30' },
  financiero: { header: 'text-emerald-400', border: 'border-emerald-500/30' },
  administrativo: { header: 'text-yellow-400', border: 'border-yellow-500/30' },
};

const defaultForm = {
  titulo: '',
  descripcion: '',
  equipo: 'soporte' as Equipo,
  asignado_a: '',
  prioridad: 'normal' as Prioridad,
  fecha_limite: '',
  cliente_id: '',
};

function isOverdue(fecha_limite: string | null, completada: boolean): boolean {
  if (!fecha_limite || completada) return false;
  return new Date(fecha_limite) < new Date(new Date().toDateString());
}

export default function TareasClient({ tareas: initial, miembros, clientes, userId, userRole }: Props) {
  const router = useRouter();
  const [tareas, setTareas] = useState(initial);
  const [search, setSearch] = useState('');
  const [filtroEquipo, setFiltroEquipo] = useState<Equipo | 'todos'>('todos');
  const [soloMias, setSoloMias] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Tarea | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [showPasadas, setShowPasadas] = useState(false);

  const equipos: Equipo[] = ['soporte', 'financiero', 'administrativo'];

  // Sync with server data when props change
  useEffect(() => {
    setTareas(initial);
  }, [initial]);

  // Modal: Escape key handler + body overflow cleanup
  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  useEffect(() => {
    if (!showModal) return;

    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeModal();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, closeModal]);

  const miTareasCount = userId
    ? tareas.filter((t) => t.asignado_a === userId && !t.completada).length
    : 0;

  const tareasActivas = tareas.filter((t) => !t.completada);
  const tareasCompletadas = tareas.filter((t) => t.completada);

  const filtered = tareasActivas.filter((t) => {
    const matchEquipo = filtroEquipo === 'todos' || t.equipo === filtroEquipo;
    const matchSearch =
      search === '' ||
      t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (t.descripcion ?? '').toLowerCase().includes(search.toLowerCase());
    const matchMias = !soloMias || (userId && t.asignado_a === userId);
    return matchEquipo && matchSearch && matchMias;
  });

  // Match by equipo field, or fallback: match by rol when equipo is null
  const miembrosFiltrados = miembros.filter(
    (m) => m.equipo === form.equipo || (m.equipo === null && m.rol === form.equipo)
  );

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  }

  function openEdit(tarea: Tarea) {
    setEditing(tarea);
    setForm({
      titulo: tarea.titulo,
      descripcion: tarea.descripcion ?? '',
      equipo: tarea.equipo,
      asignado_a: tarea.asignado_a ?? '',
      prioridad: tarea.prioridad,
      fecha_limite: tarea.fecha_limite ?? '',
      cliente_id: tarea.cliente_id ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.titulo.trim()) {
      toast.error('El titulo es requerido');
      return;
    }
    setLoading(true);

    const payload: Record<string, unknown> = {
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      equipo: form.equipo,
      asignado_a: form.asignado_a || null,
      prioridad: form.prioridad,
      fecha_limite: form.fecha_limite || null,
      cliente_id: form.cliente_id || null,
    };

    if (editing) {
      const result = await updateTarea(editing.id, payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
      } else {
        toast.success('Tarea actualizada');
        closeModal();
        router.refresh();
      }
    } else {
      // Get current user ID so RLS policy (creado_por = auth.uid()) passes
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const insertPayload: Record<string, unknown> = {
        ...payload,
        tipo_equipo: form.equipo,
        completada: false,
        estado: 'pendiente',
        creado_por: user?.id ?? null,
      };
      const result = await createTarea(insertPayload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
      } else {
        toast.success('Tarea creada');
        closeModal();
        router.refresh();
      }
    }
    setLoading(false);
  }

  async function handleToggle(tarea: Tarea) {
    const newValue = !tarea.completada;
    const result = await toggleTarea(tarea.id, newValue);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    setTareas((prev) =>
      prev.map((t) => (t.id === tarea.id ? { ...t, completada: newValue } : t))
    );
    // Si la tarea está vinculada a una instalación, sincronizar el estado.
    if (tarea.referencia_tipo === 'instalacion' && tarea.referencia_id) {
      const sync = await syncInstalacionPorTarea(tarea.referencia_id, newValue);
      if (sync.error) {
        console.warn('[Tarea→Instalación] No se pudo sincronizar:', sync.error);
      } else if (newValue) {
        toast.success('Tarea completada — instalación marcada como completada');
        router.refresh();
        return;
      } else {
        toast.success('Tarea restaurada — instalación vuelta a en progreso');
        router.refresh();
        return;
      }
    }
    if (newValue) {
      toast.success('Tarea completada — movida a Tareas Pasadas');
    } else {
      toast.success('Tarea restaurada a pendiente');
    }
  }

  function canDeleteTarea(tarea: Tarea): boolean {
    if (userRole === 'admin') return true;
    if (userId && tarea.asignado_a === userId) return true;
    if (userId && (tarea as Tarea & { creado_por?: string }).creado_por === userId) return true;
    return false;
  }

  async function handleDelete(id: string) {
    const tarea = tareas.find((t) => t.id === id);
    if (tarea && !canDeleteTarea(tarea)) {
      toast.error('Solo el administrador o la persona asignada puede eliminar esta tarea');
      return;
    }
    if (!confirm('Eliminar esta tarea?')) return;
    const result = await deleteTarea(id);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
    } else {
      toast.success('Tarea eliminada');
      setTareas((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    }
  }

  function renderEquipoSection(equipo: Equipo) {
    const tareasEquipo = filtered.filter((t) => t.equipo === equipo);
    if (filtroEquipo !== 'todos' && filtroEquipo !== equipo) return null;
    const colors = equipoColors[equipo];

    return (
      <div key={equipo} className={`card border ${colors.border} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
          <h2 className={`font-semibold ${colors.header}`}>
            {equipoLabels[equipo]}
            <span className="ml-2 text-xs text-gray-500">({tareasEquipo.length})</span>
          </h2>
        </div>
        {tareasEquipo.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Sin tareas en este equipo
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="table-header w-10"></th>
                <th className="table-header">Titulo</th>
                <th className="table-header">Asignado</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Prioridad</th>
                <th className="table-header">Fecha Limite</th>
                <th className="table-header w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tareasEquipo.map((tarea) => {
                const overdue = isOverdue(tarea.fecha_limite, tarea.completada);
                const esMia = userId && tarea.asignado_a === userId;
                return (
                  <tr
                    key={tarea.id}
                    className={`border-b border-[#1F2937]/50 hover:bg-[#1C2333]/50 transition-colors ${
                      tarea.completada ? 'opacity-60' : ''
                    } ${esMia && !tarea.completada ? 'bg-purple-500/5' : ''}`}
                  >
                    <td className="table-cell">
                      <button
                        onClick={() => handleToggle(tarea)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {tarea.completada ? (
                          <CheckSquare size={18} className="text-emerald-400" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(tarea)}
                          className={`font-medium hover:underline ${
                            tarea.completada ? 'line-through text-gray-500' : 'text-white'
                          }`}
                        >
                          {tarea.titulo}
                        </button>
                        {overdue && (
                          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                        )}
                      </div>
                      {tarea.descripcion && (
                        <p className="text-xs text-gray-500 truncate max-w-xs mt-0.5">
                          {tarea.descripcion}
                        </p>
                      )}
                    </td>
                    <td className="table-cell">
                      {tarea.profiles
                        ? `${tarea.profiles.nombre} ${tarea.profiles.apellido}`
                        : '\u2014'}
                    </td>
                    <td className="table-cell text-sm text-gray-400">
                      {tarea.clientes
                        ? `${tarea.clientes.nombre} ${tarea.clientes.apellido}`
                        : '\u2014'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${prioridadColor(tarea.prioridad)}`}>
                        {tarea.prioridad}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={overdue ? 'text-red-400 font-medium' : ''}>
                        {formatDate(tarea.fecha_limite)}
                      </span>
                    </td>
                    <td className="table-cell">
                      {canDeleteTarea(tarea) ? (
                        <button
                          onClick={() => handleDelete(tarea.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors text-xs"
                        >
                          &#x2715;
                        </button>
                      ) : <span />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare size={24} className="text-purple-400" />
          <h1 className="text-2xl font-bold text-white">Tareas</h1>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Nueva Tarea
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {(['todos', ...equipos] as const).map((eq) => (
          <button
            key={eq}
            onClick={() => setFiltroEquipo(eq)}
            className={`badge cursor-pointer transition-colors ${
              filtroEquipo === eq
                ? 'bg-blue-600 text-white'
                : 'bg-[#1C2333] text-gray-400 hover:bg-[#2A3142]'
            }`}
          >
            {eq === 'todos' ? 'Todos' : equipoLabels[eq as Equipo]}
            <span className="ml-1.5 text-xs opacity-70">
              {eq === 'todos'
                ? tareasActivas.length
                : tareasActivas.filter((t) => t.equipo === eq).length}
            </span>
          </button>
        ))}
        {userId && (
          <button
            onClick={() => setSoloMias((v) => !v)}
            className={`badge cursor-pointer transition-colors ${
              soloMias
                ? 'bg-purple-600 text-white'
                : 'bg-[#1C2333] text-gray-400 hover:bg-[#2A3142]'
            }`}
          >
            Mis Tareas
            {miTareasCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-purple-500 text-white rounded-full">
                {miTareasCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por titulo, descripcion..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {/* Grouped by equipo */}
      <div className="space-y-6">
        {equipos.map((equipo) => renderEquipoSection(equipo))}
      </div>

      {/* Tareas Pasadas (completadas) */}
      {tareasCompletadas.length > 0 && (
        <div className="card border border-[#1F2937] overflow-hidden">
          <button
            onClick={() => setShowPasadas((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1C2333] transition-colors"
          >
            <div className="flex items-center gap-2">
              <History size={18} className="text-gray-400" />
              <h2 className="font-semibold text-gray-400">
                Tareas Pasadas
                <span className="ml-2 text-xs text-gray-500">({tareasCompletadas.length})</span>
              </h2>
            </div>
            {showPasadas ? (
              <ChevronDown size={18} className="text-gray-500" />
            ) : (
              <ChevronRight size={18} className="text-gray-500" />
            )}
          </button>
          {showPasadas && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1F2937]">
                  <th className="table-header w-10"></th>
                  <th className="table-header">Titulo</th>
                  <th className="table-header">Equipo</th>
                  <th className="table-header">Asignado</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header">Prioridad</th>
                  <th className="table-header w-10"></th>
                </tr>
              </thead>
              <tbody>
                {tareasCompletadas.map((tarea) => (
                  <tr
                    key={tarea.id}
                    className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/50 transition-colors opacity-60"
                  >
                    <td className="table-cell">
                      <button
                        onClick={() => handleToggle(tarea)}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Restaurar tarea"
                      >
                        <CheckSquare size={18} className="text-emerald-400" />
                      </button>
                    </td>
                    <td className="table-cell">
                      <span className="line-through text-gray-500">{tarea.titulo}</span>
                      {tarea.descripcion && (
                        <p className="text-xs text-gray-600 truncate max-w-xs mt-0.5">
                          {tarea.descripcion}
                        </p>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs ${equipoColors[tarea.equipo]?.header ?? 'text-gray-500'}`}>
                        {equipoLabels[tarea.equipo] ?? tarea.equipo}
                      </span>
                    </td>
                    <td className="table-cell text-sm text-gray-500">
                      {tarea.profiles
                        ? `${tarea.profiles.nombre} ${tarea.profiles.apellido}`
                        : '\u2014'}
                    </td>
                    <td className="table-cell text-sm text-gray-500">
                      {tarea.clientes
                        ? `${tarea.clientes.nombre} ${tarea.clientes.apellido}`
                        : '\u2014'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${prioridadColor(tarea.prioridad)}`}>
                        {tarea.prioridad}
                      </span>
                    </td>
                    <td className="table-cell">
                      {canDeleteTarea(tarea) ? (
                        <button
                          onClick={() => handleDelete(tarea.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors text-xs"
                        >
                          &#x2715;
                        </button>
                      ) : <span />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="modal-content max-w-lg w-full bg-[#111827] border border-[#1F2937] rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Editar Tarea' : 'Nueva Tarea'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded hover:bg-[#2A3142] text-gray-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Titulo *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="input"
                  placeholder="Titulo de la tarea"
                />
              </div>
              <div>
                <label className="label">Descripcion</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Descripcion opcional..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Equipo</label>
                  <select
                    value={form.equipo}
                    onChange={(e) =>
                      setForm({ ...form, equipo: e.target.value as Equipo, asignado_a: '' })
                    }
                    className="input"
                  >
                    <option value="soporte">Soporte</option>
                    <option value="financiero">Financiero</option>
                    <option value="administrativo">Administrativo</option>
                  </select>
                </div>
                <div>
                  <label className="label">Asignado a</label>
                  <select
                    value={form.asignado_a}
                    onChange={(e) => setForm({ ...form, asignado_a: e.target.value })}
                    className="input"
                  >
                    <option value="">Sin asignar</option>
                    {miembrosFiltrados.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} {m.apellido}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Prioridad</label>
                  <select
                    value={form.prioridad}
                    onChange={(e) =>
                      setForm({ ...form, prioridad: e.target.value as Prioridad })
                    }
                    className="input"
                  >
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="label">Fecha Limite</label>
                  <input
                    type="date"
                    value={form.fecha_limite}
                    onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              {/* Cliente relacionado (opcional) */}
              <div>
                <label className="label">Cliente relacionado <span className="text-gray-600">(opcional)</span></label>
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  className="input"
                >
                  <option value="">— Sin cliente relacionado —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#1F2937]">
              <button onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={loading} className="btn-primary">
                {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
