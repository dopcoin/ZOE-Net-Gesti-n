'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import type { Factura, FacturaItem, EstadoFactura } from '@/types';
import {
  createFactura,
  updateFactura,
  deleteFactura,
  getErrorMessage,
} from '@/lib/services';
import { formatCurrency, formatDate, estadoFacturaColor } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus, X, FileText, Trash2, PlusCircle, Search, Package,
  Calendar, Percent, Tag, AlertTriangle, Edit2,
} from 'lucide-react';

interface ClienteOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface MercanciaOption {
  id: string;
  nombre: string;
  precio_venta: number;
  stock: number;
}

interface Props {
  facturas: (Factura & { clientes?: { nombre: string; apellido: string } })[];
  clientes: ClienteOption[];
  mercancia: MercanciaOption[];
}

const ESTADOS: EstadoFactura[] = ['emitida', 'pendiente', 'pagada', 'vencida', 'anulada', 'cancelada'];
const ITBIS_DEFAULT = 18;

const emptyItem: FacturaItem = {
  descripcion: '',
  cantidad: 1,
  precio_unitario: 0,
  subtotal: 0,
  mercancia_id: null,
};

const todayISO = () => new Date().toISOString().split('T')[0];

const emptyForm = {
  numero: '',
  cliente_id: '',
  fecha: todayISO(),
  items: [{ ...emptyItem }] as FacturaItem[],
  descuento: 0,
  itbisAplicado: true,
  itbis: ITBIS_DEFAULT,
  estado: 'emitida' as EstadoFactura,
  notas: '',
};

export default function FacturasClient({ facturas: initial, clientes, mercancia }: Props) {
  const router = useRouter();
  const { profile } = useAuthStore();

  const [facturas, setFacturas] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Product picker
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [pickerTargetIdx, setPickerTargetIdx] = useState<number | null>(null);

  // ---------- Modal UX ----------
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedFactura(null);
    setProductPickerOpen(false);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (productPickerOpen) setProductPickerOpen(false);
        else closeModal();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [modalOpen, productPickerOpen, closeModal]);

  // ---------- Calculations ----------
  const calcSubtotal = (items: FacturaItem[]) =>
    items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);

  const formSubtotal = calcSubtotal(formData.items);
  const subtotalConDescuento = Math.max(0, formSubtotal - formData.descuento);
  const itbisRate = formData.itbisAplicado ? formData.itbis : 0;
  const formItbisAmount = subtotalConDescuento * (itbisRate / 100);
  const formTotal = subtotalConDescuento + formItbisAmount;

  // ---------- Stats ----------
  const totalFacturas = facturas.length;
  const pendientes = facturas.filter((f) => f.estado === 'pendiente').length;
  const pagadas = facturas.filter((f) => f.estado === 'pagada').length;
  const totalFacturado = facturas.reduce((sum, f) => sum + (f.total ?? 0), 0);

  // ---------- Search ----------
  const filtered = facturas.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const clienteName = f.clientes
      ? `${f.clientes.nombre} ${f.clientes.apellido}`.toLowerCase()
      : '';
    return f.numero.toLowerCase().includes(q) || clienteName.includes(q);
  });

  // ---------- Filtered products for picker ----------
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return mercancia;
    const q = productSearch.toLowerCase();
    return mercancia.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [mercancia, productSearch]);

  // ---------- Open / Close ----------
  const openCreate = () => {
    setFormData({
      ...emptyForm,
      numero: `FAC-${String(facturas.length + 1).padStart(4, '0')}`,
      fecha: todayISO(),
      items: [{ ...emptyItem }],
    });
    setSelectedFactura(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = (factura: Factura) => {
    let items: FacturaItem[];
    if (factura.items && Array.isArray(factura.items) && factura.items.length > 0) {
      items = factura.items;
    } else {
      const legacy = factura as Factura & {
        descripcion?: string;
        cantidad?: number;
        precio_unitario?: number;
      };
      items = [
        {
          descripcion: legacy.descripcion ?? '',
          cantidad: legacy.cantidad ?? 1,
          precio_unitario: legacy.precio_unitario ?? 0,
          subtotal: (legacy.cantidad ?? 1) * (legacy.precio_unitario ?? 0),
          mercancia_id: null,
        },
      ];
    }

    setSelectedFactura(factura);
    setFormData({
      numero: factura.numero,
      cliente_id: factura.cliente_id ?? '',
      fecha: factura.fecha ?? (factura.created_at ? factura.created_at.split('T')[0] : todayISO()),
      items,
      descuento: factura.descuento ?? 0,
      itbisAplicado: (factura.itbis ?? 0) > 0,
      itbis: (factura.itbis ?? 0) > 0 ? factura.itbis : ITBIS_DEFAULT,
      estado: factura.estado,
      notas: factura.notas ?? '',
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  // ---------- Items management ----------
  const addEmptyItem = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: keyof FacturaItem, value: string | number | null) => {
    setFormData((prev) => {
      const items = [...prev.items];
      const item = { ...items[index], [field]: value };
      item.subtotal = item.cantidad * item.precio_unitario;
      items[index] = item;
      return { ...prev, items };
    });
  };

  // ---------- Product picker ----------
  const openProductPicker = (targetIdx: number | null) => {
    setPickerTargetIdx(targetIdx);
    setProductSearch('');
    setProductPickerOpen(true);
  };

  const selectProduct = (p: MercanciaOption) => {
    const newItem: FacturaItem = {
      descripcion: p.nombre,
      cantidad: 1,
      precio_unitario: p.precio_venta,
      subtotal: p.precio_venta,
      mercancia_id: p.id,
    };

    setFormData((prev) => {
      let items: FacturaItem[];
      if (pickerTargetIdx !== null) {
        // Reemplazar item existente
        items = [...prev.items];
        items[pickerTargetIdx] = newItem;
      } else {
        // Agregar nuevo. Si la primera línea está vacía, reemplazarla.
        const first = prev.items[0];
        const firstIsEmpty = first && !first.descripcion && first.precio_unitario === 0 && !first.mercancia_id;
        if (prev.items.length === 1 && firstIsEmpty) {
          items = [newItem];
        } else {
          items = [...prev.items, newItem];
        }
      }
      return { ...prev, items };
    });
    setProductPickerOpen(false);
    setPickerTargetIdx(null);
  };

  const unlinkItem = (index: number) => {
    updateItem(index, 'mercancia_id', null);
  };

  // ---------- Stock management ----------
  const ajustarStock = async (items: FacturaItem[], operacion: 'descontar' | 'restaurar') => {
    const supabase = createClient();
    const itemsConMercancia = items.filter((i) => i.mercancia_id);
    if (itemsConMercancia.length === 0) return;

    for (const item of itemsConMercancia) {
      const { data: prod } = await supabase
        .from('mercancia')
        .select('stock')
        .eq('id', item.mercancia_id!)
        .single();
      if (!prod) continue;
      const delta = operacion === 'descontar' ? -item.cantidad : item.cantidad;
      const nuevoStock = Math.max(0, (prod.stock ?? 0) + delta);
      await supabase.from('mercancia').update({ stock: nuevoStock }).eq('id', item.mercancia_id!);
    }
  };

  // ---------- Libro Diario ----------
  const eliminarDeLibroDiario = async (facturaId: string) => {
    const supabase = createClient();
    await supabase.from('libro_diario').delete().eq('origen_id', facturaId).eq('origen_tipo', 'factura');
  };

  const registrarEnLibroDiario = async (
    numero: string,
    clienteNombre: string | null,
    total: number,
    facturaId: string,
    fecha: string,
  ) => {
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      fecha,
      tipo: 'ingreso',
      categoria: 'Facturas',
      descripcion: `Factura ${numero}${clienteNombre ? ` — ${clienteNombre}` : ''}`,
      monto: total,
      referencia: numero,
      origen_id: facturaId,
      origen_tipo: 'factura',
    };
    if (profile?.id) payload.registrado_por = profile.id;
    const { error } = await supabase.from('libro_diario').insert(payload);
    if (error) {
      console.error('[LibroDiario] Error factura:', error);
      toast.warning(`Factura guardada. Error en Libro Diario: ${error.message}`);
    }
  };

  // ---------- Save ----------
  const handleSave = async () => {
    if (!formData.numero.trim()) {
      toast.error('El número de factura es obligatorio');
      return;
    }
    if (formData.items.length === 0 || formData.items.every((i) => !i.descripcion.trim())) {
      toast.error('Agrega al menos un item con descripción');
      return;
    }

    // Validar stock para items vinculados a inventario en facturas pagadas
    if (formData.estado === 'pagada' && modalMode === 'create') {
      const sinStock = formData.items
        .filter((i) => i.mercancia_id)
        .map((i) => {
          const prod = mercancia.find((p) => p.id === i.mercancia_id);
          if (prod && prod.stock < i.cantidad) {
            return `${prod.nombre} (disp: ${prod.stock}, pedido: ${i.cantidad})`;
          }
          return null;
        })
        .filter(Boolean);
      if (sinStock.length > 0) {
        if (!confirm(`Stock insuficiente para:\n${sinStock.join('\n')}\n\n¿Continuar de todos modos?`)) {
          return;
        }
      }
    }

    setLoading(true);
    try {
      const items = formData.items
        .filter((i) => i.descripcion.trim() || i.mercancia_id)
        .map((item) => ({
          ...item,
          subtotal: item.cantidad * item.precio_unitario,
        }));
      const subtotal = calcSubtotal(items);
      const subDesc = Math.max(0, subtotal - formData.descuento);
      const itbisRateApplied = formData.itbisAplicado ? formData.itbis : 0;
      const itbisAmount = subDesc * (itbisRateApplied / 100);
      const total = subDesc + itbisAmount;

      const payload: Record<string, unknown> = {
        numero: formData.numero,
        cliente_id: formData.cliente_id || null,
        fecha: formData.fecha || todayISO(),
        items: JSON.parse(JSON.stringify(items)),
        subtotal,
        descuento: formData.descuento,
        itbis: itbisRateApplied,
        estado: formData.estado,
        notas: formData.notas || null,
        // Columnas legacy para 'total' generado: precio_unitario * cantidad
        descripcion: items[0]?.descripcion ?? 'Ver items adjuntos',
        cantidad: 1,
        precio_unitario: total,
      };

      if (modalMode === 'create') {
        const result = await createFactura(payload);
        if (result.error) {
          toast.error(getErrorMessage(result.error));
          return;
        }
        toast.success('Factura creada exitosamente');

        // Si pagada → descontar stock + registrar en libro diario
        if (formData.estado === 'pagada' && result.data?.id) {
          await ajustarStock(items, 'descontar');
          if (total > 0) {
            const cliente = clientes.find((c) => c.id === formData.cliente_id);
            const nombre = cliente ? `${cliente.nombre} ${cliente.apellido}` : null;
            await registrarEnLibroDiario(formData.numero, nombre, total, result.data.id, payload.fecha as string);
          }
        }
      } else if (selectedFactura) {
        const result = await updateFactura(selectedFactura.id, payload);
        if (result.error) {
          toast.error(getErrorMessage(result.error));
          return;
        }
        toast.success('Factura actualizada exitosamente');

        const eraYaPagada = selectedFactura.estado === 'pagada';
        if (formData.estado === 'pagada' && !eraYaPagada) {
          // Transición a pagada → descontar stock + libro diario
          await ajustarStock(items, 'descontar');
          if (total > 0) {
            const cliente = clientes.find((c) => c.id === formData.cliente_id);
            const nombre = cliente ? `${cliente.nombre} ${cliente.apellido}` : null;
            await registrarEnLibroDiario(formData.numero, nombre, total, selectedFactura.id, payload.fecha as string);
          }
        } else if (formData.estado !== 'pagada' && eraYaPagada) {
          // Reversión → restaurar stock + eliminar libro diario
          const itemsOriginales = (selectedFactura.items as FacturaItem[]) ?? items;
          await ajustarStock(itemsOriginales, 'restaurar');
          await eliminarDeLibroDiario(selectedFactura.id);
        }
      }

      closeModal();
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado al guardar';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Delete ----------
  const handleDelete = async (factura: Factura) => {
    if (!window.confirm(`¿Eliminar factura ${factura.numero}?\nSi estaba pagada, se restaurará el stock.`)) return;

    // Si estaba pagada, restaurar stock antes de eliminar
    if (factura.estado === 'pagada') {
      const items = (factura.items as FacturaItem[]) ?? [];
      await ajustarStock(items, 'restaurar');
    }

    const result = await deleteFactura(factura.id);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    await eliminarDeLibroDiario(factura.id);
    toast.success('Factura eliminada');
    router.refresh();
  };

  // ---------- Inline estado change ----------
  const handleEstadoChange = async (
    factura: Factura & { clientes?: { nombre: string; apellido: string } },
    estado: EstadoFactura,
  ) => {
    const result = await updateFactura(factura.id, { estado });
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    setFacturas((prev) => prev.map((f) => (f.id === factura.id ? { ...f, estado } : f)));
    toast.success(`Estado cambiado a ${estado}`);

    const items = (factura.items as FacturaItem[]) ?? [];
    if (estado === 'pagada' && factura.estado !== 'pagada') {
      await ajustarStock(items, 'descontar');
      if ((factura.total ?? 0) > 0) {
        const nombre = factura.clientes ? `${factura.clientes.nombre} ${factura.clientes.apellido}` : null;
        const fechaUsada = factura.fecha ?? (factura.created_at ? factura.created_at.split('T')[0] : todayISO());
        await registrarEnLibroDiario(factura.numero, nombre, factura.total ?? 0, factura.id, fechaUsada);
      }
    } else if (estado !== 'pagada' && factura.estado === 'pagada') {
      await ajustarStock(items, 'restaurar');
      await eliminarDeLibroDiario(factura.id);
    }
    router.refresh();
  };

  // ---------- Render ----------
  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="hidden sm:flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0">
            <FileText className="h-5 w-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-100">Facturas</h1>
            <p className="text-xs sm:text-sm text-gray-500">Gestión de facturación</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 ml-auto">
          <Plus className="h-4 w-4" />
          <span className="hidden xs:inline">Nueva Factura</span>
          <span className="inline xs:hidden">Nueva</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Facturas</p>
          <p className="text-2xl font-bold text-gray-100 font-mono tabular">{totalFacturas}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-400 font-mono tabular">{pendientes}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Facturado</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono tabular truncate">{formatCurrency(totalFacturado)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Pagadas</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono tabular">{pagadas}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número o cliente..."
          className="input w-full pl-10"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="table-header">Número</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Fecha</th>
                <th className="table-header text-right">Subtotal</th>
                <th className="table-header text-right">Desc.</th>
                <th className="table-header text-center">ITBIS</th>
                <th className="table-header text-right">Total</th>
                <th className="table-header">Estado</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center text-gray-500 py-12">
                    {search ? 'Sin resultados para la búsqueda' : 'No hay facturas registradas'}
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-[#1F2937] hover:bg-[#1C2333]/50 transition-colors"
                  >
                    <td className="table-cell font-medium text-gray-100">{f.numero}</td>
                    <td className="table-cell text-gray-300">
                      {f.clientes ? `${f.clientes.nombre} ${f.clientes.apellido}` : '—'}
                    </td>
                    <td className="table-cell text-gray-300">
                      {formatDate(f.fecha ?? f.created_at)}
                    </td>
                    <td className="table-cell text-right text-gray-300 font-mono tabular">
                      {formatCurrency(f.subtotal ?? 0)}
                    </td>
                    <td className="table-cell text-right text-gray-300 font-mono tabular">
                      {(f.descuento ?? 0) > 0 ? `−${formatCurrency(f.descuento)}` : '—'}
                    </td>
                    <td className="table-cell text-center">
                      {(f.itbis ?? 0) > 0 ? (
                        <span className="badge badge-info text-xs">{f.itbis}%</span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right font-semibold text-gray-100 font-mono tabular">
                      {formatCurrency(f.total ?? 0)}
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
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(f)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
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
            className="modal-content max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-handle" />

            <div className="sticky top-0 z-10 bg-surface border-b border-[#1F2937] px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-100">
                {modalMode === 'create' ? 'Nueva Factura' : 'Editar Factura'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Basic info — número + cliente + fecha */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">Número *</label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData((p) => ({ ...p, numero: e.target.value }))}
                    className="input w-full"
                    placeholder="FAC-0001"
                  />
                </div>
                <div>
                  <label className="label">Cliente</label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => setFormData((p) => ({ ...p, cliente_id: e.target.value }))}
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
                <div>
                  <label className="label flex items-center gap-1">
                    <Calendar size={12} />
                    Fecha de la factura
                  </label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData((p) => ({ ...p, fecha: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <label className="label mb-0">Items</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openProductPicker(null)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
                    >
                      <Package className="h-4 w-4" />
                      Desde inventario
                    </button>
                    <button
                      type="button"
                      onClick={addEmptyItem}
                      className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Línea libre
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, idx) => {
                    const isLinked = !!item.mercancia_id;
                    const linkedProduct = isLinked
                      ? mercancia.find((p) => p.id === item.mercancia_id)
                      : null;
                    const stockWarn =
                      linkedProduct && item.cantidad > linkedProduct.stock;

                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border p-2 sm:p-3 ${
                          isLinked
                            ? 'bg-blue-500/5 border-blue-500/20'
                            : 'bg-[#0F1725] border-[#1F2937]'
                        }`}
                      >
                        {/* Tag indicador item de inventario */}
                        {isLinked && linkedProduct && (
                          <div className="flex items-center justify-between mb-2 text-[11px]">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/20">
                              <Package size={10} />
                              Inventario · Stock: {linkedProduct.stock}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openProductPicker(idx)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                Cambiar
                              </button>
                              <button
                                type="button"
                                onClick={() => unlinkItem(idx)}
                                className="text-gray-500 hover:text-gray-300"
                              >
                                Desvincular
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-12 sm:col-span-5">
                            {idx === 0 && !isLinked && (
                              <label className="label text-xs">Descripción</label>
                            )}
                            <input
                              type="text"
                              value={item.descripcion}
                              onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                              className="input w-full"
                              placeholder="Descripción"
                              disabled={isLinked}
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            {idx === 0 && <label className="label text-xs">Cant.</label>}
                            <input
                              type="number"
                              value={item.cantidad}
                              onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))}
                              className={`input w-full ${stockWarn ? 'border-red-500/50' : ''}`}
                              min={1}
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            {idx === 0 && <label className="label text-xs">Precio</label>}
                            <input
                              type="number"
                              value={item.precio_unitario}
                              onChange={(e) => updateItem(idx, 'precio_unitario', Number(e.target.value))}
                              className="input w-full"
                              min={0}
                              step="0.01"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            {idx === 0 && <label className="label text-xs">Subtotal</label>}
                            <div className="input w-full bg-[#1C2333] text-gray-300 font-mono tabular text-sm flex items-center">
                              {formatCurrency(item.cantidad * item.precio_unitario)}
                            </div>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            {formData.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {stockWarn && linkedProduct && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                            <AlertTriangle size={12} />
                            Stock insuficiente — disponible: {linkedProduct.stock}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Configuración: Descuento + ITBIS toggle + Estado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label flex items-center gap-1">
                    <Tag size={12} />
                    Descuento (RD$)
                  </label>
                  <input
                    type="number"
                    value={formData.descuento}
                    onChange={(e) => setFormData((p) => ({ ...p, descuento: Number(e.target.value) }))}
                    className="input w-full"
                    min={0}
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Percent size={12} />
                      ITBIS
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, itbisAplicado: !p.itbisAplicado }))}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        formData.itbisAplicado ? 'bg-blue-600' : 'bg-[#1C2333] border border-[#1F2937]'
                      }`}
                      title={formData.itbisAplicado ? 'Desactivar ITBIS' : 'Activar ITBIS'}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          formData.itbisAplicado ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </label>
                  <input
                    type="number"
                    value={formData.itbis}
                    onChange={(e) => setFormData((p) => ({ ...p, itbis: Number(e.target.value) }))}
                    className="input w-full disabled:opacity-50"
                    min={0}
                    max={100}
                    step="0.5"
                    disabled={!formData.itbisAplicado}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData((p) => ({ ...p, estado: e.target.value as EstadoFactura }))}
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
              <div className="bg-gradient-to-br from-[#1C2333] to-[#141A28] rounded-lg p-4 space-y-2 border border-[#1F2937]">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="font-mono tabular text-gray-200">{formatCurrency(formSubtotal)}</span>
                </div>
                {formData.descuento > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400">Descuento</span>
                    <span className="font-mono tabular text-red-400">−{formatCurrency(formData.descuento)}</span>
                  </div>
                )}
                {formData.itbisAplicado && formData.itbis > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">ITBIS ({formData.itbis}%)</span>
                    <span className="font-mono tabular text-gray-200">{formatCurrency(formItbisAmount)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 italic">Sin ITBIS</span>
                    <span className="font-mono tabular text-gray-600">—</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#1F2937]">
                  <span className="text-gray-100">Total</span>
                  <span className="font-mono tabular text-emerald-400">{formatCurrency(formTotal)}</span>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="label">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData((p) => ({ ...p, notas: e.target.value }))}
                  rows={2}
                  className="input w-full resize-none"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-surface border-t border-[#1F2937] px-5 py-4 flex items-center justify-end gap-3">
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

      {/* Product picker modal */}
      {productPickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
          onClick={() => setProductPickerOpen(false)}
        >
          <div
            className="bg-surface border border-[#1F2937] rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col animate-slide-up sm:animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-handle" />
            <div className="px-5 py-4 border-b border-[#1F2937] flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <Package size={18} className="text-blue-400" />
                {pickerTargetIdx !== null ? 'Cambiar producto' : 'Seleccionar del inventario'}
              </h3>
              <button
                onClick={() => setProductPickerOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-[#1F2937]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="input pl-9"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  {productSearch ? 'No se encontraron productos' : 'No hay productos en inventario'}
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const noStock = p.stock === 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p)}
                      disabled={noStock}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                        noStock
                          ? 'opacity-50 cursor-not-allowed bg-[#0F1725]'
                          : 'bg-[#1C2333]/50 hover:bg-[#1C2333] active:scale-[0.99]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-200 truncate">{p.nombre}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Stock:{' '}
                          <span className={p.stock < 5 ? 'text-yellow-400' : 'text-gray-400'}>
                            {p.stock}
                          </span>
                          {noStock && <span className="text-red-400 ml-2">· Sin stock</span>}
                        </div>
                      </div>
                      <div className="text-sm font-bold font-mono tabular text-emerald-400 ml-3">
                        {formatCurrency(p.precio_venta)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
