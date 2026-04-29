'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Cliente, EstadoCliente } from '@/types';
import { createCliente, updateCliente, deleteCliente, getErrorMessage } from '@/lib/services';
import { formatCurrency, formatDate, estadoClienteColor } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, Eye, X, Users } from 'lucide-react';

const ESTADOS: EstadoCliente[] = ['activo', 'inactivo', 'nuevo', 'becado', 'suspendido'];

// Only DB-valid columns (excluding id, created_at, updated_at which are auto-managed)
const emptyForm = {
  beca: false,
  beca_descripcion: null as string | null,
  nombre: '',
  apellido: '',
  cedula: null as string | null,
  telefono: null as string | null,
  email: null as string | null,
  direccion: null as string | null,
  localidad: null as string | null,
  plan: null as string | null,
  monto_mensual: 0,
  estado: 'nuevo' as EstadoCliente,
  fecha_instalacion: null as string | null,
  inscripcion: null as string | null,
  nombre_red: null as string | null,
  password_router: null as string | null,
  password_antena: null as string | null,
  ip_asignada: null as string | null,
  ip: null as string | null,
  ubicacion_gps: null as string | null,
  ubicacion: null as string | null,
  coordenadas: null as string | null,
  notas: null as string | null,
  tipo_pago: null as string | null,
  tecnico_asignado: null as string | null,
  contrato_numero: null as string | null,
  dias_gracia: null as number | null,
};

type FormData = typeof emptyForm;

const DEFAULT_MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque'];

interface Props {
  clientes: Cliente[];
  ubicaciones: string[];
  mediosPago: string[];
}

export default function ClientesClient({ clientes: initialClientes, ubicaciones: initialUbicaciones, mediosPago: initialMediosPago }: Props) {
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>(initialClientes);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<EstadoCliente | 'todos'>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'tecnico' | 'notas'>('general');
  const [showNewUbicacion, setShowNewUbicacion] = useState(false);
  const [newUbicacion, setNewUbicacion] = useState('');
  const [showNewMedioPago, setShowNewMedioPago] = useState(false);
  const [newMedioPago, setNewMedioPago] = useState('');

  // Merge server ubicaciones with any new localidades from local clientes state
  const allUbicaciones = useMemo(() => {
    const fromClientes = clientes.map((c) => c.localidad).filter((l): l is string => !!l && l !== 'Sin localidad');
    return Array.from(new Set([...initialUbicaciones, ...fromClientes])).sort();
  }, [clientes, initialUbicaciones]);

  // Merge default + server + local medios de pago
  const allMediosPago = useMemo(() => {
    const fromClientes = clientes
      .map((c) => (c as unknown as Record<string, unknown>).tipo_pago as string | null)
      .filter((v): v is string => !!v);
    return Array.from(new Set([...DEFAULT_MEDIOS_PAGO, ...initialMediosPago, ...fromClientes])).sort();
  }, [clientes, initialMediosPago]);

  // --- Modal UX: Escape key + body overflow ---
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedCliente(null);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [modalOpen, closeModal]);

  // --- Filtering ---
  const filtered = clientes.filter((c) => {
    const matchEstado = estadoFilter === 'todos' || c.estado === estadoFilter;
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      (c.nombre || '').toLowerCase().includes(term) ||
      (c.apellido || '').toLowerCase().includes(term) ||
      (c.cedula && c.cedula.toLowerCase().includes(term));
    return matchEstado && matchSearch;
  });

  const countByEstado = (estado: EstadoCliente | 'todos') =>
    estado === 'todos' ? clientes.length : clientes.filter((c) => c.estado === estado).length;

  // --- Form helpers ---
  const openCreate = () => {
    setFormData(emptyForm);
    setSelectedCliente(null);
    setModalMode('create');
    setActiveTab('general');
    setShowNewUbicacion(false);
    setNewUbicacion('');
    setModalOpen(true);
  };

  const openEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setFormData({
      beca: cliente.beca ?? false,
      beca_descripcion: cliente.beca_descripcion ?? null,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      localidad: cliente.localidad,
      plan: cliente.plan,
      monto_mensual: cliente.monto_mensual,
      estado: cliente.estado,
      fecha_instalacion: cliente.fecha_instalacion,
      inscripcion: (cliente as unknown as Record<string, unknown>).inscripcion as string | null ?? null,
      nombre_red: cliente.nombre_red,
      password_router: cliente.password_router,
      password_antena: cliente.password_antena,
      ip_asignada: cliente.ip_asignada,
      ip: (cliente as unknown as Record<string, unknown>).ip as string | null ?? null,
      ubicacion_gps: cliente.ubicacion_gps,
      ubicacion: (cliente as unknown as Record<string, unknown>).ubicacion as string | null ?? null,
      coordenadas: (cliente as unknown as Record<string, unknown>).coordenadas as string | null ?? null,
      notas: cliente.notas,
      tipo_pago: (cliente as unknown as Record<string, unknown>).tipo_pago as string | null ?? null,
      tecnico_asignado: (cliente as unknown as Record<string, unknown>).tecnico_asignado as string | null ?? null,
      contrato_numero: (cliente as unknown as Record<string, unknown>).contrato_numero as string | null ?? null,
      dias_gracia: (cliente as unknown as Record<string, unknown>).dias_gracia as number | null ?? null,
    });
    setModalMode('edit');
    setActiveTab('general');
    setShowNewUbicacion(false);
    setNewUbicacion('');
    setModalOpen(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'monto_mensual' || name === 'dias_gracia'
          ? value === '' ? null : Number(value)
          : value || null,
    }));
  };

  // --- Build payload with only valid DB columns (strip nulls and special types) ---
  const buildPayload = (): Record<string, unknown> => {
    const raw: Record<string, unknown> = {
      beca: formData.beca,
      beca_descripcion: formData.beca_descripcion,
      nombre: formData.nombre,
      apellido: formData.apellido || '',
      cedula: formData.cedula,
      telefono: formData.telefono,
      email: formData.email,
      direccion: formData.direccion,
      localidad: formData.localidad || 'Sin localidad',
      plan: formData.plan,
      monto_mensual: formData.monto_mensual || 0,
      estado: formData.estado || 'activo',
      fecha_instalacion: formData.fecha_instalacion,
      nombre_red: formData.nombre_red,
      password_router: formData.password_router,
      password_antena: formData.password_antena,
      ip_asignada: formData.ip_asignada,
      ubicacion_gps: formData.ubicacion_gps,
      notas: formData.notas,
      tipo_pago: formData.tipo_pago,
      contrato_numero: formData.contrato_numero,
    };
    // Clean: remove null/undefined values except required fields
    const payload: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (val !== null && val !== undefined && val !== '') {
        payload[key] = val;
      }
    }
    // Always include required fields
    payload.nombre = raw.nombre;
    payload.localidad = raw.localidad;
    payload.estado = raw.estado;
    payload.monto_mensual = raw.monto_mensual;
    payload.beca = formData.beca; // boolean — must always be included even if false
    return payload;
  };

  // --- CRUD ---
  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setLoading(true);
    try {
      const payload = buildPayload();

      if (modalMode === 'create') {
        const result = await createCliente(payload);
        if (result.error) {
          toast.error(getErrorMessage(result.error));
          return;
        }
        toast.success('Cliente creado exitosamente');
      } else if (selectedCliente) {
        const result = await updateCliente(selectedCliente.id, payload);
        if (result.error) {
          toast.error(getErrorMessage(result.error));
          return;
        }
        toast.success('Cliente actualizado exitosamente');
      }
      closeModal();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cliente: Cliente) => {
    const confirmed = window.confirm(
      `¿Eliminar a ${cliente.nombre} ${cliente.apellido}? Esta accion no se puede deshacer.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await deleteCliente(cliente.id);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        return;
      }
      setClientes((prev) => prev.filter((c) => c.id !== cliente.id));
      toast.success('Cliente eliminado');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Clientes</h1>
            <p className="text-sm text-gray-400">{clientes.length} clientes registrados</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o cedula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>

        {/* Estado pills */}
        <div className="flex flex-wrap gap-2">
          {(['todos', ...ESTADOS] as const).map((estado) => (
            <button
              key={estado}
              onClick={() => setEstadoFilter(estado)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                estadoFilter === estado
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1C2333] text-gray-400 hover:text-gray-200'
              }`}
            >
              {estado.charAt(0).toUpperCase() + estado.slice(1)}{' '}
              <span className="ml-1 text-xs opacity-70">({countByEstado(estado)})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="table-header">Nombre</th>
                <th className="table-header">Medio de Pago</th>
                <th className="table-header">Monto</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Localidad</th>
                <th className="table-header">F. Inicio</th>
                <th className="table-header">Telefono</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-gray-500 py-12">
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                filtered.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="border-b border-[#1F2937] hover:bg-[#1C2333]/50 transition-colors"
                  >
                    <td className="table-cell font-medium text-gray-100">
                      {cliente.nombre} {cliente.apellido}
                    </td>
                    <td className="table-cell text-gray-300">
                      {(cliente as unknown as Record<string, unknown>).tipo_pago as string ?? '—'}
                    </td>
                    <td className="table-cell text-gray-300">
                      {formatCurrency(cliente.monto_mensual)}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${estadoClienteColor(cliente.estado)}`}>
                        {cliente.estado}
                      </span>
                    </td>
                    <td className="table-cell text-gray-300">{cliente.localidad ?? '—'}</td>
                    <td className="table-cell text-gray-300">
                      {cliente.fecha_instalacion ? formatDate(cliente.fecha_instalacion) : '—'}
                    </td>
                    <td className="table-cell text-gray-300">{cliente.telefono ?? '—'}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(cliente)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="modal-content w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-100">
                {modalMode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-[#1F2937]">
              {(['general', 'tecnico', 'notas'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab: General */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre *</label>
                  <input
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="label">Apellido *</label>
                  <input
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Apellido"
                  />
                </div>
                <div>
                  <label className="label">Cedula</label>
                  <input
                    name="cedula"
                    value={formData.cedula ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="000-0000000-0"
                  />
                </div>
                <div>
                  <label className="label">Telefono</label>
                  <input
                    name="telefono"
                    value={formData.telefono ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="809-000-0000"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="label">Direccion</label>
                  <input
                    name="direccion"
                    value={formData.direccion ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Direccion"
                  />
                </div>
                <div>
                  <label className="label">Localidad</label>
                  {showNewUbicacion ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newUbicacion}
                        onChange={(e) => setNewUbicacion(e.target.value)}
                        className="input w-full"
                        placeholder="Nueva ubicación..."
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newUbicacion.trim()) {
                            setFormData((prev) => ({ ...prev, localidad: newUbicacion.trim() }));
                          }
                          setShowNewUbicacion(false);
                          setNewUbicacion('');
                        }}
                        className="btn-primary text-xs px-3 whitespace-nowrap"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewUbicacion(false); setNewUbicacion(''); }}
                        className="btn-secondary text-xs px-3"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        name="localidad"
                        value={formData.localidad ?? ''}
                        onChange={handleChange}
                        className="input w-full"
                      >
                        <option value="">— Sin localidad —</option>
                        {allUbicaciones.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewUbicacion(true)}
                        className="btn-secondary text-xs px-3 whitespace-nowrap flex items-center gap-1"
                        title="Registrar nueva ubicación"
                      >
                        <Plus className="h-3 w-3" />
                        Nueva
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Medio de Pago</label>
                  {showNewMedioPago ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMedioPago}
                        onChange={(e) => setNewMedioPago(e.target.value)}
                        className="input w-full"
                        placeholder="Nuevo medio de pago..."
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newMedioPago.trim()) {
                            setFormData((prev) => ({ ...prev, tipo_pago: newMedioPago.trim() }));
                          }
                          setShowNewMedioPago(false);
                          setNewMedioPago('');
                        }}
                        className="btn-primary text-xs px-3 whitespace-nowrap"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewMedioPago(false); setNewMedioPago(''); }}
                        className="btn-secondary text-xs px-3"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        name="tipo_pago"
                        value={formData.tipo_pago ?? ''}
                        onChange={handleChange}
                        className="input w-full"
                      >
                        <option value="">— Sin medio de pago —</option>
                        {allMediosPago.map((mp) => (
                          <option key={mp} value={mp}>{mp}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNewMedioPago(true)}
                        className="btn-secondary text-xs px-3 whitespace-nowrap flex items-center gap-1"
                        title="Agregar nuevo medio de pago"
                      >
                        <Plus className="h-3 w-3" />
                        Nuevo
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Monto Mensual</label>
                  <input
                    name="monto_mensual"
                    type="number"
                    value={formData.monto_mensual}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    className="input w-full"
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e.charAt(0).toUpperCase() + e.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha de Inicio</label>
                  <input
                    name="fecha_instalacion"
                    type="date"
                    value={formData.fecha_instalacion ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                  />
                </div>
                {/* Beca toggle - full width */}
                <div className="md:col-span-2 border-t border-[#1F2937] pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-200">Cliente Becado</span>
                      <p className="text-xs text-gray-500">No paga o paga tarifa reducida</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, beca: !prev.beca }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        formData.beca ? 'bg-purple-600' : 'bg-[#1C2333] border border-[#1F2937]'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        formData.beca ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {formData.beca && (
                    <input
                      name="beca_descripcion"
                      value={formData.beca_descripcion ?? ''}
                      onChange={handleChange}
                      className="input w-full mt-2"
                      placeholder="Motivo de la beca (opcional)"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Tab: Tecnico */}
            {activeTab === 'tecnico' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Plan de Servicio</label>
                  <input
                    name="plan"
                    value={formData.plan ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Ej: 10 Mbps"
                  />
                </div>
                <div>
                  <label className="label">Nombre de Red</label>
                  <input
                    name="nombre_red"
                    value={formData.nombre_red ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="SSID de la red"
                  />
                </div>
                <div>
                  <label className="label">Password Router</label>
                  <input
                    name="password_router"
                    value={formData.password_router ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Password del router"
                  />
                </div>
                <div>
                  <label className="label">Password Antena</label>
                  <input
                    name="password_antena"
                    value={formData.password_antena ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Password de la antena"
                  />
                </div>
                <div>
                  <label className="label">IP Asignada</label>
                  <input
                    name="ip_asignada"
                    value={formData.ip_asignada ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="192.168.1.x"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Ubicacion GPS</label>
                  <input
                    name="ubicacion_gps"
                    value={formData.ubicacion_gps ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Lat, Lng"
                  />
                </div>
              </div>
            )}

            {/* Tab: Notas */}
            {activeTab === 'notas' && (
              <div>
                <label className="label">Notas</label>
                <textarea
                  name="notas"
                  value={formData.notas ?? ''}
                  onChange={handleChange}
                  rows={8}
                  className="input w-full resize-none"
                  placeholder="Notas adicionales sobre el cliente..."
                />
              </div>
            )}

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#1F2937]">
              <button onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={loading} className="btn-primary">
                {loading ? 'Guardando...' : modalMode === 'create' ? 'Crear Cliente' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
