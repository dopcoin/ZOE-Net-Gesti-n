'use client';

import { useState, useMemo, useEffect } from 'react';
import { createMercancia, updateMercancia, deleteMercancia, getErrorMessage } from '@/lib/services';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, X } from 'lucide-react';
import type { Mercancia, CategoriaMercancia } from '@/types';

interface Props {
  mercancia: Mercancia[];
  categorias: CategoriaMercancia[];
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
}

const emptyForm: FormData = {
  nombre: '',
  descripcion: '',
  categoria_id: '',
  precio_compra: '',
  precio_venta: '',
  stock: '',
  stock_minimo: '',
  activo: true,
};

export default function InventarioClient({ mercancia: initialMercancia, categorias }: Props) {
  const [items, setItems] = useState<Mercancia[]>(initialMercancia);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('');
  const [modal, setModal] = useState<{ open: boolean; mode: 'create' | 'edit'; id?: string }>({ open: false, mode: 'create' });
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(false);

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
  const stats = useMemo(() => {
    const totalItems = items.length;
    const valorTotal = items.reduce((acc, i) => acc + i.stock * i.precio_compra, 0);
    const lowStock = items.filter((i) => i.stock < i.stock_minimo).length;
    const activeItems = items.filter((i) => i.activo).length;
    return { totalItems, valorTotal, lowStock, activeItems };
  }, [items]);

  const lowStockItems = useMemo(() => items.filter((i) => i.stock < i.stock_minimo), [items]);

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
    setFormData(emptyForm);
    setModal({ open: true, mode: 'create' });
  };

  const openEdit = (item: Mercancia) => {
    setFormData({
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      categoria_id: item.categoria_id || '',
      precio_compra: String(item.precio_compra),
      precio_venta: String(item.precio_venta),
      stock: String(item.stock),
      stock_minimo: String(item.stock_minimo),
      activo: item.activo,
    });
    setModal({ open: true, mode: 'edit', id: item.id });
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'create' });
    setFormData(emptyForm);
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
    };

    if (modal.mode === 'create') {
      const result = await createMercancia(payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      // Optimistic: refresh will pick up the new item with relations
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
        `"${nombre}" tiene ${count} venta(s) asociada(s) y no se puede eliminar.\n\n¿Desactivar el producto en cambio? (Ya no aparecerá en nuevas ventas)`
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package size={28} />
            Inventario
          </h1>
          <p className="text-sm text-gray-400 mt-1">Gestion de mercancia y productos</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Nuevo Producto
        </button>
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
                        <span
                          className={`badge ${
                            item.activo
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {item.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
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
