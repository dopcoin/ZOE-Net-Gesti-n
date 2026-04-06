'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LibroDiario, TipoMovimiento } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  formatCurrency,
  formatDate,
  categoriasIngreso,
  categoriasEgreso,
} from '@/lib/utils';
import { Plus, X, BookOpen, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  registros: LibroDiario[];
}

const emptyForm = {
  tipo: 'ingreso' as TipoMovimiento,
  categoria: '',
  descripcion: '',
  monto: 0,
  referencia: '',
};

export default function LibroDiarioClient({ registros: initial }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [registros, setRegistros] = useState<LibroDiario[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedRegistro, setSelectedRegistro] = useState<LibroDiario | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  // Stats
  const totalIngresos = registros
    .filter((r) => r.tipo === 'ingreso')
    .reduce((sum, r) => sum + r.monto, 0);
  const totalEgresos = registros
    .filter((r) => r.tipo === 'egreso')
    .reduce((sum, r) => sum + r.monto, 0);
  const balance = totalIngresos - totalEgresos;

  const categorias = formData.tipo === 'ingreso' ? categoriasIngreso : categoriasEgreso;

  const openCreate = () => {
    setFormData(emptyForm);
    setSelectedRegistro(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = (registro: LibroDiario) => {
    setSelectedRegistro(registro);
    setFormData({
      tipo: registro.tipo,
      categoria: registro.categoria,
      descripcion: registro.descripcion,
      monto: registro.monto,
      referencia: registro.referencia ?? '',
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRegistro(null);
  };

  const handleSave = async () => {
    if (!formData.categoria || !formData.descripcion.trim() || formData.monto <= 0) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        tipo: formData.tipo,
        categoria: formData.categoria,
        descripcion: formData.descripcion,
        monto: formData.monto,
        referencia: formData.referencia || null,
      };

      if (modalMode === 'create') {
        const { data, error } = await supabase
          .from('libro_diario')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        setRegistros((prev) => [data, ...prev]);
        toast.success('Registro creado exitosamente');
      } else if (selectedRegistro) {
        const { data, error } = await supabase
          .from('libro_diario')
          .update(payload)
          .eq('id', selectedRegistro.id)
          .select()
          .single();
        if (error) throw error;
        setRegistros((prev) => prev.map((r) => (r.id === data.id ? data : r)));
        toast.success('Registro actualizado exitosamente');
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

  const handleDelete = async (registro: LibroDiario) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    try {
      const { error } = await supabase.from('libro_diario').delete().eq('id', registro.id);
      if (error) throw error;
      setRegistros((prev) => prev.filter((r) => r.id !== registro.id));
      toast.success('Registro eliminado');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error(message);
    }
  };

  const balancePercent =
    totalIngresos + totalEgresos > 0
      ? (totalIngresos / (totalIngresos + totalEgresos)) * 100
      : 50;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Libro Diario</h1>
            <p className="text-sm text-gray-400">Registro de ingresos y egresos</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Registro
        </button>
      </div>

      {/* Balance bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Balance General</span>
          <span
            className={`text-lg font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {formatCurrency(balance)}
          </span>
        </div>
        <div className="w-full bg-[#1C2333] rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(Math.max(balancePercent, 0), 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>Ingresos: {formatCurrency(totalIngresos)}</span>
          <span>Egresos: {formatCurrency(totalEgresos)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <p className="text-sm text-gray-400">Total Ingresos</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <p className="text-sm text-gray-400">Total Egresos</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-blue-400" />
            <p className="text-sm text-gray-400">Balance</p>
          </div>
          <p
            className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {formatCurrency(balance)}
          </p>
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
                <th className="table-header">Categoria</th>
                <th className="table-header">Descripcion</th>
                <th className="table-header">Monto</th>
                <th className="table-header">Referencia</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-gray-500 py-12">
                    No hay registros en el libro diario
                  </td>
                </tr>
              ) : (
                registros.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[#1F2937] hover:bg-[#1C2333]/50 transition-colors"
                  >
                    <td className="table-cell text-gray-300">{formatDate(r.created_at)}</td>
                    <td className="table-cell">
                      <span
                        className={`badge ${
                          r.tipo === 'ingreso'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {r.tipo}
                      </span>
                    </td>
                    <td className="table-cell text-gray-300">{r.categoria}</td>
                    <td className="table-cell text-gray-300 max-w-[250px] truncate">
                      {r.descripcion}
                    </td>
                    <td
                      className={`table-cell font-semibold ${
                        r.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {r.tipo === 'ingreso' ? '+' : '-'}
                      {formatCurrency(r.monto)}
                    </td>
                    <td className="table-cell text-gray-400">{r.referencia ?? '—'}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Eliminar"
                        >
                          <X className="h-4 w-4" />
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
          <div className="modal-content w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-100">
                {modalMode === 'create' ? 'Nuevo Registro' : 'Editar Registro'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tipo toggle */}
              <div>
                <label className="label">Tipo *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, tipo: 'ingreso', categoria: '' }))
                    }
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      formData.tipo === 'ingreso'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-[#1F2937] bg-[#1C2333] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <TrendingUp className="h-4 w-4 inline mr-2" />
                    Ingreso
                  </button>
                  <button
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, tipo: 'egreso', categoria: '' }))
                    }
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                      formData.tipo === 'egreso'
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-[#1F2937] bg-[#1C2333] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <TrendingDown className="h-4 w-4 inline mr-2" />
                    Egreso
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Categoria *</label>
                <select
                  value={formData.categoria}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, categoria: e.target.value }))
                  }
                  className="input w-full"
                >
                  <option value="">Seleccionar categoria</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Descripcion *</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="Descripcion del movimiento"
                />
              </div>

              <div>
                <label className="label">Monto *</label>
                <input
                  type="number"
                  value={formData.monto}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, monto: Number(e.target.value) }))
                  }
                  className="input w-full"
                  placeholder="0"
                  min={0}
                />
              </div>

              <div>
                <label className="label">Referencia</label>
                <input
                  type="text"
                  value={formData.referencia}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, referencia: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="Numero de recibo, factura, etc."
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
                    ? 'Crear Registro'
                    : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
