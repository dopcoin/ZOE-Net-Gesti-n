'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Conciliacion } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { createConciliacion, getErrorMessage } from '@/lib/services';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { Plus, X, ClipboardCheck, AlertTriangle } from 'lucide-react';

interface MercanciaOption {
  id: string;
  nombre: string;
  stock: number;
}

interface RevendedorOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface Props {
  conciliaciones: Conciliacion[];
  mercancia: MercanciaOption[];
  revendedores: RevendedorOption[];
}

const emptyForm = {
  mercancia_id: '',
  stock_sistema: 0,
  stock_fisico: 0,
  revendedor_id: '',
  notas: '',
};

export default function ConciliacionClient({
  conciliaciones: initial,
  mercancia,
  revendedores,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [conciliaciones, setConciliaciones] = useState<Conciliacion[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const diferencia = formData.stock_fisico - formData.stock_sistema;

  // Stats
  const total = conciliaciones.length;
  const conDiferencia = conciliaciones.filter((c) => c.diferencia !== 0).length;
  const faltantes = conciliaciones.filter((c) => c.diferencia < 0).length;
  const sobrantes = conciliaciones.filter((c) => c.diferencia > 0).length;

  const openCreate = () => {
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  // Escape key handler and body overflow cleanup
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (modalOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [modalOpen]);

  const handleMercanciaChange = (id: string) => {
    const product = mercancia.find((m) => m.id === id);
    setFormData((prev) => ({
      ...prev,
      mercancia_id: id,
      stock_sistema: product ? product.stock : 0,
    }));
  };

  const handleSave = async () => {
    if (!formData.mercancia_id) {
      toast.error('Selecciona un producto');
      return;
    }

    setLoading(true);
    // 'diferencia' es columna GENERATED (cantidad_real - cantidad_esperada) — no incluir
    const payload = {
      mercancia_id: formData.mercancia_id,
      stock_sistema: formData.stock_sistema,
      stock_fisico: formData.stock_fisico,
      cantidad_esperada: formData.stock_sistema,
      cantidad_real: formData.stock_fisico,
      revendedor_id: formData.revendedor_id || null,
      notas: formData.notas || null,
    };

    const result = await createConciliacion(payload);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      setLoading(false);
      return;
    }

    toast.success('Conciliacion registrada');
    closeModal();
    router.refresh();
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este registro de conciliacion?')) return;
    try {
      const { error } = await supabase.from('conciliacion').delete().eq('id', id);
      if (error) throw error;
      setConciliaciones((prev) => prev.filter((c) => c.id !== id));
      toast.success('Registro eliminado');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error(message);
    }
  };

  const diferenciaColor = (d: number) => {
    if (d > 0) return 'text-emerald-400';
    if (d < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Conciliacion</h1>
            <p className="text-sm text-gray-400">Control de inventario fisico vs sistema</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Conciliacion
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-400">Total Registros</p>
          <p className="text-2xl font-bold text-gray-100">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Con Diferencia</p>
          <p className="text-2xl font-bold text-yellow-400">{conDiferencia}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Faltantes</p>
          <p className="text-2xl font-bold text-red-400">{faltantes}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Sobrantes</p>
          <p className="text-2xl font-bold text-emerald-400">{sobrantes}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="table-header">Producto</th>
                <th className="table-header">Stock Sistema</th>
                <th className="table-header">Stock Fisico</th>
                <th className="table-header">Diferencia</th>
                <th className="table-header">Revendedor</th>
                <th className="table-header">Fecha</th>
                <th className="table-header">Notas</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {conciliaciones.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center text-gray-500 py-12">
                    No hay registros de conciliacion
                  </td>
                </tr>
              ) : (
                conciliaciones.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#1F2937] hover:bg-[#1C2333]/50 transition-colors"
                  >
                    <td className="table-cell font-medium text-gray-100">
                      {c.mercancia?.nombre ?? '—'}
                    </td>
                    <td className="table-cell text-gray-300">{c.stock_sistema}</td>
                    <td className="table-cell text-gray-300">{c.stock_fisico}</td>
                    <td className={`table-cell font-semibold ${diferenciaColor(c.diferencia)}`}>
                      {c.diferencia > 0 ? '+' : ''}
                      {c.diferencia}
                    </td>
                    <td className="table-cell text-gray-300">
                      {c.revendedores
                        ? `${c.revendedores.nombre} ${c.revendedores.apellido}`
                        : '—'}
                    </td>
                    <td className="table-cell text-gray-300">{formatDate(c.created_at)}</td>
                    <td className="table-cell text-gray-400 max-w-[200px] truncate">
                      {c.notas ?? '—'}
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Eliminar"
                      >
                        <X className="h-4 w-4" />
                      </button>
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
              <h2 className="text-xl font-bold text-gray-100">Nueva Conciliacion</h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Producto *</label>
                <select
                  value={formData.mercancia_id}
                  onChange={(e) => handleMercanciaChange(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Seleccionar producto</option>
                  {mercancia.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} (Stock: {m.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Stock Sistema</label>
                  <input
                    type="number"
                    value={formData.stock_sistema}
                    readOnly
                    className="input w-full bg-[#1C2333] cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="label">Stock Fisico *</label>
                  <input
                    type="number"
                    value={formData.stock_fisico}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, stock_fisico: Number(e.target.value) }))
                    }
                    className="input w-full"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Diferencia</label>
                  <div
                    className={`input w-full flex items-center font-semibold ${diferenciaColor(diferencia)}`}
                  >
                    {diferencia > 0 ? '+' : ''}
                    {diferencia}
                    {diferencia !== 0 && (
                      <AlertTriangle className="h-4 w-4 ml-2" />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Revendedor (opcional)</label>
                <select
                  value={formData.revendedor_id}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, revendedor_id: e.target.value }))
                  }
                  className="input w-full"
                >
                  <option value="">Sin revendedor</option>
                  {revendedores.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} {r.apellido}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Notas</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
                  rows={3}
                  className="input w-full resize-none"
                  placeholder="Observaciones..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#1F2937]">
              <button onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={loading} className="btn-primary">
                {loading ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
