'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cliente, EstadoCliente } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate, estadoClienteColor } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, Eye, X, Users } from 'lucide-react';

const ESTADOS: EstadoCliente[] = ['activo', 'inactivo', 'nuevo', 'becado', 'suspendido'];

const emptyForm: Omit<Cliente, 'id' | 'created_at' | 'updated_at'> = {
  nombre: '',
  apellido: '',
  cedula: null,
  telefono: null,
  email: null,
  direccion: null,
  localidad: null,
  plan: null,
  monto_mensual: 0,
  estado: 'nuevo',
  fecha_instalacion: null,
  nombre_red: null,
  password_router: null,
  password_antena: null,
  ip_asignada: null,
  ubicacion_gps: null,
  notas: null,
};

interface Props {
  clientes: Cliente[];
}

export default function ClientesClient({ clientes: initialClientes }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [clientes, setClientes] = useState<Cliente[]>(initialClientes);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<EstadoCliente | 'todos'>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'tecnico' | 'notas'>('general');

  // --- Filtering ---
  const filtered = clientes.filter((c) => {
    const matchEstado = estadoFilter === 'todos' || c.estado === estadoFilter;
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      c.nombre.toLowerCase().includes(term) ||
      c.apellido.toLowerCase().includes(term) ||
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
    setModalOpen(true);
  };

  const openEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setFormData({
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
      nombre_red: cliente.nombre_red,
      password_router: cliente.password_router,
      password_antena: cliente.password_antena,
      ip_asignada: cliente.ip_asignada,
      ubicacion_gps: cliente.ubicacion_gps,
      notas: cliente.notas,
    });
    setModalMode('edit');
    setActiveTab('general');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedCliente(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'monto_mensual' ? Number(value) : value || null,
    }));
  };

  // --- CRUD ---
  const handleSave = async () => {
    if (!formData.nombre.trim() || !formData.apellido.trim()) {
      toast.error('Nombre y apellido son obligatorios');
      return;
    }

    setLoading(true);
    try {
      if (modalMode === 'create') {
        const { data, error } = await supabase
          .from('clientes')
          .insert([formData])
          .select()
          .single();
        if (error) throw error;
        setClientes((prev) => [data, ...prev]);
        toast.success('Cliente creado exitosamente');
      } else if (selectedCliente) {
        const { data, error } = await supabase
          .from('clientes')
          .update(formData)
          .eq('id', selectedCliente.id)
          .select()
          .single();
        if (error) throw error;
        setClientes((prev) => prev.map((c) => (c.id === data.id ? data : c)));
        toast.success('Cliente actualizado exitosamente');
      }
      closeModal();
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(message);
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
      const { error } = await supabase.from('clientes').delete().eq('id', cliente.id);
      if (error) throw error;
      setClientes((prev) => prev.filter((c) => c.id !== cliente.id));
      toast.success('Cliente eliminado');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error(message);
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
                <th className="table-header">Plan</th>
                <th className="table-header">Monto</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Localidad</th>
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
                    <td className="table-cell text-gray-300">{cliente.plan ?? '—'}</td>
                    <td className="table-cell text-gray-300">
                      {formatCurrency(cliente.monto_mensual)}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${estadoClienteColor(cliente.estado)}`}>
                        {cliente.estado}
                      </span>
                    </td>
                    <td className="table-cell text-gray-300">{cliente.localidad ?? '—'}</td>
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
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content w-full max-w-2xl"
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
                  <input
                    name="localidad"
                    value={formData.localidad ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Localidad"
                  />
                </div>
                <div>
                  <label className="label">Plan</label>
                  <input
                    name="plan"
                    value={formData.plan ?? ''}
                    onChange={handleChange}
                    className="input w-full"
                    placeholder="Ej: 10 Mbps"
                  />
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
              </div>
            )}

            {/* Tab: Tecnico */}
            {activeTab === 'tecnico' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
