'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { formatCurrency, estadoCobroColor, meses } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Search, CreditCard, X, DollarSign, TrendingUp, Users, AlertTriangle, History } from 'lucide-react';
import type { Cliente, Cobro, EstadoCobro, TipoCobro } from '@/types';

interface Props {
  clientes: Cliente[];
  cobros: Cobro[];
}

interface ClienteCobro {
  cliente: Cliente;
  cobro: Cobro | null;
  estado: EstadoCobro;
}

interface ModalData {
  cliente: Cliente;
  cobro: Cobro | null;
}

export default function CobrosClient({ clientes, cobros }: Props) {
  const router = useRouter();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [formMonto, setFormMonto] = useState('');
  const [formTipoPago, setFormTipoPago] = useState<TipoCobro>('efectivo');
  const [formNotas, setFormNotas] = useState('');
  const [formFechaPago, setFormFechaPago] = useState('');
  const [savingModal, setSavingModal] = useState(false);

  // Historial modal
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialCliente, setHistorialCliente] = useState<Cliente | null>(null);
  const [historialCobros, setHistorialCobros] = useState<Cobro[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  const clientesCobros = useMemo<ClienteCobro[]>(() => {
    return clientes.map((cliente) => {
      const cobro = cobros.find(
        (c) => c.cliente_id === cliente.id && c.mes === currentMonth && c.anio === currentYear
      ) ?? null;
      const estado: EstadoCobro = cobro ? cobro.estado : 'pendiente';
      return { cliente, cobro, estado };
    });
  }, [clientes, cobros, currentMonth, currentYear]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clientesCobros;
    const q = search.toLowerCase();
    return clientesCobros.filter((cc) =>
      `${cc.cliente.nombre} ${cc.cliente.apellido}`.toLowerCase().includes(q)
    );
  }, [clientesCobros, search]);

  const stats = useMemo(() => {
    const total = clientesCobros.length;
    const pagados = clientesCobros.filter((cc) => cc.estado === 'pagado').length;
    const enMora = clientesCobros.filter((cc) => cc.estado === 'mora').length;
    const totalRecaudado = clientesCobros
      .filter((cc) => cc.estado === 'pagado' && cc.cobro)
      .reduce((sum, cc) => sum + (cc.cobro?.monto ?? 0), 0);
    const porCobrar = clientesCobros
      .filter((cc) => cc.estado !== 'pagado')
      .reduce((sum, cc) => sum + cc.cliente.monto_mensual, 0);
    const tasaCobro = total > 0 ? Math.round((pagados / total) * 100) : 0;
    return { total, pagados, enMora, totalRecaudado, porCobrar, tasaCobro };
  }, [clientesCobros]);

  function prevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  async function upsertCobro(
    clienteId: string,
    estado: EstadoCobro,
    monto: number,
    tipoPago?: TipoCobro | null,
    notas?: string | null,
    fechaPago?: string | null,
    existingCobroId?: string | null
  ) {
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      cliente_id: clienteId,
      mes: currentMonth,
      anio: currentYear,
      monto,
      estado,
      tipo_pago: tipoPago ?? (estado === 'pagado' ? 'efectivo' : null),
      fecha_pago: fechaPago ?? (estado === 'pagado' ? new Date().toISOString() : null),
      notas: notas ?? null,
    };

    if (existingCobroId) {
      const { error } = await supabase.from('cobros').update(payload).eq('id', existingCobroId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('cobros').insert(payload);
      if (error) throw error;
    }
  }

  async function handleQuickPay(cc: ClienteCobro) {
    const key = `pay-${cc.cliente.id}`;
    setLoading(key);
    try {
      await upsertCobro(
        cc.cliente.id,
        'pagado',
        cc.cliente.monto_mensual,
        'efectivo',
        null,
        new Date().toISOString(),
        cc.cobro?.id
      );
      toast.success(`Cobro registrado para ${cc.cliente.nombre} ${cc.cliente.apellido}`);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrar cobro';
      toast.error(message);
    } finally {
      setLoading(null);
    }
  }

  async function handleQuickMora(cc: ClienteCobro) {
    const key = `mora-${cc.cliente.id}`;
    setLoading(key);
    try {
      await upsertCobro(
        cc.cliente.id,
        'mora',
        0,
        null,
        null,
        null,
        cc.cobro?.id
      );
      toast.success(`${cc.cliente.nombre} ${cc.cliente.apellido} marcado en mora`);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al marcar mora';
      toast.error(message);
    } finally {
      setLoading(null);
    }
  }

  function openModal(cc: ClienteCobro) {
    setModalData({ cliente: cc.cliente, cobro: cc.cobro });
    setFormMonto(cc.cobro?.monto?.toString() ?? cc.cliente.monto_mensual.toString());
    setFormTipoPago((cc.cobro?.tipo_pago as TipoCobro) ?? 'efectivo');
    setFormNotas(cc.cobro?.notas ?? '');
    setFormFechaPago(
      cc.cobro?.fecha_pago
        ? new Date(cc.cobro.fecha_pago).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalData(null);
  }

  async function openHistorial(cliente: Cliente) {
    setHistorialCliente(cliente);
    setHistorialOpen(true);
    setHistorialLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('cobros')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(24);
    setHistorialCobros(data ?? []);
    setHistorialLoading(false);
  }

  function closeHistorial() {
    setHistorialOpen(false);
    setHistorialCliente(null);
    setHistorialCobros([]);
  }

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modalData) return;
    setSavingModal(true);
    try {
      const monto = parseFloat(formMonto);
      if (isNaN(monto) || monto < 0) {
        toast.error('Monto inválido');
        setSavingModal(false);
        return;
      }
      await upsertCobro(
        modalData.cliente.id,
        'pagado',
        monto,
        formTipoPago,
        formNotas || null,
        formFechaPago ? new Date(formFechaPago).toISOString() : new Date().toISOString(),
        modalData.cobro?.id
      );
      toast.success(`Cobro detallado registrado para ${modalData.cliente.nombre} ${modalData.cliente.apellido}`);
      closeModal();
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar cobro';
      toast.error(message);
    } finally {
      setSavingModal(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Cobros</h1>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Pagados</span>
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CreditCard size={16} className="text-emerald-400" />
            </div>
          </div>
          <div className="stat-value">{stats.pagados}/{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Recaudado</span>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <DollarSign size={16} className="text-blue-400" />
            </div>
          </div>
          <div className="stat-value text-lg">{formatCurrency(stats.totalRecaudado)}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Por Cobrar</span>
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertTriangle size={16} className="text-yellow-400" />
            </div>
          </div>
          <div className="stat-value text-lg">{formatCurrency(stats.porCobrar)}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">En Mora</span>
            <div className="p-2 rounded-lg bg-red-500/10">
              <Users size={16} className="text-red-400" />
            </div>
          </div>
          <div className="stat-value">{stats.enMora}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Tasa de Cobro</span>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <TrendingUp size={16} className="text-purple-400" />
            </div>
          </div>
          <div className="stat-value">{stats.tasaCobro}%</div>
        </div>
      </div>

      {/* Month Navigation + Search */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-[#1C2333] transition-colors text-gray-400 hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-lg font-semibold text-white min-w-[200px] text-center">
              {meses[currentMonth - 1]} {currentYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-[#1C2333] transition-colors text-gray-400 hover:text-white"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>
        </div>
      </div>

      {/* Cobros List */}
      <div className="card overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-[1fr_120px_120px_120px_180px] gap-4 px-4 py-3 bg-[#0A0F1E] border-b border-[#1F2937] text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span>Cliente</span>
          <span>Plan</span>
          <span>Monto</span>
          <span>Estado</span>
          <span className="text-right">Acciones</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {search ? 'No se encontraron clientes con ese nombre' : 'No hay clientes activos'}
          </div>
        ) : (
          <div className="divide-y divide-[#1F2937]">
            {filtered.map((cc) => (
              <div
                key={cc.cliente.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_120px_180px] gap-2 md:gap-4 items-center px-4 py-3 hover:bg-[#1C2333] transition-colors"
              >
                {/* Client name */}
                <div>
                  <span className="font-medium text-white">
                    {cc.cliente.nombre} {cc.cliente.apellido}
                  </span>
                  <span className="md:hidden text-xs text-gray-500 ml-2">
                    {cc.cliente.plan ?? 'Sin plan'}
                  </span>
                </div>

                {/* Plan */}
                <div className="hidden md:block text-sm text-gray-400">
                  {cc.cliente.plan ?? 'Sin plan'}
                </div>

                {/* Monto */}
                <div className="text-sm text-gray-300">
                  {formatCurrency(cc.cobro?.monto ?? cc.cliente.monto_mensual)}
                </div>

                {/* Estado badge */}
                <div>
                  <span className={`badge ${estadoCobroColor(cc.estado)}`}>
                    {cc.estado}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 md:justify-end">
                  {cc.estado !== 'pagado' && (
                    <>
                      <button
                        onClick={() => handleQuickPay(cc)}
                        disabled={loading === `pay-${cc.cliente.id}`}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                      >
                        {loading === `pay-${cc.cliente.id}` ? '...' : 'Pagar'}
                      </button>
                      <button
                        onClick={() => handleQuickMora(cc)}
                        disabled={loading === `mora-${cc.cliente.id}`}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                      >
                        {loading === `mora-${cc.cliente.id}` ? '...' : 'Mora'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openModal(cc)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Detalle
                  </button>
                  <button
                    onClick={() => openHistorial(cc.cliente)}
                    className="p-1.5 rounded hover:bg-[#2A3142] text-gray-400 hover:text-blue-400 transition-colors"
                    title="Ver historial de pagos"
                  >
                    <History size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && modalData && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Cobro — {modalData.cliente.nombre} {modalData.cliente.apellido}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {meses[currentMonth - 1]} {currentYear} &middot; Plan: {modalData.cliente.plan ?? 'N/A'} &middot; Mensualidad: {formatCurrency(modalData.cliente.monto_mensual)}
            </p>
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="label">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMonto}
                  onChange={(e) => setFormMonto(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="label">Tipo de Pago</label>
                <select
                  value={formTipoPago}
                  onChange={(e) => setFormTipoPago(e.target.value as TipoCobro)}
                  className="input w-full"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="label">Fecha de Pago</label>
                <input
                  type="date"
                  value={formFechaPago}
                  onChange={(e) => setFormFechaPago(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  className="input w-full"
                  rows={3}
                  placeholder="Notas opcionales..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={savingModal} className="btn-primary">
                  {savingModal ? 'Guardando...' : 'Guardar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Historial */}
      {historialOpen && historialCliente && (
        <div className="modal-overlay" onClick={closeHistorial}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <History size={18} className="text-blue-400" />
                  Historial de Pagos
                </h2>
                <p className="text-sm text-gray-400">{historialCliente.nombre} {historialCliente.apellido} · {historialCliente.plan ?? 'Sin plan'}</p>
              </div>
              <button onClick={closeHistorial} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {historialLoading ? (
              <div className="py-8 text-center text-gray-500 text-sm">Cargando historial...</div>
            ) : historialCobros.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">No hay registros de pago para este cliente</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {historialCobros.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-[#1C2333]">
                    <div>
                      <span className="text-sm font-medium text-white">
                        {meses[(c.mes ?? 1) - 1]} {c.anio}
                      </span>
                      {c.tipo_pago && (
                        <span className="ml-2 text-xs text-gray-500 capitalize">{c.tipo_pago}</span>
                      )}
                      {c.notas && <p className="text-xs text-gray-500 mt-0.5">{c.notas}</p>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-white">{formatCurrency(c.monto)}</div>
                      <span className={`badge text-xs ${estadoCobroColor(c.estado)}`}>{c.estado}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[#1F2937] flex justify-between items-center">
              <span className="text-xs text-gray-500">Mostrando últimos 24 meses</span>
              <button onClick={closeHistorial} className="btn-secondary text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
