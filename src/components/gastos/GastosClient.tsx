'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { createClient } from '@/lib/supabase/client';
import { createRegistroDiario, updateRegistroDiario, deleteRegistroDiario, getErrorMessage } from '@/lib/services';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus, X, Edit2, Trash2, Receipt, Calendar, Tag, Search,
  Briefcase, Wrench, Plane, Zap, Package as PackageIcon, ShoppingBag, FileQuestion,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

interface GastoEntry {
  id: string;
  fecha: string | null;
  categoria: string;
  descripcion: string;
  monto: number;
  metodo_pago: string | null;
  recibido_en: string | null;
  referencia: string | null;
  tipo: string;
}

interface Props {
  gastos: GastoEntry[];
  categoriasUsadas: string[];
}

interface CategoriaPreset {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const CATEGORIAS_PRESET: CategoriaPreset[] = [
  { key: 'Nóminas',         label: 'Nóminas',         icon: Briefcase,    color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { key: 'Mantenimientos',  label: 'Mantenimientos',  icon: Wrench,       color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
  { key: 'Viáticos',        label: 'Viáticos',        icon: Plane,        color: 'text-purple-400',  bg: 'bg-purple-500/10' },
  { key: 'Servicios',       label: 'Servicios',       icon: Zap,          color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  { key: 'Equipos',         label: 'Equipos',         icon: PackageIcon,  color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  { key: 'Suministros',     label: 'Suministros',     icon: ShoppingBag,  color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  { key: 'Otros',           label: 'Otros',           icon: FileQuestion, color: 'text-gray-400',    bg: 'bg-gray-500/10' },
];

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Depósito', 'Otro'];

const todayISO = () => new Date().toISOString().split('T')[0];

const emptyForm = {
  fecha: todayISO(),
  categoria: 'Nóminas',
  descripcion: '',
  monto: '' as string | number,
  referencia: '',
  metodo_pago: '',
  recibido_en: '',
};

function getCategoriaIcon(cat: string): CategoriaPreset {
  return CATEGORIAS_PRESET.find((c) => c.key === cat) ?? CATEGORIAS_PRESET[CATEGORIAS_PRESET.length - 1];
}

export default function GastosClient({ gastos: initialGastos, categoriasUsadas }: Props) {
  const router = useRouter();
  const { profile } = useAuthStore();

  const [gastos, setGastos] = useState<GastoEntry[]>(initialGastos);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<'hoy' | 'mes' | 'mes-pasado' | 'anio'>('mes');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [showCustomCategoria, setShowCustomCategoria] = useState(false);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setShowCustomCategoria(false);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [modalOpen, closeModal]);

  // Range según período
  const rangeFilter = useMemo(() => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const y = today.getFullYear();
    const m = today.getMonth();
    switch (periodoFilter) {
      case 'hoy':
        return { start: fmt(today), end: fmt(today) };
      case 'mes-pasado': {
        const pm = m === 0 ? 11 : m - 1;
        const py = m === 0 ? y - 1 : y;
        return { start: fmt(new Date(py, pm, 1)), end: fmt(new Date(py, pm + 1, 0)) };
      }
      case 'anio':
        return { start: fmt(new Date(y, 0, 1)), end: fmt(new Date(y, 11, 31)) };
      case 'mes':
      default:
        return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)) };
    }
  }, [periodoFilter]);

  // Filtrado
  const filtered = useMemo(() => {
    return gastos.filter((g) => {
      if (!g.fecha) return false;
      if (g.fecha < rangeFilter.start || g.fecha > rangeFilter.end) return false;
      if (categoriaFilter !== 'todos' && g.categoria !== categoriaFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          g.descripcion.toLowerCase().includes(q) ||
          g.categoria.toLowerCase().includes(q) ||
          (g.referencia ?? '').toLowerCase().includes(q) ||
          (g.recibido_en ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [gastos, rangeFilter, categoriaFilter, search]);

  // Totales por categoría (todos los del rango filtrado)
  const totalesPorCategoria = useMemo(() => {
    const enRango = gastos.filter(
      (g) => g.fecha && g.fecha >= rangeFilter.start && g.fecha <= rangeFilter.end
    );
    const map: Record<string, number> = {};
    enRango.forEach((g) => {
      map[g.categoria] = (map[g.categoria] ?? 0) + g.monto;
    });
    return map;
  }, [gastos, rangeFilter]);

  const totalGeneral = useMemo(
    () => Object.values(totalesPorCategoria).reduce((s, v) => s + v, 0),
    [totalesPorCategoria]
  );

  function openCreateWithCategoria(catKey: string) {
    setFormData({ ...emptyForm, fecha: todayISO(), categoria: catKey });
    setModalMode('create');
    setEditingId(null);
    setShowCustomCategoria(false);
    setModalOpen(true);
  }

  function openCreate() {
    openCreateWithCategoria('Nóminas');
  }

  function openEdit(g: GastoEntry) {
    setFormData({
      fecha: g.fecha ?? todayISO(),
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto,
      referencia: g.referencia ?? '',
      metodo_pago: g.metodo_pago ?? '',
      recibido_en: g.recibido_en ?? '',
    });
    setEditingId(g.id);
    setModalMode('edit');
    const isPreset = CATEGORIAS_PRESET.some((c) => c.key === g.categoria);
    setShowCustomCategoria(!isPreset);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.descripcion.trim()) { toast.error('Ingresa una descripción'); return; }
    if (!formData.categoria.trim()) { toast.error('Selecciona una categoría'); return; }
    if (!formData.monto || Number(formData.monto) <= 0) { toast.error('Monto inválido'); return; }
    if (!formData.fecha) { toast.error('Selecciona una fecha'); return; }

    setLoading(true);
    const payload = {
      fecha: formData.fecha,
      tipo: 'egreso' as const,
      categoria: formData.categoria.trim(),
      descripcion: formData.descripcion.trim(),
      monto: Number(formData.monto),
      referencia: formData.referencia.trim() || null,
      metodo_pago: formData.metodo_pago.trim() || null,
      recibido_en: formData.recibido_en.trim() || null,
      registrado_por: profile?.id ?? null,
    };

    try {
      if (modalMode === 'create') {
        const result = await createRegistroDiario(payload);
        if (result.error) { toast.error(getErrorMessage(result.error)); return; }
        toast.success('Gasto registrado');
      } else {
        const result = await updateRegistroDiario(editingId!, payload);
        if (result.error) { toast.error(getErrorMessage(result.error)); return; }
        toast.success('Gasto actualizado');
      }
      closeModal();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(g: GastoEntry) {
    if (!confirm(`¿Eliminar el gasto "${g.descripcion}"?`)) return;
    const result = await deleteRegistroDiario(g.id);
    if (result.error) { toast.error('Error al eliminar'); return; }
    toast.success('Gasto eliminado');
    setGastos((prev) => prev.filter((x) => x.id !== g.id));
    router.refresh();
  }

  // Categorías disponibles para autocomplete (presets + usadas)
  const allCategorias = useMemo(() => {
    return Array.from(new Set([
      ...CATEGORIAS_PRESET.map((c) => c.key),
      ...categoriasUsadas,
    ]));
  }, [categoriasUsadas]);

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Gastos"
        subtitle="Nóminas, mantenimientos, viáticos y otros egresos"
        icon={Receipt}
        iconColor="text-red-400"
        iconBg="bg-red-500/10"
        actions={
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Nuevo Gasto</span>
            <span className="inline xs:hidden">Nuevo</span>
          </button>
        }
      />

      {/* Período toggle */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {([
          { k: 'hoy', label: 'Hoy' },
          { k: 'mes', label: 'Este mes' },
          { k: 'mes-pasado', label: 'Mes pasado' },
          { k: 'anio', label: 'Este año' },
        ] as const).map((p) => (
          <button
            key={p.k}
            onClick={() => setPeriodoFilter(p.k)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              periodoFilter === p.k
                ? 'bg-blue-600 text-white'
                : 'bg-[#1C2333] text-gray-400 hover:text-gray-200 border border-[#1F2937]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Total general */}
      <div className="kpi-card kpi-card-expense">
        <div className="flex items-center justify-between">
          <span className="kpi-label">Total Gastos del período</span>
          <Receipt size={16} className="text-red-400" />
        </div>
        <div className="kpi-value text-red-400 truncate">
          <span className="sm:hidden">{formatCurrency(totalGeneral).replace('RD$', 'RD$')}</span>
          <span className="hidden sm:inline">{formatCurrency(totalGeneral)}</span>
        </div>
        <div className="kpi-sub">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Categorías como cards clickables (filtros + atajo de creación) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Categorías</span>
          <button
            onClick={() => setCategoriaFilter('todos')}
            className={`text-xs ${categoriaFilter === 'todos' ? 'text-blue-400 font-semibold' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Ver todos
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {CATEGORIAS_PRESET.map((cat) => {
            const Icon = cat.icon;
            const total = totalesPorCategoria[cat.key] ?? 0;
            const active = categoriaFilter === cat.key;
            return (
              <div
                key={cat.key}
                className={`card p-3 cursor-pointer transition-all ${
                  active ? 'ring-2 ring-blue-500 bg-blue-500/5' : 'hover:bg-[#1C2333]'
                }`}
                onClick={() => setCategoriaFilter(active ? 'todos' : cat.key)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-lg ${cat.bg}`}>
                    <Icon size={14} className={cat.color} />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openCreateWithCategoria(cat.key); }}
                    className="p-1 rounded hover:bg-[#1C2333] text-gray-500 hover:text-blue-400 transition-colors"
                    title={`Nuevo gasto de ${cat.label}`}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="text-xs text-gray-400 truncate">{cat.label}</div>
                <div className={`text-sm font-bold font-mono tabular truncate ${cat.color}`}>
                  {formatCurrency(total)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar gasto, referencia, recibido por..."
          className="input w-full pl-10"
        />
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">
            No hay gastos para este período/filtro
          </div>
        ) : (
          filtered.map((g) => {
            const cat = getCategoriaIcon(g.categoria);
            const Icon = cat.icon;
            return (
              <div key={g.id} className="list-card">
                <div className="list-card-header">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`p-1.5 rounded-lg ${cat.bg} flex-shrink-0`}>
                      <Icon size={14} className={cat.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="list-card-title">{g.descripcion}</div>
                      <div className="text-[11px] text-gray-500 truncate">{g.categoria}</div>
                    </div>
                  </div>
                  <div className="text-red-400 font-bold font-mono tabular text-sm flex-shrink-0">
                    −{formatCurrency(g.monto)}
                  </div>
                </div>
                <div className="list-card-meta">
                  <span>{g.fecha ? formatDate(g.fecha) : '—'}</span>
                  {g.metodo_pago && <span className="badge badge-info text-[10px]">{g.metodo_pago}</span>}
                  {g.recibido_en && <span className="text-gray-400">· {g.recibido_en}</span>}
                  {g.referencia && <span className="text-gray-500">Ref: {g.referencia}</span>}
                </div>
                <div className="flex items-center justify-end gap-1 pt-1 border-t border-[#1F2937]/50">
                  <button onClick={() => openEdit(g)} className="btn-icon text-blue-400" aria-label="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(g)} className="btn-icon text-red-400" aria-label="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="table-header">Fecha</th>
                <th className="table-header">Categoría</th>
                <th className="table-header">Descripción</th>
                <th className="table-header">Método / Recibido</th>
                <th className="table-header text-right">Monto</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-gray-500 py-12">
                    No hay gastos para este período/filtro
                  </td>
                </tr>
              ) : (
                filtered.map((g) => {
                  const cat = getCategoriaIcon(g.categoria);
                  const Icon = cat.icon;
                  return (
                    <tr key={g.id} className="border-b border-[#1F2937] hover:bg-[#1C2333]/50 transition-colors">
                      <td className="table-cell whitespace-nowrap">{g.fecha ? formatDate(g.fecha) : '—'}</td>
                      <td className="table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${cat.bg} ${cat.color} border border-[#1F2937]`}>
                          <Icon size={11} />
                          {g.categoria}
                        </span>
                      </td>
                      <td className="table-cell text-gray-200">
                        {g.descripcion}
                        {g.referencia && (
                          <div className="text-xs text-gray-500 mt-0.5">Ref: {g.referencia}</div>
                        )}
                      </td>
                      <td className="table-cell">
                        {g.metodo_pago && (
                          <span className="badge badge-info text-xs block w-fit mb-1">{g.metodo_pago}</span>
                        )}
                        {g.recibido_en && (
                          <span className="text-xs text-gray-400">{g.recibido_en}</span>
                        )}
                        {!g.metodo_pago && !g.recibido_en && <span className="text-gray-600">—</span>}
                      </td>
                      <td className="table-cell text-right font-semibold font-mono tabular text-red-400">
                        −{formatCurrency(g.monto)}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Editar">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(g)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
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
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="px-5 py-4 border-b border-[#1F2937] flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-100">
                {modalMode === 'create' ? 'Nuevo Gasto' : 'Editar Gasto'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333]">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Categoría — preset selector */}
              <div>
                <label className="label flex items-center gap-1">
                  <Tag size={12} />
                  Categoría
                </label>
                {!showCustomCategoria ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {CATEGORIAS_PRESET.map((cat) => {
                      const Icon = cat.icon;
                      const active = formData.categoria === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, categoria: cat.key }))}
                          className={`p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                            active
                              ? `${cat.bg} ${cat.color} border-current`
                              : 'bg-[#1C2333] border-[#1F2937] text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <Icon size={16} />
                          <span className="text-[11px] font-medium">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={formData.categoria}
                    onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                    list="categorias-list"
                    className="input"
                    placeholder="Nombre de la categoría"
                  />
                )}
                <datalist id="categorias-list">
                  {allCategorias.map((c) => <option key={c} value={c} />)}
                </datalist>
                <button
                  type="button"
                  onClick={() => setShowCustomCategoria(!showCustomCategoria)}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-1.5"
                >
                  {showCustomCategoria ? '← Volver a categorías estándar' : '+ Usar otra categoría'}
                </button>
              </div>

              {/* Descripción */}
              <div>
                <label className="label">Descripción *</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
                  className="input"
                  placeholder="Ej: Salario quincena del 15 al 30..."
                />
              </div>

              {/* Monto + Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Monto (RD$) *</label>
                  <input
                    type="number"
                    value={formData.monto}
                    onChange={(e) => setFormData((p) => ({ ...p, monto: e.target.value }))}
                    className="input"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1">
                    <Calendar size={11} /> Fecha
                  </label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData((p) => ({ ...p, fecha: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              {/* Método pago + Pagado a/recibido */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Método de pago</label>
                  <select
                    value={formData.metodo_pago}
                    onChange={(e) => setFormData((p) => ({ ...p, metodo_pago: e.target.value }))}
                    className="input"
                  >
                    <option value="">— Sin especificar —</option>
                    {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Pagado a / Beneficiario</label>
                  <input
                    type="text"
                    value={formData.recibido_en}
                    onChange={(e) => setFormData((p) => ({ ...p, recibido_en: e.target.value }))}
                    className="input"
                    placeholder="Nombre, empresa..."
                  />
                </div>
              </div>

              {/* Referencia */}
              <div>
                <label className="label">Referencia (opcional)</label>
                <input
                  type="text"
                  value={formData.referencia}
                  onChange={(e) => setFormData((p) => ({ ...p, referencia: e.target.value }))}
                  className="input"
                  placeholder="No. cheque, factura, etc."
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#1F2937] flex items-center justify-end gap-3">
              <button onClick={closeModal} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={loading} className="btn-primary">
                {loading ? 'Guardando...' : modalMode === 'create' ? 'Registrar Gasto' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
