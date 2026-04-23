'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { createVenta, updateVenta, deleteVenta, getErrorMessage } from '@/lib/services';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, X, ShoppingCart, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import type { Mercancia, Venta, TipoVenta, EstadoVenta } from '@/types';

interface ClienteOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface RevendedorOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface Props {
  ventas: Venta[];
  mercancia: Mercancia[];
  clientes: ClienteOption[];
  revendedores: RevendedorOption[];
}

const estadoVentaColor: Record<EstadoVenta, string> = {
  completada: 'bg-emerald-500/20 text-emerald-400',
  pendiente: 'bg-yellow-500/20 text-yellow-400',
  cancelada: 'bg-red-500/20 text-red-400',
};

const defaultForm = {
  mercancia_id: '',
  cantidad: 1,
  precio_unitario: 0,
  tipo: 'directa' as TipoVenta,
  estado: 'completada' as EstadoVenta,
  cliente_id: '',
  revendedor_id: '',
  notas: '',
};

export default function VentasClient({ ventas: initial, mercancia, clientes, revendedores }: Props) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [ventas, setVentas] = useState(initial);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoVenta | 'todos'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editingVenta, setEditingVenta] = useState<Venta | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Stats
  const totalVentas = ventas.length;
  const totalIngresos = ventas.reduce((sum, v) => sum + v.total, 0);
  const gananciaNeta = ventas.reduce((sum, v) => sum + v.ganancia, 0);
  const ventasRevendedor = ventas.filter((v) => v.tipo === 'revendedor').length;

  // Selected product for live calculation
  const selectedProduct = mercancia.find((m) => m.id === form.mercancia_id);
  const liveTotal = form.cantidad * form.precio_unitario;
  const liveGanancia = selectedProduct
    ? (form.precio_unitario - selectedProduct.precio_compra) * form.cantidad
    : 0;

  const filtered = ventas.filter((v) => {
    const matchTipo = filtroTipo === 'todos' || v.tipo === filtroTipo;
    const matchSearch =
      search === '' ||
      v.mercancia?.nombre.toLowerCase().includes(search.toLowerCase()) ||
      v.clientes?.nombre.toLowerCase().includes(search.toLowerCase()) ||
      v.revendedores?.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (v.notas ?? '').toLowerCase().includes(search.toLowerCase());
    return matchTipo && matchSearch;
  });

  function handleProductChange(mercancia_id: string) {
    const product = mercancia.find((m) => m.id === mercancia_id);
    setForm({ ...form, mercancia_id, precio_unitario: product ? product.precio_venta : 0 });
  }

  function closeModal() {
    setShowModal(false);
    setEditingVenta(null);
    setForm(defaultForm);
  }

  function openCreate() {
    setEditingVenta(null);
    setForm(defaultForm);
    setShowModal(true);
  }

  function openEdit(v: Venta) {
    setEditingVenta(v);
    setForm({
      mercancia_id: v.mercancia_id,
      cantidad: v.cantidad,
      precio_unitario: v.precio_unitario,
      tipo: v.tipo,
      estado: v.estado,
      cliente_id: v.cliente_id ?? '',
      revendedor_id: v.revendedor_id ?? '',
      notas: v.notas ?? '',
    });
    setShowModal(true);
  }

  // Escape key handler and body overflow cleanup
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showModal]);

  async function eliminarDeLibroDiario(origenId: string) {
    const supabase = createClient();
    await supabase.from('libro_diario').delete().eq('origen_id', origenId).eq('origen_tipo', 'venta');
  }

  async function registrarEnLibroDiario(productoNombre: string, total: number, tipo: TipoVenta, destinatario: string | null, ventaId: string) {
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'ingreso',
      categoria: 'Ventas',
      descripcion: `Venta — ${productoNombre}${destinatario ? ` (${destinatario})` : ''}`,
      monto: total,
      referencia: null,
      origen_id: ventaId,
      origen_tipo: 'venta',
    };
    if (profile?.id) payload.registrado_por = profile.id;
    const { error } = await supabase.from('libro_diario').insert(payload);
    if (error) {
      console.error('[LibroDiario] Error venta:', error);
      toast.warning(`Venta registrada. Error en Libro Diario: ${error.message}`);
    }
  }

  async function handleSave() {
    if (!form.mercancia_id) { toast.error('Selecciona un producto'); return; }
    if (form.tipo === 'revendedor' && !form.revendedor_id) { toast.error('Selecciona un revendedor'); return; }

    const product = mercancia.find((m) => m.id === form.mercancia_id);

    // Stock validation for new sales
    if (!editingVenta && product && product.stock < form.cantidad) {
      toast.error(`Stock insuficiente. Disponible: ${product.stock}`, { icon: <AlertTriangle size={16} /> });
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const payload: Record<string, unknown> = {
      mercancia_id: form.mercancia_id,
      cantidad: form.cantidad,
      precio_unitario: form.precio_unitario,
      precio_compra_unitario: product ? product.precio_compra : (editingVenta ? undefined : 0),
      descuento: 0,
      tipo: form.tipo,
      estado: form.estado,
      cliente_id: (form.cliente_id && form.cliente_id !== 'generico') ? form.cliente_id : null,
      revendedor_id: form.tipo === 'revendedor' ? form.revendedor_id : null,
      notas: form.notas || null,
    };

    if (editingVenta) {
      // Remove precio_compra_unitario from edit payload — GENERATED columns can't be set
      delete payload.precio_compra_unitario;
      // Stock adjustment: if same product and cantidad changed, fix stock
      if (editingVenta.mercancia_id === form.mercancia_id && editingVenta.cantidad !== form.cantidad) {
        const diff = editingVenta.cantidad - form.cantidad; // positive = restore, negative = deduct
        if (diff < 0 && product && product.stock < Math.abs(diff)) {
          toast.error(`Stock insuficiente para el cambio. Disponible: ${product.stock}`);
          setLoading(false);
          return;
        }
        await supabase.from('mercancia').update({ stock: (product?.stock ?? 0) + diff }).eq('id', form.mercancia_id);
      }
      const result = await updateVenta(editingVenta.id, payload);
      if (result.error) { toast.error(getErrorMessage(result.error)); setLoading(false); return; }
      toast.success('Venta actualizada');
      const eraCompletada = editingVenta.estado === 'completada';
      if (form.estado === 'completada' && !eraCompletada) {
        // Transición a completada → crear entrada
        const dest = form.tipo === 'revendedor'
          ? revendedores.find((r) => r.id === form.revendedor_id)?.nombre ?? null
          : clientes.find((c) => c.id === form.cliente_id)?.nombre ?? null;
        await registrarEnLibroDiario(product?.nombre ?? 'Producto', liveTotal, form.tipo, dest, editingVenta.id);
      } else if (form.estado !== 'completada' && eraCompletada) {
        // Revertida → eliminar entrada
        await eliminarDeLibroDiario(editingVenta.id);
      }
    } else {
      const result = await createVenta(payload);
      if (result.error) { toast.error(getErrorMessage(result.error)); setLoading(false); return; }
      toast.success('Venta registrada');
      if (form.estado === 'completada' && result.data?.id) {
        const dest = form.tipo === 'revendedor'
          ? revendedores.find((r) => r.id === form.revendedor_id)?.nombre ?? null
          : clientes.find((c) => c.id === form.cliente_id)?.nombre ?? null;
        await registrarEnLibroDiario(product?.nombre ?? 'Producto', liveTotal, form.tipo, dest, result.data.id);
      }
    }

    closeModal();
    router.refresh();
    setLoading(false);
  }

  async function handleDelete(v: Venta) {
    if (!confirm(`¿Eliminar esta venta de "${v.mercancia?.nombre ?? 'producto'}"? Se restaurará el stock.`)) return;
    setDeletingId(v.id);
    if (v.estado === 'completada') {
      const supabase = createClient();
      const { data: prod } = await supabase.from('mercancia').select('stock').eq('id', v.mercancia_id).single();
      if (prod) {
        await supabase.from('mercancia').update({ stock: prod.stock + v.cantidad }).eq('id', v.mercancia_id);
      }
    }
    const result = await deleteVenta(v.id);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      setDeletingId(null);
      return;
    }
    // Eliminar entrada vinculada del libro diario
    await eliminarDeLibroDiario(v.id);
    setVentas((prev) => prev.filter((x) => x.id !== v.id));
    toast.success('Venta eliminada y stock restaurado');
    router.refresh();
    setDeletingId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart size={24} className="text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Ventas</h1>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Nueva Venta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">Total Ventas</span>
          <span className="stat-value">{totalVentas}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Ingresos</span>
          <span className="stat-value text-emerald-400">{formatCurrency(totalIngresos)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Ganancia Neta</span>
          <span className="stat-value text-cyan-400">{formatCurrency(gananciaNeta)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Via Revendedor</span>
          <span className="stat-value">{ventasRevendedor}</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {(['todos', 'directa', 'revendedor'] as const).map((tipo) => (
          <button
            key={tipo}
            onClick={() => setFiltroTipo(tipo)}
            className={`badge cursor-pointer transition-colors ${
              filtroTipo === tipo ? 'bg-blue-600 text-white' : 'bg-[#1C2333] text-gray-400 hover:bg-[#2A3142]'
            }`}
          >
            {tipo === 'todos' ? 'Todos' : tipo === 'directa' ? 'Directa' : 'Revendedor'}
            <span className="ml-1.5 text-xs opacity-70">
              {tipo === 'todos' ? ventas.length : ventas.filter((v) => v.tipo === tipo).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por producto, cliente, revendedor..."
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
              <th className="table-header">Producto</th>
              <th className="table-header">Cant.</th>
              <th className="table-header">P. Unit.</th>
              <th className="table-header">Total</th>
              <th className="table-header">Ganancia</th>
              <th className="table-header">Tipo</th>
              <th className="table-header">Cliente/Revendedor</th>
              <th className="table-header">Estado</th>
              <th className="table-header">Fecha</th>
              <th className="table-header text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="table-cell text-center text-gray-500 py-8">
                  No se encontraron ventas
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/50 transition-colors">
                  <td className="table-cell font-medium text-white">{v.mercancia?.nombre ?? '—'}</td>
                  <td className="table-cell">{v.cantidad}</td>
                  <td className="table-cell">{formatCurrency(v.precio_unitario)}</td>
                  <td className="table-cell font-medium text-white">{formatCurrency(v.total)}</td>
                  <td className="table-cell">
                    <span className={v.ganancia >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatCurrency(v.ganancia)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${v.tipo === 'directa' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                      {v.tipo === 'directa' ? 'Directa' : 'Revendedor'}
                    </span>
                  </td>
                  <td className="table-cell text-sm">
                    {v.tipo === 'directa'
                      ? v.clientes ? `${v.clientes.nombre} ${v.clientes.apellido}` : '—'
                      : v.revendedores ? `${v.revendedores.nombre} ${v.revendedores.apellido}` : '—'}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${estadoVentaColor[v.estado]}`}>{v.estado}</span>
                  </td>
                  <td className="table-cell text-sm">{formatDate(v.created_at)}</td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(v)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(v)}
                        disabled={deletingId === v.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
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

      {/* Modal — Create / Edit */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white">
                {editingVenta ? 'Editar Venta' : 'Nueva Venta'}
              </h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-[#2A3142] text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Producto *</label>
                <select
                  value={form.mercancia_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="input"
                  disabled={!!editingVenta}
                >
                  <option value="">Seleccionar producto</option>
                  {mercancia.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} (Stock: {m.stock})
                    </option>
                  ))}
                </select>
                {editingVenta && <p className="text-xs text-gray-500 mt-1">El producto no se puede cambiar al editar.</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={form.cantidad}
                    onChange={(e) => setForm({ ...form, cantidad: parseInt(e.target.value) || 1 })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Precio Unitario</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.precio_unitario}
                    onChange={(e) => setForm({ ...form, precio_unitario: parseFloat(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
              </div>

              {/* Live calculation */}
              {selectedProduct && (
                <div className="bg-[#1C2333] rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total</span>
                    <span className="text-white font-medium">{formatCurrency(liveTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ganancia estimada</span>
                    <span className={liveGanancia >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                      {formatCurrency(liveGanancia)}
                    </span>
                  </div>
                  {!editingVenta && selectedProduct.stock < form.cantidad && (
                    <div className="flex items-center gap-2 text-red-400 text-xs mt-2">
                      <AlertTriangle size={14} />
                      Stock insuficiente (disponible: {selectedProduct.stock})
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo de Venta</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoVenta, cliente_id: '', revendedor_id: '' })}
                    className="input"
                  >
                    <option value="directa">Directa</option>
                    <option value="revendedor">Revendedor</option>
                  </select>
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoVenta })}
                    className="input"
                  >
                    <option value="completada">Completada</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              {form.tipo === 'directa' ? (
                <div>
                  <label className="label">Cliente</label>
                  <select
                    value={form.cliente_id}
                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                    className="input"
                  >
                    <option value="generico">— Cliente Genérico (sin cuenta) —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label">Revendedor *</label>
                  <select
                    value={form.revendedor_id}
                    onChange={(e) => setForm({ ...form, revendedor_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Seleccionar revendedor</option>
                    {revendedores.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre} {r.apellido}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="input min-h-[60px]"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#1F2937]">
              <button onClick={closeModal} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={loading} className="btn-primary">
                {loading ? 'Guardando...' : editingVenta ? 'Guardar Cambios' : 'Registrar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
