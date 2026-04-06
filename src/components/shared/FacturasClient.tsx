'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Factura, FacturaItem, EstadoFactura } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { formatCurrency, formatDate, estadoFacturaColor } from '@/lib/utils';
import { Plus, X, FileText, Trash2, PlusCircle } from 'lucide-react';

interface ClienteOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface Props {
  facturas: Factura[];
  clientes: ClienteOption[];
}

const ESTADOS: EstadoFactura[] = ['pendiente', 'pagada', 'vencida', 'cancelada'];

const emptyItem: FacturaItem = {
  descripcion: '',
  cantidad: 1,
  precio_unitario: 0,
  subtotal: 0,
};

const emptyForm = {
  numero: '',
  cliente_id: '',
  items: [{ ...emptyItem }] as FacturaItem[],
  descuento: 0,
  itbis: 18,
  estado: 'pendiente' as EstadoFactura,
  notas: '',
};

export default function FacturasClient({ facturas: initial, clientes }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [facturas, setFacturas] = useState<Factura[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  // Calculations
  const calcSubtotal = (items: FacturaItem[]) =>
    items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);

  const formSubtotal = calcSubtotal(formData.items);
  const formItbisAmount = formSubtotal * (formData.itbis / 100);
  const formTotal = formSubtotal - formData.descuento + formItbisAmount;

  // Stats
  const totalFacturas = facturas.length;
  const pendientes = facturas.filter((f) => f.estado === 'pendiente').length;
  const pagadas = facturas.filter((f) => f.estado === 'pagada').length;
  const totalFacturado = facturas.reduce((sum, f) => sum + f.total, 0);

  const openCreate = () => {
    setFormData({
      ...emptyForm,
      numero: `FAC-${String(facturas.length + 1).padStart(4, '0')}`,
      items: [{ ...emptyItem }],
    });
    setSelectedFactura(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = (factura: Factura) => {
    setSelectedFactura(factura);
    setFormData({
      numero: factura.numero,
      cliente_id: factura.cliente_id ?? '',
      items: factura.items.length > 0 ? factura.items : [{ ...emptyItem }],
      descuento: factura.descuento,
      itbis: factura.itbis,
      estado: factura.estado,
      notas: factura.notas ?? '',
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedFactura(null);
  };

  // Items management
  const addItem = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: keyof FacturaItem, value: string | number) => {
    setFormData((prev) => {
      const items = [...prev.items];
      const item = { ...items[index], [field]: value };
      item.subtotal = item.cantidad * item.precio_unitario;
      items[index] = item;
      return { ...prev, items };
    });
  };

  const handleSave = async () => {
    if (!formData.numero.trim()) {
      toast.error('El numero de factura es obligatorio');
      return;
    }

    setLoading(true);
    try {
      const items = formData.items.map((item) => ({
        ...item,
        subtotal: item.cantidad * item.precio_unitario,
      }));
      const subtotal = calcSubtotal(items);
      const itbisAmount = subtotal * (formData.itbis / 100);
      const total = subtotal - formData.descuento + itbisAmount;

      const payload = {
        numero: formData.numero,
        cliente_id: formData.cliente_id || null,
        items,
        subtotal,
        descuento: formData.descuento,
        itbis: formData.itbis,
        total,
        estado: formData.estado,
        notas: formData.notas || null,
      };

      if (modalMode === 'create') {
        const { data, error } = await supabase
          .from('facturas')
          .insert([payload])
          .select('*, clientes(nombre, apellido)')
          .single();
        if (error) throw error;
        setFacturas((prev) => [data, ...prev]);
        toast.success('Factura creada exitosamente');
      } else if (selectedFactura) {
        const { data, error } = await supabase
          .from('facturas')
          .update(payload)
          .eq('id', selectedFactura.id)
          .select('*, clientes(nombre, apellido)')
          .single();
        if (error) throw error;
        setFacturas((prev) => prev.map((f) => (f.id === data.id ? data : f)));
        toast.success('Factura actualizada exitosamente');
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

  const handleDelete = async (factura: Factura) => {
    if (!window.confirm(`¿Eliminar factura ${factura.numero}?`)) return;
    try {
      const { error } = await supabase.from('facturas').delete().eq('id', factura.id);
      if (error) throw error;
      setFacturas((prev) => prev.filter((f) => f.id !== factura.id));
      toast.success('Factura eliminada');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error(message);
    }
  };

  const handleEstadoChange = async (factura: Factura, estado: EstadoFactura) => {
    try {
      const { data, error } = await supabase
        .from('facturas')
        .update({ estado })
        .eq('id', factura.id)
        .select('*, clientes(nombre, apellido)')
        .single();
      if (error) throw error;
      setFacturas((prev) => prev.map((f) => (f.id === data.id ? data : f)));
      toast.success(`Estado cambiado a ${estado}`);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar estado';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Facturas</h1>
            <p className="text-sm text-gray-400">Gestion de facturacion</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Factura
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-400">Total Facturas</p>
          <p className="text-2xl font-bold text-gray-100">{totalFacturas}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-400">{pendientes}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Total Facturado</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalFacturado)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Pagadas</p>
          <p className="text-2xl font-bold text-emerald-400">{pagadas}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="table-header">Numero</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Subtotal</th>
                <th className="table-header">ITBIS</th>
                <th className="table-header">Descuento</th>
                <th className="table-header">Total</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Fecha</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facturas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center text-gray-500 py-12">
                    No hay facturas registradas
                  </td>
                </tr>
              ) : (
                facturas.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-[#1F2937] hover:bg-[#1C2333]/50 transition-colors"
                  >
                    <td className="table-cell font-medium text-gray-100">{f.numero}</td>
                    <td className="table-cell text-gray-300">
                      {f.clientes ? `${f.clientes.nombre} ${f.clientes.apellido}` : '—'}
                    </td>
                    <td className="table-cell text-gray-300">{formatCurrency(f.subtotal)}</td>
                    <td className="table-cell text-gray-300">{f.itbis}%</td>
                    <td className="table-cell text-gray-300">{formatCurrency(f.descuento)}</td>
                    <td className="table-cell font-semibold text-gray-100">
                      {formatCurrency(f.total)}
                    </td>
                    <td className="table-cell">
                      <select
                        value={f.estado}
                        onChange={(e) => handleEstadoChange(f, e.target.value as EstadoFactura)}
                        className={`badge cursor-pointer border-0 ${estadoFacturaColor(f.estado)}`}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e} className="bg-[#0F1629] text-gray-100">
                            {e.charAt(0).toUpperCase() + e.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell text-gray-300">{formatDate(f.created_at)}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(f)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(f)}
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
            className="modal-content w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-100">
                {modalMode === 'create' ? 'Nueva Factura' : 'Editar Factura'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Numero *</label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData((prev) => ({ ...prev, numero: e.target.value }))}
                    className="input w-full"
                    placeholder="FAC-0001"
                  />
                </div>
                <div>
                  <label className="label">Cliente</label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, cliente_id: e.target.value }))
                    }
                    className="input w-full"
                  >
                    <option value="">Sin cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.apellido}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label">Items</label>
                  <button
                    onClick={addItem}
                    className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Agregar linea
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        {idx === 0 && <label className="label text-xs">Descripcion</label>}
                        <input
                          type="text"
                          value={item.descripcion}
                          onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                          className="input w-full"
                          placeholder="Descripcion"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <label className="label text-xs">Cant.</label>}
                        <input
                          type="number"
                          value={item.cantidad}
                          onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))}
                          className="input w-full"
                          min={1}
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <label className="label text-xs">Precio</label>}
                        <input
                          type="number"
                          value={item.precio_unitario}
                          onChange={(e) =>
                            updateItem(idx, 'precio_unitario', Number(e.target.value))
                          }
                          className="input w-full"
                          min={0}
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <label className="label text-xs">Subtotal</label>}
                        <div className="input w-full bg-[#1C2333] text-gray-300 flex items-center">
                          {formatCurrency(item.cantidad * item.precio_unitario)}
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {formData.items.length > 1 && (
                          <button
                            onClick={() => removeItem(idx)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Descuento</label>
                  <input
                    type="number"
                    value={formData.descuento}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, descuento: Number(e.target.value) }))
                    }
                    className="input w-full"
                    min={0}
                  />
                </div>
                <div>
                  <label className="label">ITBIS (%)</label>
                  <input
                    type="number"
                    value={formData.itbis}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, itbis: Number(e.target.value) }))
                    }
                    className="input w-full"
                    min={0}
                  />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        estado: e.target.value as EstadoFactura,
                      }))
                    }
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

              {/* Summary */}
              <div className="bg-[#1C2333] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(formSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>ITBIS ({formData.itbis}%)</span>
                  <span>{formatCurrency(formItbisAmount)}</span>
                </div>
                {formData.descuento > 0 && (
                  <div className="flex justify-between text-sm text-red-400">
                    <span>Descuento</span>
                    <span>-{formatCurrency(formData.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-100 pt-2 border-t border-[#1F2937]">
                  <span>Total</span>
                  <span>{formatCurrency(formTotal)}</span>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="label">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
                  rows={2}
                  className="input w-full resize-none"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#1F2937]">
              <button onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={loading} className="btn-primary">
                {loading
                  ? 'Guardando...'
                  : modalMode === 'create'
                    ? 'Crear Factura'
                    : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
