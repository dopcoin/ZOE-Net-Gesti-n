'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { createRegistroDiario, updateRegistroDiario, deleteRegistroDiario } from '@/lib/services';
import { formatCurrency, formatDate, meses } from '@/lib/utils';
import { toast } from 'sonner';
import type { LibroDiario, TipoMovimiento } from '@/types';
import {
  Plus, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  DollarSign, Edit2, Trash2, X, BookOpen,
} from 'lucide-react';

const DEFAULT_CATEGORIAS_ENTRADA = ['Cobros clientes', 'Servicios adicionales', 'Instalaciones', 'Otros ingresos'];
const DEFAULT_CATEGORIAS_SALIDA = ['Infraestructura', 'Salarios', 'Equipos', 'Servicios externos', 'Mantenimiento', 'Otros gastos'];

const emptyForm = {
  fecha: new Date().toISOString().split('T')[0],
  tipo: 'ingreso' as TipoMovimiento,
  categoria: '',
  descripcion: '',
  monto: '' as string | number,
  referencia: '',
};

interface Props {
  registros: LibroDiario[];
  categorias: string[];
}

export default function LibroDiarioClient({ registros: initialRegistros, categorias: initialCategorias }: Props) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const now = new Date();

  const [registros, setRegistros] = useState<LibroDiario[]>(initialRegistros);
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoMovimiento | 'todos'>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [showNewCategoria, setShowNewCategoria] = useState(false);
  const [newCategoria, setNewCategoria] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setShowNewCategoria(false);
    setNewCategoria('');
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [modalOpen, closeModal]);

  // All categorias: defaults + from existing registros
  const allCategorias = useMemo(() => {
    const fromRegistros = registros.map((r) => r.categoria).filter(Boolean);
    return Array.from(new Set([
      ...DEFAULT_CATEGORIAS_ENTRADA,
      ...DEFAULT_CATEGORIAS_SALIDA,
      ...initialCategorias,
      ...fromRegistros,
    ])).sort();
  }, [registros, initialCategorias]);

  // Filter registros by current month/year
  const registrosMes = useMemo(() => {
    return registros.filter((r) => {
      if (!r.fecha) return false;
      const d = new Date(r.fecha + 'T00:00:00');
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });
  }, [registros, currentMonth, currentYear]);

  const filtered = useMemo(() => {
    return registrosMes.filter((r) => {
      if (tipoFilter !== 'todos' && r.tipo !== tipoFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.descripcion.toLowerCase().includes(q) ||
          r.categoria.toLowerCase().includes(q) ||
          (r.referencia ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [registrosMes, tipoFilter, search]);

  // Stats for the current month
  const stats = useMemo(() => {
    const entradas = registrosMes.filter((r) => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0);
    const salidas = registrosMes.filter((r) => r.tipo === 'egreso').reduce((s, r) => s + r.monto, 0);
    const balance = entradas - salidas;
    // All-time balance
    const allEntradas = registros.filter((r) => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0);
    const allSalidas = registros.filter((r) => r.tipo === 'egreso').reduce((s, r) => s + r.monto, 0);
    const balanceTotal = allEntradas - allSalidas;
    return { entradas, salidas, balance, balanceTotal };
  }, [registrosMes, registros]);

  function prevMonth() {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  }

  function openCreate() {
    setFormData({ ...emptyForm, fecha: new Date().toISOString().split('T')[0] });
    setModalMode('create');
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(r: LibroDiario) {
    setFormData({
      fecha: r.fecha ?? new Date().toISOString().split('T')[0],
      tipo: r.tipo,
      categoria: r.categoria,
      descripcion: r.descripcion,
      monto: r.monto,
      referencia: r.referencia ?? '',
    });
    setEditingId(r.id);
    setModalMode('edit');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.descripcion.trim()) { toast.error('Ingresa una descripción'); return; }
    if (!formData.categoria.trim()) { toast.error('Selecciona una categoría'); return; }
    if (!formData.monto || Number(formData.monto) <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (!formData.fecha) { toast.error('Selecciona una fecha'); return; }

    setLoading(true);
    const payload = {
      fecha: formData.fecha,
      tipo: formData.tipo,
      categoria: formData.categoria.trim(),
      descripcion: formData.descripcion.trim(),
      monto: Number(formData.monto),
      referencia: formData.referencia.trim() || null,
      registrado_por: profile?.id ?? null,
    };

    try {
      if (modalMode === 'create') {
        const result = await createRegistroDiario(payload);
        if (result.error) { toast.error('Error al crear registro'); return; }
        toast.success('Registro creado');
      } else {
        const result = await updateRegistroDiario(editingId!, payload);
        if (result.error) { toast.error('Error al actualizar registro'); return; }
        toast.success('Registro actualizado');
      }
      closeModal();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      const result = await deleteRegistroDiario(id);
      if (result.error) { toast.error('Error al eliminar'); return; }
      toast.success('Registro eliminado');
      setDeleteConfirm(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <BookOpen className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">Libro Diario</h1>
            <p className="text-sm text-gray-500">Control de entradas y salidas</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Registro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="stat-label text-xs">Entradas del mes</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(stats.entradas)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <span className="stat-label text-xs">Salidas del mes</span>
          </div>
          <p className="text-lg font-bold text-red-400">{formatCurrency(stats.salidas)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-blue-400" />
            <span className="stat-label text-xs">Balance del mes</span>
          </div>
          <p className={`text-lg font-bold ${stats.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(stats.balance)}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-purple-400" />
            <span className="stat-label text-xs">Balance total</span>
          </div>
          <p className={`text-lg font-bold ${stats.balanceTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(stats.balanceTotal)}
          </p>
        </div>
      </div>

      {/* Month navigator + filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg bg-[#1C2333] hover:bg-[#252D3D] text-gray-400 hover:text-gray-200 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold text-gray-100 min-w-[140px] text-center">
            {meses[currentMonth - 1]} {currentYear}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg bg-[#1C2333] hover:bg-[#252D3D] text-gray-400 hover:text-gray-200 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['todos', 'ingreso', 'egreso'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipoFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tipoFilter === t
                  ? t === 'ingreso' ? 'bg-emerald-600 text-white'
                    : t === 'egreso' ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
                  : 'bg-[#1C2333] text-gray-400 hover:text-gray-200'
              }`}
            >
              {t === 'todos' ? 'Todos' : t === 'ingreso' ? 'Entradas' : 'Salidas'}
            </button>
          ))}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="input text-sm h-8 px-3 w-40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="table-header">Fecha</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Categoría</th>
                <th className="table-header">Descripción</th>
                <th className="table-header">Referencia</th>
                <th className="table-header text-right">Monto</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-gray-500 py-12">
                    No hay registros para este mes
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-[#1F2937] hover:bg-[#1C2333]/50 transition-colors">
                    <td className="table-cell text-gray-300 whitespace-nowrap">
                      {r.fecha ? formatDate(r.fecha) : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${r.tipo === 'ingreso'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'}`}>
                        {r.tipo === 'ingreso' ? '↑ Entrada' : '↓ Salida'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-300">{r.categoria}</td>
                    <td className="table-cell text-gray-200">{r.descripcion}</td>
                    <td className="table-cell text-gray-500 text-sm">{r.referencia ?? '—'}</td>
                    <td className={`table-cell text-right font-semibold ${
                      r.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {r.tipo === 'egreso' ? '−' : '+'}{formatCurrency(r.monto)}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {deleteConfirm === r.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={loading}
                              className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 text-xs rounded bg-[#1C2333] text-gray-400 hover:text-gray-200 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(r.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#1F2937]">
                  <td colSpan={5} className="table-cell text-right text-sm text-gray-400 font-medium">
                    Total del mes ({filtered.length} registros):
                  </td>
                  <td className={`table-cell text-right font-bold ${
                    (filtered.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0) -
                     filtered.filter(r => r.tipo === 'egreso').reduce((s, r) => s + r.monto, 0)) >= 0
                      ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(
                      filtered.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0) -
                      filtered.filter(r => r.tipo === 'egreso').reduce((s, r) => s + r.monto, 0)
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
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
            className="modal-content w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-100">
                {modalMode === 'create' ? 'Nuevo Registro' : 'Editar Registro'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tipo toggle */}
              <div>
                <label className="label">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, tipo: 'ingreso' }))}
                    className={`py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                      formData.tipo === 'ingreso'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#1C2333] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <TrendingUp className="h-4 w-4" />
                    Entrada (Ingreso)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, tipo: 'egreso' }))}
                    className={`py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                      formData.tipo === 'egreso'
                        ? 'bg-red-600 text-white'
                        : 'bg-[#1C2333] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <TrendingDown className="h-4 w-4" />
                    Salida (Egreso)
                  </button>
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="label">Fecha</label>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData((p) => ({ ...p, fecha: e.target.value }))}
                  className="input w-full"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="label">Categoría</label>
                {showNewCategoria ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoria}
                      onChange={(e) => setNewCategoria(e.target.value)}
                      className="input w-full"
                      placeholder="Nueva categoría..."
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCategoria.trim()) setFormData((p) => ({ ...p, categoria: newCategoria.trim() }));
                        setShowNewCategoria(false);
                        setNewCategoria('');
                      }}
                      className="btn-primary text-xs px-3 whitespace-nowrap"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNewCategoria(false); setNewCategoria(''); }}
                      className="btn-secondary text-xs px-3"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                      className="input w-full"
                    >
                      <option value="">— Selecciona categoría —</option>
                      <optgroup label="Entradas">
                        {DEFAULT_CATEGORIAS_ENTRADA.map((c) => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      <optgroup label="Salidas">
                        {DEFAULT_CATEGORIAS_SALIDA.map((c) => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      {allCategorias.filter(
                        (c) => ![...DEFAULT_CATEGORIAS_ENTRADA, ...DEFAULT_CATEGORIAS_SALIDA].includes(c)
                      ).length > 0 && (
                        <optgroup label="Personalizadas">
                          {allCategorias
                            .filter((c) => ![...DEFAULT_CATEGORIAS_ENTRADA, ...DEFAULT_CATEGORIAS_SALIDA].includes(c))
                            .map((c) => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCategoria(true)}
                      className="btn-secondary text-xs px-3 whitespace-nowrap flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Nueva
                    </button>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="label">Descripción *</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
                  className="input w-full"
                  placeholder="Describe el movimiento..."
                />
              </div>

              {/* Monto */}
              <div>
                <label className="label">Monto *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.monto}
                  onChange={(e) => setFormData((p) => ({ ...p, monto: e.target.value }))}
                  className="input w-full"
                  placeholder="0.00"
                />
              </div>

              {/* Referencia */}
              <div>
                <label className="label">Referencia <span className="text-gray-600">(opcional)</span></label>
                <input
                  type="text"
                  value={formData.referencia}
                  onChange={(e) => setFormData((p) => ({ ...p, referencia: e.target.value }))}
                  className="input w-full"
                  placeholder="Núm. factura, recibo, transferencia..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#1F2937]">
              <button onClick={closeModal} className="btn-secondary">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={loading}
                className={`btn-primary ${formData.tipo === 'egreso' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {loading ? 'Guardando...' : modalMode === 'create' ? 'Registrar' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
