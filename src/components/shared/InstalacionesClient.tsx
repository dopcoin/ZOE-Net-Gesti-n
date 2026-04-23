'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { createInstalacion, updateInstalacion, deleteInstalacion, getErrorMessage } from '@/lib/services';
import { formatDate, estadoInstalacionColor, prioridadColor, meses } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, X, Wrench, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { EstadoInstalacion, Prioridad } from '@/types';

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Depósito', 'Otro'];

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
  costo?: number;
  estado_cobro?: string;
  descripcion_cobro?: string;
  metodo_pago?: string | null;
  recibido_en?: string | null;
  created_at: string;
  clientes?: { nombre: string; apellido: string };
}

interface ClienteOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface TecnicoOption {
  id: string;
  nombre: string;
  apellido: string;
  equipo: string | null;
  rol: string;
}

interface Props {
  instalaciones: Instalacion[];
  clientes: ClienteOption[];
  tecnicos: TecnicoOption[];
  recibidosPor: string[];
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
  costo: 0,
  estado_cobro: 'sin_costo' as 'sin_costo' | 'pendiente' | 'pagado',
  descripcion_cobro: '',
  metodo_pago: '',
  recibido_en: '',
};

export default function InstalacionesClient({ instalaciones: initial, clientes, tecnicos, recibidosPor: initialRecibidosPor }: Props) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [instalaciones, setInstalaciones] = useState(initial);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoInstalacion | 'todos'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Instalacion | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  // Recibido por — creatable select
  const [localRecibidosPor, setLocalRecibidosPor] = useState<string[]>([]);
  const [showNewRecibidoEn, setShowNewRecibidoEn] = useState(false);
  const [newRecibidoEn, setNewRecibidoEn] = useState('');

  const allRecibidosPor = useMemo(() => {
    return Array.from(new Set([...initialRecibidosPor, ...localRecibidosPor])).sort();
  }, [initialRecibidosPor, localRecibidosPor]);

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
    setShowNewRecibidoEn(false);
    setNewRecibidoEn('');
  }

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
    setShowNewRecibidoEn(false);
    setNewRecibidoEn('');
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
      costo: inst.costo ?? 0,
      estado_cobro: (inst.estado_cobro as 'sin_costo' | 'pendiente' | 'pagado') ?? 'sin_costo',
      descripcion_cobro: inst.descripcion_cobro ?? '',
      metodo_pago: inst.metodo_pago ?? '',
      recibido_en: inst.recibido_en ?? '',
    });
    setShowNewRecibidoEn(false);
    setNewRecibidoEn('');
    setShowModal(true);
  }

  async function eliminarDeLibroDiario(instalacionId: string) {
    const supabase = createClient();
    await supabase.from('libro_diario').delete().eq('origen_id', instalacionId).eq('origen_tipo', 'instalacion');
  }

  async function registrarEnLibroDiario(instalacionId: string, tipo: string, monto: number, clienteNombre: string) {
    const payload: Record<string, unknown> = {
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'ingreso',
      categoria: 'Instalaciones',
      descripcion: `Instalación — ${clienteNombre} (${tipo})`,
      monto,
      referencia: null,
      metodo_pago: form.metodo_pago || null,
      recibido_en: form.recibido_en || null,
      origen_id: instalacionId,
      origen_tipo: 'instalacion',
    };
    if (profile?.id) payload.registrado_por = profile.id;

    const supabase = createClient();
    const { error } = await supabase.from('libro_diario').insert(payload);
    if (error) {
      console.error('[LibroDiario] Error instalación:', error);
      toast.warning(`Instalación guardada. Error en Libro Diario: ${error.message}`);
    }
  }

  async function handleSave() {
    if (!form.cliente_id || !form.direccion) {
      toast.error('Cliente y dirección son requeridos');
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
      costo: form.costo || 0,
      estado_cobro: form.estado_cobro,
      descripcion_cobro: form.descripcion_cobro || null,
      metodo_pago: form.estado_cobro !== 'sin_costo' ? (form.metodo_pago || null) : null,
      recibido_en: form.estado_cobro !== 'sin_costo' ? (form.recibido_en || null) : null,
    };

    if (editing) {
      const result = await updateInstalacion(editing.id, payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      toast.success('Instalación actualizada');
      const eraYaPagado = editing.estado_cobro === 'pagado';
      if (form.estado_cobro === 'pagado' && !eraYaPagado && form.costo > 0) {
        // Transición a pagado → crear entrada
        const clienteObj = clientes.find((c) => c.id === form.cliente_id);
        const nombre = clienteObj ? `${clienteObj.nombre} ${clienteObj.apellido}` : 'Cliente';
        await registrarEnLibroDiario(editing.id, form.tipo, form.costo, nombre);
      } else if (form.estado_cobro !== 'pagado' && eraYaPagado) {
        // Revertido → eliminar entrada
        await eliminarDeLibroDiario(editing.id);
      }
    } else {
      const result = await createInstalacion(payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      toast.success('Instalación creada');
      if (form.estado_cobro === 'pagado' && form.costo > 0 && result.data?.id) {
        const clienteObj = clientes.find((c) => c.id === form.cliente_id);
        const nombre = clienteObj ? `${clienteObj.nombre} ${clienteObj.apellido}` : 'Cliente';
        await registrarEnLibroDiario(result.data.id, form.tipo, form.costo, nombre);
      }
    }
    setShowModal(false);
    router.refresh();
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta instalación?')) return;
    const result = await deleteInstalacion(id);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    await eliminarDeLibroDiario(id);
    toast.success('Instalación eliminada');
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
          Nueva Instalación
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
          placeholder="Buscar por cliente, dirección, técnico..."
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
              <th className="table-header">Dirección</th>
              <th className="table-header">Prioridad</th>
              <th className="table-header">Estado</th>
              <th className="table-header">Fecha</th>
              <th className="table-header">Cobro</th>
              <th className="table-header">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-cell text-center text-gray-500 py-8">
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
                    {!inst.estado_cobro || inst.estado_cobro === 'sin_costo' ? (
                      <span className="text-gray-600 text-xs">—</span>
                    ) : (
                      <div>
                        <div className="flex items-center gap-1">
                          <DollarSign size={12} className={inst.estado_cobro === 'pagado' ? 'text-emerald-400' : 'text-yellow-400'} />
                          <span className={`text-xs font-medium ${inst.estado_cobro === 'pagado' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                            {formatCurrency(inst.costo ?? 0)}
                          </span>
                          <span className={`badge text-xs ${inst.estado_cobro === 'pagado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {inst.estado_cobro === 'pagado' ? 'Pagado' : 'Pendiente'}
                          </span>
                        </div>
                        {inst.estado_cobro === 'pagado' && (inst.metodo_pago || inst.recibido_en) && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {inst.metodo_pago && (
                              <span className="badge bg-blue-500/15 text-blue-400 text-xs">{inst.metodo_pago}</span>
                            )}
                            {inst.recibido_en && (
                              <span className="text-xs text-gray-500">{inst.recibido_en}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
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
                {editing ? 'Editar Instalación' : 'Nueva Instalación'}
              </h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-[#2A3142] text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
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
                <label className="label">Dirección *</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="input"
                  placeholder="Dirección de la instalación"
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
                <label className="label">Técnico Asignado</label>
                <select
                  value={form.tecnico_asignado}
                  onChange={(e) => setForm({ ...form, tecnico_asignado: e.target.value })}
                  className="input"
                >
                  <option value="">— Sin asignar —</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={`${t.nombre} ${t.apellido}`}>
                      {t.nombre} {t.apellido}{t.equipo ? ` (${t.equipo})` : t.rol ? ` (${t.rol})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cobro */}
              <div className="border-t border-[#1F2937] pt-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Cobro de instalación</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Costo (DOP)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.costo}
                      onChange={(e) => setForm({ ...form, costo: parseFloat(e.target.value) || 0 })}
                      className="input"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">Estado del Cobro</label>
                    <select
                      value={form.estado_cobro}
                      onChange={(e) => setForm({ ...form, estado_cobro: e.target.value as 'sin_costo' | 'pendiente' | 'pagado' })}
                      className="input"
                    >
                      <option value="sin_costo">Sin costo</option>
                      <option value="pendiente">Pendiente de pago</option>
                      <option value="pagado">Pagado</option>
                    </select>
                  </div>
                </div>

                {form.estado_cobro !== 'sin_costo' && (
                  <div className="mt-3">
                    <label className="label">Descripción del cobro</label>
                    <input
                      type="text"
                      value={form.descripcion_cobro}
                      onChange={(e) => setForm({ ...form, descripcion_cobro: e.target.value })}
                      className="input"
                      placeholder="Ej: Instalación de fibra óptica..."
                    />
                  </div>
                )}

                {/* Método de pago + Recibido por — cuando hay cobro (pendiente o pagado) */}
                {form.estado_cobro !== 'sin_costo' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Método de pago <span className="text-gray-600">(opcional)</span></label>
                      <select
                        value={form.metodo_pago}
                        onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}
                        className="input"
                      >
                        <option value="">— Sin especificar —</option>
                        {METODOS_PAGO.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Recibido por <span className="text-gray-600">(opcional)</span></label>
                      {showNewRecibidoEn ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newRecibidoEn}
                            onChange={(e) => setNewRecibidoEn(e.target.value)}
                            className="input w-full"
                            placeholder="Ej: Oficina, Juan..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = newRecibidoEn.trim();
                                if (val) {
                                  setLocalRecibidosPor((p) => Array.from(new Set([...p, val])));
                                  setForm((f) => ({ ...f, recibido_en: val }));
                                }
                                setShowNewRecibidoEn(false);
                                setNewRecibidoEn('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = newRecibidoEn.trim();
                              if (val) {
                                setLocalRecibidosPor((p) => Array.from(new Set([...p, val])));
                                setForm((f) => ({ ...f, recibido_en: val }));
                              }
                              setShowNewRecibidoEn(false);
                              setNewRecibidoEn('');
                            }}
                            className="btn-primary text-xs px-2 whitespace-nowrap"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewRecibidoEn(false); setNewRecibidoEn(''); }}
                            className="btn-secondary text-xs px-2"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <select
                            value={form.recibido_en}
                            onChange={(e) => setForm({ ...form, recibido_en: e.target.value })}
                            className="input w-full"
                          >
                            <option value="">— Sin especificar —</option>
                            {allRecibidosPor.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowNewRecibidoEn(true)}
                            className="btn-secondary text-xs px-2 whitespace-nowrap flex items-center gap-1"
                            title="Agregar nuevo"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
