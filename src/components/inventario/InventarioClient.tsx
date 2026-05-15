'use client';

import { useState, useMemo, useEffect } from 'react';
import { createMercancia, updateMercancia, deleteMercancia, getErrorMessage } from '@/lib/services';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, X, Eye } from 'lucide-react';
import type { Mercancia, CategoriaMercancia } from '@/types';

interface Props {
  mercancia: Mercancia[];
  categorias: CategoriaMercancia[];
  /** Si false, oculta botones de crear/editar/eliminar (solo lectura) */
  canEdit?: boolean;
}

interface FormData {
  nombre: string;
  descripcion: string;
  categoria_id: string;
  precio_compra: string;
  precio_venta: string;
  stock: string;
  stock_minimo: string;
  activo: boolean;
  fecha_entrada: string;
  // Vinculación con gasto en libro_diario
  registrar_gasto: boolean;       // toggle
  gasto_metodo_pago: string;
  gasto_recibido_en: string;       // beneficiario / proveedor
  gasto_referencia: string;
  gasto_categoria: string;         // por defecto "Equipos"
  gasto_descripcion: string;       // auto-llenada
}

interface GastoVinculado {
  id: string;
  fecha: string | null;
  monto: number;
  categoria: string;
  descripcion: string;
  metodo_pago: string | null;
  recibido_en: string | null;
  referencia: string | null;
}

const todayISO = () => new Date().toISOString().split('T')[0];
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Depósito', 'Otro'];

const emptyForm: FormData = {
  nombre: '',
  descripcion: '',
  categoria_id: '',
  precio_compra: '',
  precio_venta: '',
  stock: '',
  stock_minimo: '',
  activo: true,
  fecha_entrada: todayISO(),
  registrar_gasto: false,
  gasto_metodo_pago: 'Efectivo',
  gasto_recibido_en: '',
  gasto_referencia: '',
  gasto_categoria: 'Equipos',
  gasto_descripcion: '',
};

export default function InventarioClient({ mercancia: initialMercancia, categorias, canEdit = true }: Props) {
  const [items, setItems] = useState<Mercancia[]>(initialMercancia);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('');
  const [modal, setModal] = useState<{ open: boolean; mode: 'create' | 'edit'; id?: string }>({ open: false, mode: 'create' });
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  // Gastos vinculados al producto que se está editando
  const [gastosVinculados, setGastosVinculados] = useState<GastoVinculado[]>([]);
  const [loadingGastos, setLoadingGastos] = useState(false);

  // Escape key handler and body overflow cleanup
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (modal.open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [modal.open]);

  // --- Filtering ---
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.nombre.toLowerCase().includes(search.toLowerCase());
      const matchCategoria = !categoriaFilter || item.categoria_id === categoriaFilter;
      return matchSearch && matchCategoria;
    });
  }, [items, search, categoriaFilter]);

  // --- Stats ---
  // Liquidado = activo=false + stock=0. No cuenta para valor del inventario ni stock bajo.
  const stats = useMemo(() => {
    const liquidados = items.filter((i) => !i.activo && i.stock === 0).length;
    const inactivos = items.filter((i) => !i.activo && i.stock > 0).length;
    const activos = items.filter((i) => i.activo);
    const totalItems = items.length;
    const activeItems = activos.length;
    // Valor total: SOLO productos activos (los liquidados están fuera de circulación)
    const valorTotal = activos.reduce((acc, i) => acc + i.stock * i.precio_compra, 0);
    // Stock bajo: solo entre activos
    const lowStock = activos.filter((i) => i.stock < i.stock_minimo).length;
    return { totalItems, valorTotal, lowStock, activeItems, liquidados, inactivos };
  }, [items]);

  // Solo activos para el panel de stock bajo
  const lowStockItems = useMemo(
    () => items.filter((i) => i.activo && i.stock < i.stock_minimo),
    [items]
  );

  // --- Category counts ---
  const categoriaCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      const key = i.categoria_id || 'sin-categoria';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [items]);

  // --- Margin calculator ---
  const calcMargin = (compra: number, venta: number) => {
    if (!compra || compra === 0) return { percent: 0, amount: 0 };
    const amount = venta - compra;
    const percent = (amount / compra) * 100;
    return { percent, amount };
  };

  const liveMargin = useMemo(() => {
    const compra = parseFloat(formData.precio_compra) || 0;
    const venta = parseFloat(formData.precio_venta) || 0;
    return calcMargin(compra, venta);
  }, [formData.precio_compra, formData.precio_venta]);

  // --- Modal helpers ---
  const openCreate = () => {
    setFormData({ ...emptyForm, registrar_gasto: true }); // Por defecto activo al crear
    setGastosVinculados([]);
    setModal({ open: true, mode: 'create' });
  };

  const openEdit = async (item: Mercancia) => {
    setFormData({
      ...emptyForm,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      categoria_id: item.categoria_id || '',
      precio_compra: String(item.precio_compra),
      precio_venta: String(item.precio_venta),
      stock: String(item.stock),
      stock_minimo: String(item.stock_minimo),
      activo: item.activo,
      fecha_entrada: item.fecha_entrada || (item.created_at ? item.created_at.split('T')[0] : todayISO()),
      // Al editar, por defecto NO crear nuevo gasto (solo actualizar el producto)
      registrar_gasto: false,
    });
    setModal({ open: true, mode: 'edit', id: item.id });

    // Cargar historial de gastos vinculados
    setLoadingGastos(true);
    setGastosVinculados([]);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase
        .from('libro_diario')
        .select('id, fecha, monto, categoria, descripcion, metodo_pago, recibido_en, referencia')
        .eq('origen_id', item.id)
        .eq('origen_tipo', 'mercancia')
        .order('fecha', { ascending: false });
      if (data) setGastosVinculados(data);
    } catch (e) {
      console.warn('[gastos vinculados]', e);
    } finally {
      setLoadingGastos(false);
    }
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'create' });
    setFormData(emptyForm);
    setGastosVinculados([]);
  };

  // --- CRUD ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setLoading(true);

    const payload = {
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion.trim() || null,
      categoria_id: formData.categoria_id || null,
      precio_compra: parseFloat(formData.precio_compra) || 0,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      stock: parseInt(formData.stock) || 0,
      stock_minimo: parseInt(formData.stock_minimo) || 0,
      activo: formData.activo,
      fecha_entrada: formData.fecha_entrada || todayISO(),
    };

    let productoId: string | null = modal.id ?? null;

    if (modal.mode === 'create') {
      const result = await createMercancia(payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      productoId = result.data?.id ?? null;
      toast.success('Producto creado exitosamente');
    } else {
      const result = await updateMercancia(modal.id!, payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      toast.success('Producto actualizado exitosamente');
    }

    // === Registrar gasto vinculado en libro_diario ===
    if (formData.registrar_gasto && productoId && payload.stock > 0 && payload.precio_compra > 0) {
      try {
        const { createRegistroDiario } = await import('@/lib/services');
        const montoGasto = payload.stock * payload.precio_compra;
        const descGasto = formData.gasto_descripcion.trim() ||
          `Compra inventario: ${payload.stock}× ${payload.nombre} @ ${payload.precio_compra.toFixed(2)}`;

        const gastoResult = await createRegistroDiario({
          fecha: formData.fecha_entrada || todayISO(),
          tipo: 'egreso',
          categoria: formData.gasto_categoria.trim() || 'Equipos',
          descripcion: descGasto,
          monto: montoGasto,
          referencia: formData.gasto_referencia.trim() || null,
          metodo_pago: formData.gasto_metodo_pago || null,
          recibido_en: formData.gasto_recibido_en.trim() || null,
          origen_id: productoId,
          origen_tipo: 'mercancia',
        });

        if (gastoResult.error) {
          toast.warning(`Producto guardado, pero falló registrar el gasto: ${gastoResult.error.message}`);
        } else {
          toast.success(`Gasto de ${new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(montoGasto)} vinculado en Libro Diario`);
        }
      } catch (e) {
        console.warn('[gasto vinculado]', e);
        toast.warning('Producto guardado, pero falló registrar el gasto vinculado');
      }
    }

    // Re-fetch items to get proper relations
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: refreshed } = await supabase
      .from('mercancia')
      .select('*, categorias_mercancia(nombre)')
      .order('nombre');
    if (refreshed) setItems(refreshed);

    closeModal();
    setLoading(false);
  };

  // Marca producto como liquidado: stock=0, activo=false. No se elimina del histórico.
  const handleLiquidar = async (item: Mercancia) => {
    const stockActual = item.stock;
    const ok = confirm(
      `¿Marcar "${item.nombre}" como LIQUIDADO?\n\n` +
      (stockActual > 0
        ? `⚠ Stock actual: ${stockActual} → se pondrá en 0\n`
        : '') +
      `El producto:\n` +
      `  • Sale del inventario activo (no aparece en valor total)\n` +
      `  • No se puede vender hasta reactivarlo\n` +
      `  • Se mantiene el histórico de ventas\n\n` +
      `Para reactivar: edítalo y vuelve a poner stock + activar.`
    );
    if (!ok) return;
    setLoading(true);
    const result = await updateMercancia(item.id, { activo: false, stock: 0 });
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      setLoading(false);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, activo: false, stock: 0 } : i)));
    toast.success(`"${item.nombre}" marcado como liquidado`);
    setLoading(false);
  };

  const handleDelete = async (id: string, nombre: string) => {
    // Check if product has associated ventas (FK constraint)
    const { createClient: getClient } = await import('@/lib/supabase/client');
    const supabase = getClient();
    const { count } = await supabase
      .from('ventas')
      .select('id', { count: 'exact', head: true })
      .eq('mercancia_id', id);

    if (count && count > 0) {
      const deactivate = confirm(
        `"${nombre}" tiene ${count} venta(s) en el historial y no puede eliminarse (integridad de datos).\n\n¿Desactivar en cambio? El producto quedará oculto del inventario activo pero se conserva el historial.`
      );
      if (!deactivate) return;
      const result = await updateMercancia(id, { activo: false });
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        return;
      }
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, activo: false } : i));
      toast.success(`"${nombre}" desactivado`);
      return;
    }

    if (!confirm(`Eliminar "${nombre}"? Esta accion no se puede deshacer.`)) return;
    const result = await deleteMercancia(id);
    if (result.error) {
      // Fallback: FK violation means there are ventas we couldn't count (RLS)
      if (result.error.code === '23503') {
        const deactivate = confirm(
          `"${nombre}" tiene ventas asociadas y no puede eliminarse.\n\n¿Desactivar en cambio?`
        );
        if (deactivate) {
          await updateMercancia(id, { activo: false });
          setItems((prev) => prev.map((i) => i.id === id ? { ...i, activo: false } : i));
          toast.success(`"${nombre}" desactivado`);
        }
        return;
      }
      toast.error(getErrorMessage(result.error));
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success('Producto eliminado');
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 truncate">
            <Package size={24} className="flex-shrink-0" />
            Inventario
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 flex items-center gap-1.5">
            {canEdit ? (
              'Gestión de mercancía y productos'
            ) : (
              <>
                <Eye size={12} className="text-blue-400" />
                <span className="text-blue-400">Modo solo lectura</span>
                <span className="text-gray-500">— consulta sin edición</span>
              </>
            )}
          </p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 flex-shrink-0">
            <Plus size={16} />
            <span className="hidden xs:inline">Nuevo Producto</span>
            <span className="inline xs:hidden">Nuevo</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Package size={18} className="text-blue-400" />
            </div>
            <span className="stat-label">Total Productos</span>
          </div>
          <span className="stat-value">{stats.totalItems}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Package size={18} className="text-emerald-400" />
            </div>
            <span className="stat-label">Valor Inventario</span>
          </div>
          <span className="stat-value text-lg">{formatCurrency(stats.valorTotal)}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertTriangle size={18} className="text-yellow-400" />
            </div>
            <span className="stat-label">Stock Bajo</span>
          </div>
          <span className="stat-value text-yellow-400">{stats.lowStock}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Package size={18} className="text-purple-400" />
            </div>
            <span className="stat-label">Activos</span>
          </div>
          <span className="stat-value">{stats.activeItems}</span>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Stock bajo detectado</p>
            <p className="text-xs text-yellow-400/70 mt-1">
              {lowStockItems.map((i) => `${i.nombre} (${i.stock}/${i.stock_minimo})`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoriaFilter('')}
            className={`badge cursor-pointer transition-colors ${
              !categoriaFilter
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-[#1C2333] text-gray-400 hover:text-gray-200'
            }`}
          >
            Todas ({items.length})
          </button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaFilter(cat.id === categoriaFilter ? '' : cat.id)}
              className={`badge cursor-pointer transition-colors ${
                categoriaFilter === cat.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-[#1C2333] text-gray-400 hover:text-gray-200'
              }`}
            >
              {cat.nombre} ({categoriaCounts[cat.id] || 0})
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
                <th className="table-header">Categoria</th>
                <th className="table-header">Entrada</th>
                <th className="table-header text-right">P. Compra</th>
                <th className="table-header text-right">P. Venta</th>
                <th className="table-header text-right">Margen</th>
                <th className="table-header text-center">Stock</th>
                <th className="table-header text-center">Estado</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center text-gray-500 py-12">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const margin = calcMargin(item.precio_compra, item.precio_venta);
                  const isLowStock = item.stock < item.stock_minimo;
                  return (
                    <tr key={item.id} className="hover:bg-[#1C2333]/50 transition-colors">
                      <td className="table-cell">
                        <div>
                          <span className="text-white font-medium">{item.nombre}</span>
                          {item.descripcion && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                              {item.descripcion}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        {item.categorias_mercancia?.nombre ? (
                          <span className="badge bg-[#1C2333] text-gray-300">
                            {item.categorias_mercancia.nombre}
                          </span>
                        ) : (
                          <span className="text-gray-500">--</span>
                        )}
                      </td>
                      <td className="table-cell text-xs text-gray-400 whitespace-nowrap">
                        {item.fecha_entrada
                          ? formatDate(item.fecha_entrada)
                          : (item.created_at ? formatDate(item.created_at) : '—')}
                      </td>
                      <td className="table-cell text-right">{formatCurrency(item.precio_compra)}</td>
                      <td className="table-cell text-right text-white font-medium">
                        {formatCurrency(item.precio_venta)}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex flex-col items-end">
                          <span className={margin.percent >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {margin.percent.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500">{formatCurrency(margin.amount)}</span>
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        <span
                          className={`font-medium ${
                            isLowStock ? 'text-yellow-400' : 'text-gray-200'
                          }`}
                        >
                          {item.stock}
                        </span>
                        {isLowStock && (
                          <div className="flex items-center justify-center gap-1 mt-0.5">
                            <AlertTriangle size={12} className="text-yellow-400" />
                            <span className="text-[10px] text-yellow-400">Min: {item.stock_minimo}</span>
                          </div>
                        )}
                      </td>
                      <td className="table-cell text-center">
                        {(() => {
                          const liquidado = !item.activo && item.stock === 0;
                          if (liquidado) return <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30">Liquidado</span>;
                          if (!item.activo) return <span className="badge bg-gray-500/20 text-gray-400">Inactivo</span>;
                          return <span className="badge bg-emerald-500/20 text-emerald-400">Activo</span>;
                        })()}
                      </td>
                      <td className="table-cell text-right">
                        {canEdit ? (
                          <div className="flex items-center justify-end gap-1">
                            {item.activo && (
                              <button
                                onClick={() => handleLiquidar(item)}
                                className="px-2 py-1 text-[11px] font-medium rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
                                title="Marcar como liquidado (stock=0, sale del inventario activo)"
                              >
                                Liquidar
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-lg hover:bg-[#1C2333] text-gray-400 hover:text-blue-400 transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.nombre)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white">
                {modal.mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-[#1C2333] text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Nombre */}
              <div>
                <label className="label">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => updateField('nombre', e.target.value)}
                  className="input"
                  placeholder="Nombre del producto"
                  required
                />
              </div>

              {/* Descripcion */}
              <div>
                <label className="label">Descripcion</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => updateField('descripcion', e.target.value)}
                  className="input min-h-[60px] resize-y"
                  placeholder="Descripcion opcional"
                  rows={2}
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="label">Categoria</label>
                <select
                  value={formData.categoria_id}
                  onChange={(e) => updateField('categoria_id', e.target.value)}
                  className="input"
                >
                  <option value="">Sin categoria</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Precio Compra</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_compra}
                    onChange={(e) => updateField('precio_compra', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label">Precio Venta</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_venta}
                    onChange={(e) => updateField('precio_venta', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Markup rápido — aparece cuando hay precio de compra */}
              {parseFloat(formData.precio_compra) > 0 && (
                <div className="bg-[#0A0F1E] rounded-lg p-3 border border-[#1F2937]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400">
                      {formData.precio_venta
                        ? 'Aplicar markup rápido'
                        : 'Sin precio de venta — aplicar markup'}
                    </p>
                    {formData.precio_venta && (
                      <button
                        type="button"
                        onClick={() => updateField('precio_venta', '')}
                        className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[20, 30, 60, 80, 100].map((pct) => {
                      const compra = parseFloat(formData.precio_compra) || 0;
                      const venta = compra * (1 + pct / 100);
                      const ventaActual = parseFloat(formData.precio_venta) || 0;
                      const isActive = Math.abs(venta - ventaActual) < 0.01;
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => updateField('precio_venta', venta.toFixed(2))}
                          title={`${formatCurrency(venta)} (markup ${pct}%)`}
                          className={`py-2 px-2 rounded-lg text-sm font-semibold border transition-all active:scale-95 ${
                            isActive
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-500/20'
                              : 'bg-[#1C2333] border-[#1F2937] text-gray-300 hover:border-blue-500/50 hover:text-blue-400'
                          }`}
                        >
                          +{pct}%
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Live margin calculator */}
              {(formData.precio_compra || formData.precio_venta) && (
                <div className="bg-[#0A0F1E] rounded-lg p-3 border border-[#1F2937]">
                  <p className="text-xs text-gray-400 mb-1">Margen calculado</p>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-lg font-bold ${
                        liveMargin.percent >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {liveMargin.percent.toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-400">
                      {formatCurrency(liveMargin.amount)} de ganancia por unidad
                    </span>
                  </div>
                </div>
              )}

              {/* Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => updateField('stock', e.target.value)}
                    className="input"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Stock Minimo</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_minimo}
                    onChange={(e) => updateField('stock_minimo', e.target.value)}
                    className="input"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Fecha de entrada */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Fecha de entrada al inventario
                </label>
                <input
                  type="date"
                  value={formData.fecha_entrada}
                  onChange={(e) => updateField('fecha_entrada', e.target.value)}
                  className="input"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Cuándo entró este producto al inventario (compra/orden).
                </p>
              </div>

              {/* Activo toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <label className="text-sm font-medium text-gray-200">Activo</label>
                  <p className="text-xs text-gray-500">Producto disponible para venta</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('activo', !formData.activo)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    formData.activo ? 'bg-blue-600' : 'bg-[#1C2333] border border-[#1F2937]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      formData.activo ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* ====== VINCULACIÓN CON GASTO ====== */}
              <div className="border-t border-[#1F2937] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💰</span>
                    <div>
                      <label className="text-sm font-semibold text-gray-200">
                        Registrar como gasto en Libro Diario
                      </label>
                      <p className="text-[11px] text-gray-500">
                        {modal.mode === 'create'
                          ? 'Crea un egreso vinculado a este producto'
                          : 'Registra una compra adicional (reabastecimiento)'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField('registrar_gasto', !formData.registrar_gasto)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      formData.registrar_gasto ? 'bg-emerald-600' : 'bg-[#1C2333] border border-[#1F2937]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        formData.registrar_gasto ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {formData.registrar_gasto && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                    {/* Total a registrar */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-xs text-gray-300">Total a registrar como gasto:</span>
                      <span className="text-lg font-bold font-mono tabular text-emerald-400">
                        {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
                          .format((parseInt(formData.stock) || 0) * (parseFloat(formData.precio_compra) || 0))}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      = {parseInt(formData.stock) || 0} unidades × {' '}
                      {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
                        .format(parseFloat(formData.precio_compra) || 0)} por unidad
                    </p>

                    {/* Categoría + Método de pago */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Categoría del gasto</label>
                        <select
                          value={formData.gasto_categoria}
                          onChange={(e) => updateField('gasto_categoria', e.target.value)}
                          className="input"
                        >
                          <option value="Equipos">Equipos</option>
                          <option value="Suministros">Suministros</option>
                          <option value="Mantenimientos">Mantenimientos</option>
                          <option value="Servicios">Servicios</option>
                          <option value="Otros">Otros</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Método de pago</label>
                        <select
                          value={formData.gasto_metodo_pago}
                          onChange={(e) => updateField('gasto_metodo_pago', e.target.value)}
                          className="input"
                        >
                          {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Beneficiario + Referencia */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Proveedor / Pagado a</label>
                        <input
                          type="text"
                          value={formData.gasto_recibido_en}
                          onChange={(e) => updateField('gasto_recibido_en', e.target.value)}
                          className="input"
                          placeholder="Nombre del proveedor..."
                        />
                      </div>
                      <div>
                        <label className="label">Referencia</label>
                        <input
                          type="text"
                          value={formData.gasto_referencia}
                          onChange={(e) => updateField('gasto_referencia', e.target.value)}
                          className="input"
                          placeholder="Factura, cheque..."
                        />
                      </div>
                    </div>

                    {/* Descripción opcional */}
                    <div>
                      <label className="label">Descripción <span className="text-gray-600">(opcional)</span></label>
                      <input
                        type="text"
                        value={formData.gasto_descripcion}
                        onChange={(e) => updateField('gasto_descripcion', e.target.value)}
                        className="input"
                        placeholder={`Auto: "Compra inventario: ${formData.stock || 'N'}× ${formData.nombre || 'producto'}..."`}
                      />
                    </div>

                    <p className="text-[11px] text-emerald-400/80 flex items-start gap-1">
                      <span>✓</span>
                      <span>Se creará una entrada de <strong>egreso</strong> en el Libro Diario vinculada a este producto.
                        Aparecerá también en <strong>/gastos</strong>.</span>
                    </p>
                  </div>
                )}
              </div>

              {/* ====== HISTORIAL DE GASTOS VINCULADOS (solo edición) ====== */}
              {modal.mode === 'edit' && (
                <div className="border-t border-[#1F2937] pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">📜</span>
                    <div>
                      <label className="text-sm font-semibold text-gray-200">
                        Historial de compras vinculadas
                      </label>
                      <p className="text-[11px] text-gray-500">
                        Gastos en Libro Diario asociados a este producto
                      </p>
                    </div>
                  </div>

                  {loadingGastos ? (
                    <div className="text-xs text-gray-500 py-4 text-center">Cargando...</div>
                  ) : gastosVinculados.length === 0 ? (
                    <div className="text-xs text-gray-500 italic py-4 text-center rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      Sin gastos vinculados.{' '}
                      {(parseInt(formData.stock) || 0) > 0 && (parseFloat(formData.precio_compra) || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => updateField('registrar_gasto', true)}
                          className="text-emerald-400 hover:text-emerald-300 underline"
                        >
                          Registrar uno ahora ↑
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {gastosVinculados.map((g) => (
                          <div key={g.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#1C2333]/40 border border-[#1F2937] text-xs">
                            <div className="min-w-0 flex-1">
                              <div className="text-gray-200 truncate">{g.descripcion}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                {g.fecha ? formatDate(g.fecha) : '—'}
                                {g.metodo_pago && <span> · {g.metodo_pago}</span>}
                                {g.recibido_en && <span> · {g.recibido_en}</span>}
                                {g.referencia && <span> · Ref: {g.referencia}</span>}
                              </div>
                            </div>
                            <span className="text-sm font-bold font-mono tabular text-red-400 ml-3 flex-shrink-0">
                              −{new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(g.monto)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-2 px-2 text-[11px]">
                        <span className="text-gray-500">{gastosVinculados.length} compra{gastosVinculados.length !== 1 ? 's' : ''}</span>
                        <span className="text-gray-300">
                          Total invertido:{' '}
                          <span className="font-bold text-red-400 font-mono tabular">
                            {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
                              .format(gastosVinculados.reduce((s, g) => s + g.monto, 0))}
                          </span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1F2937]">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading
                    ? 'Guardando...'
                    : modal.mode === 'create'
                    ? 'Crear Producto'
                    : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
