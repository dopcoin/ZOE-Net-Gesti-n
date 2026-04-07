'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createInstalacion, updateInstalacion, deleteInstalacion, getErrorMessage } from '@/lib/services';
import { formatDate, estadoInstalacionColor, prioridadColor } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, X, Wrench } from 'lucide-react';
import type { EstadoInstalacion, Prioridad } from '@/types';

interface Instalacion {
  id: string;
  cliente_id: string;
  tipo: string;
  direccion: string;
  prioridad: Prioridad;
  estado: EstadoInstalacion;
  fecha_programada: string | null;
  notas: string | null;
  tecnico_asignado: string | null;
  created_at: string;
  clientes?: { nombre: string; apellido: string };
}

interface ClienteOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface Props {
  instalaciones: Instalacion[];
  clientes: ClienteOption[];
}

const estadoLabels: Record<EstadoInstalacion, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En Progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const defaultForm = {
  cliente_id: '',
  tipo: 'nueva' as string,
  direccion: '',
  prioridad: 'normal' as Prioridad,
  estado: 'pendiente' as EstadoInstalacion,
  fecha_programada: new Date().toISOString().split('T')[0],
  notas: '',
  tecnico_asignado: '',
};

export default function InstalacionesClient({ instalaciones: initial, clientes }: Props) {
  const router = useRouter();
  const [instalaciones, setInstalaciones] = useState(initial);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoInstalacion | 'todos'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Instalacion | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  const counts = {
    todos: instalaciones.length,
    pendiente: instalaciones.filter((i) => i.estado === 'pendiente').length,
    en_progreso: instalaciones.filter((i) => i.estado === 'en_progreso').length,
    completada: instalaciones.filter((i) => i.estado === 'completada').length,
    cancelada: instalaciones.filter((i) => i.estado === 'cancelada').length,
  };

  const filtered = instalaciones.filter((i) => {
    const matchEstado = filtroEstado === 'todos' || i.estado === filtroEstado;
    const matchSearch =
      search === '' ||
      i.clientes?.nombre.toLowerCase().includes(search.toLowerCase()) ||
      i.clientes?.apellido.toLowerCase().includes(search.toLowerCase()) ||
      i.direccion.toLowerCase().includes(search.toLowerCase()) ||
      (i.tecnico_asignado ?? '').toLowerCase().includes(search.toLowerCase());
    return matchEstado && matchSearch;
  });

  function closeModal() {
    setShowModal(false);
  }

  // Escape key handler and body overflow cleanup
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showModal]);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  }

  function openEdit(inst: Instalacion) {
    setEditing(inst);
    setForm({
      cliente_id: inst.cliente_id,
      tipo: inst.tipo,
      direccion: inst.direccion,
      prioridad: inst.prioridad,
      estado: inst.estado,
      fecha_programada: inst.fecha_programada ?? '',
      notas: inst.notas ?? '',
      tecnico_asignado: inst.tecnico_asignado ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.cliente_id || !form.direccion) {
      toast.error('Cliente y direccion son requeridos');
      return;
    }
    setLoading(true);
    const payload = {
      cliente_id: form.cliente_id,
      tipo: form.tipo,
      direccion: form.direccion,
      prioridad: form.prioridad,
      estado: form.estado,
      fecha_programada: form.fecha_programada || null,
      notas: form.notas || null,
      tecnico_asignado: form.tecnico_asignado || null,
    };

    if (editing) {
      const result = await updateInstalacion(editing.id, payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      toast.success('Instalacion actualizada');
    } else {
      const result = await createInstalacion(payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      toast.success('Instalacion creada');
    }
    setShowModal(false);
    router.refresh();
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta instalacion?')) return;
    const result = await deleteInstalacion(id);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    toast.success('Instalacion eliminada');
    setInstalaciones((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench size={24} className="text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Instalaciones</h1>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Nueva Instalacion
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {(['todos', 'pendiente', 'en_progreso', 'completada', 'cancelada'] as const).map((est) => (
          <button
            key={est}
            onClick={() => setFiltroEstado(est)}
            className={`badge cursor-pointer transition-colors ${
              filtroEstado === est
                ? 'bg-blue-600 text-white'
                : 'bg-[#1C2333] text-gray-400 hover:bg-[#2A3142]'
            }`}
          >
            {est === 'todos' ? 'Todos' : estadoLabels[est]}
            <span className="ml-1.5 text-xs opacity-70">{counts[est]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por cliente, direccion, tecnico..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1F2937]">
              <th className="table-header">Cliente</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">Direccion</th>
              <th className="table-header">Prioridad</th>
              <th className="table-header">Estado</th>
              <th className="table-header">Fecha</th>
              <th className="table-header">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-cell text-center text-gray-500 py-8">
                  No se encontraron instalaciones
                </td>
              </tr>
            ) : (
              filtered.map((inst) => (
                <tr key={inst.id} className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/50 transition-colors">
                  <td className="table-cell font-medium text-white">
                    {inst.clientes ? `${inst.clientes.nombre} ${inst.clientes.apellido}` : '—'}
                  </td>
                  <td className="table-cell capitalize">{inst.tipo}</td>
                  <td className="table-cell">{inst.direccion}</td>
                  <td className="table-cell">
                    <span className={`badge ${prioridadColor(inst.prioridad)}`}>{inst.prioridad}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${estadoInstalacionColor(inst.estado)}`}>
                      {estadoLabels[inst.estado]}
                    </span>
                  </td>
                  <td className="table-cell">{formatDate(inst.fecha_programada)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(inst)} className="p-1.5 rounded hover:bg-[#2A3142] text-gray-400 hover:text-white transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(inst.id)} className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Editar Instalacion' : 'Nueva Instalacion'}
              </h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-[#2A3142] text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Cliente *</label>
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  className="input"
                >
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.apellido}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input">
                    <option value="nueva">Nueva</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="actualizacion">Actualización</option>
                    <option value="desconexion">Desconexión</option>
                    <option value="revision">Revisión</option>
                  </select>
                </div>
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
              </div>
              <div>
                <label className="label">Direccion *</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="input"
                  placeholder="Direccion de la instalacion"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoInstalacion })}
                    className="input"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="label">Fecha Programada</label>
                  <input
                    type="date"
                    value={form.fecha_programada}
                    onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Tecnico Asignado</label>
                <input
                  type="text"
                  value={form.tecnico_asignado}
                  onChange={(e) => setForm({ ...form, tecnico_asignado: e.target.value })}
                  className="input"
                  placeholder="Nombre del tecnico"
                />
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Notas adicionales..."
                />
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
