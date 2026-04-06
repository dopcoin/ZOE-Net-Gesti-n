'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate, prioridadColor } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, X, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import type { Tarea, Equipo, Prioridad } from '@/types';

interface MiembroOption {
  id: string;
  nombre: string;
  apellido: string;
  equipo: Equipo | null;
}

interface Props {
  tareas: Tarea[];
  miembros: MiembroOption[];
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
};

function isOverdue(fecha_limite: string | null, completada: boolean): boolean {
  if (!fecha_limite || completada) return false;
  return new Date(fecha_limite) < new Date(new Date().toDateString());
}

export default function TareasClient({ tareas: initial, miembros }: Props) {
  const router = useRouter();
  const [tareas, setTareas] = useState(initial);
  const [search, setSearch] = useState('');
  const [filtroEquipo, setFiltroEquipo] = useState<Equipo | 'todos'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Tarea | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  const equipos: Equipo[] = ['soporte', 'financiero', 'administrativo'];

  const filtered = tareas.filter((t) => {
    const matchEquipo = filtroEquipo === 'todos' || t.equipo === filtroEquipo;
    const matchSearch =
      search === '' ||
      t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (t.descripcion ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.profiles?.nombre ?? '').toLowerCase().includes(search.toLowerCase());
    return matchEquipo && matchSearch;
  });

  const miembrosFiltrados = miembros.filter((m) => m.equipo === form.equipo);

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
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.titulo.trim()) {
      toast.error('El título es requerido');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const payload = {
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      equipo: form.equipo,
      asignado_a: form.asignado_a || null,
      prioridad: form.prioridad,
      fecha_limite: form.fecha_limite || null,
    };

    if (editing) {
      const { error } = await supabase.from('tareas').update(payload).eq('id', editing.id);
      if (error) {
        toast.error('Error al actualizar: ' + error.message);
      } else {
        toast.success('Tarea actualizada');
        setShowModal(false);
        router.refresh();
      }
    } else {
      const { error } = await supabase.from('tareas').insert({ ...payload, completada: false });
      if (error) {
        toast.error('Error al crear: ' + error.message);
      } else {
        toast.success('Tarea creada');
        setShowModal(false);
        router.refresh();
      }
    }
    setLoading(false);
  }

  async function handleToggle(tarea: Tarea) {
    const supabase = createClient();
    const { error } = await supabase
      .from('tareas')
      .update({ completada: !tarea.completada })
      .eq('id', tarea.id);
    if (error) {
      toast.error('Error al actualizar: ' + error.message);
    } else {
      setTareas((prev) =>
        prev.map((t) => (t.id === tarea.id ? { ...t, completada: !t.completada } : t))
      );
      toast.success(tarea.completada ? 'Tarea marcada como pendiente' : 'Tarea completada');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('tareas').delete().eq('id', id);
    if (error) {
      toast.error('Error al eliminar: ' + error.message);
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
                <th className="table-header">Título</th>
                <th className="table-header">Asignado</th>
                <th className="table-header">Prioridad</th>
                <th className="table-header">Fecha Límite</th>
                <th className="table-header w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tareasEquipo.map((tarea) => {
                const overdue = isOverdue(tarea.fecha_limite, tarea.completada);
                return (
                  <tr
                    key={tarea.id}
                    className={`border-b border-[#1F2937]/50 hover:bg-[#1C2333]/50 transition-colors ${
                      tarea.completada ? 'opacity-60' : ''
                    }`}
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
                        : '—'}
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
                      <button
                        onClick={() => handleDelete(tarea.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors text-xs"
                      >
                        ✕
                      </button>
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
                ? tareas.length
                : tareas.filter((t) => t.equipo === eq).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por título, descripción, asignado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {/* Grouped by equipo */}
      <div className="space-y-6">
        {equipos.map((equipo) => renderEquipoSection(equipo))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Editar Tarea' : 'Nueva Tarea'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-[#2A3142] text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="input"
                  placeholder="Título de la tarea"
                />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Descripción opcional..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Equipo</label>
                  <select
                    value={form.equipo}
                    onChange={(e) => setForm({ ...form, equipo: e.target.value as Equipo, asignado_a: '' })}
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
                    onChange={(e) => setForm({ ...form, prioridad: e.target.value as Prioridad })}
                    className="input"
                  >
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="label">Fecha Límite</label>
                  <input
                    type="date"
                    value={form.fecha_limite}
                    onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#1F2937]">
              <button onClick={() => setShowModal(false)} className="btn-secondary">
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
