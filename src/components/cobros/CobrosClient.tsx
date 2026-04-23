'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { formatCurrency, estadoCobroColor, meses } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Search, CreditCard, X, DollarSign, TrendingUp, Users, AlertTriangle, History, Trash2, Plus } from 'lucide-react';
import type { Cliente, Cobro, EstadoCobro, TipoCobro } from '@/types';

interface Props {
  clientes: Cliente[];
  cobros: Cobro[];
  recibidosPor: string[];
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

export default function CobrosClient({ clientes, cobros, recibidosPor: initialRecibidosPor }: Props) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [formMonto, setFormMonto] = useState('');
  const [formEstado, setFormEstado] = useState<EstadoCobro>('pagado');
  const [formTipoPago, setFormTipoPago] = useState<TipoCobro>('efectivo');
  const [formNotas, setFormNotas] = useState('');
  const [formFechaPago, setFormFechaPago] = useState('');
  const [savingModal, setSavingModal] = useState(false);
  const [formRecibidoPor, setFormRecibidoPor] = useState('');
  const [localRecibidosPor, setLocalRecibidosPor] = useState<string[]>([]);
  const [showNewRecibidoPor, setShowNewRecibidoPor] = useState(false);
  const [newRecibidoPor, setNewRecibidoPor] = useState('');
  const [localidadFilter, setLocalidadFilter] = useState<string | null>(null);

  // Historial modal
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialCliente, setHistorialCliente] = useState<Cliente | null>(null);
  const [historialCobros, setHistorialCobros] = useState<Cobro[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  const localidades = useMemo(() => {
    const locs = clientes.map((c) => c.localidad).filter((l): l is string => !!l);
    return Array.from(new Set(locs)).sort();
  }, [clientes]);

  const allRecibidosPor = useMemo(() => {
    return Array.from(new Set([...initialRecibidosPor, ...localRecibidosPor])).sort();
  }, [initialRecibidosPor, localRecibidosPor]);

  const clientesCobros = useMemo<ClienteCobro[]>(() => {
    return clientes
      .filter((cliente) => {
        // If client has a start date, only show them in months >= their start date
        if (cliente.fecha_instalacion) {
          const start = new Date(cliente.fecha_instalacion + 'T00:00:00');
          const startYear = start.getFullYear();
          const startMonth = start.getMonth() + 1;
          if (
            currentYear < startYear ||
            (currentYear === startYear && currentMonth < startMonth)
          ) {
            return false;
          }
        }
        return true;
      })
      .map((cliente) => {
        const cobro = cobros.find(
          (c) => c.cliente_id === cliente.id && c.mes === currentMonth && c.anio === currentYear
        ) ?? null;
        // Becados default to exonerado if no cobro registered
        const defaultEstado: EstadoCobro = (cliente.beca || cliente.estado === 'becado') ? 'exonerado' : 'pendiente';
        const estado: EstadoCobro = cobro ? cobro.estado : defaultEstado;
        return { cliente, cobro, estado };
      });
  }, [clientes, cobros, currentMonth, currentYear]);

  const filtered = useMemo(() => {
    return clientesCobros.filter((cc) => {
      if (localidadFilter && cc.cliente.localidad !== localidadFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!`${cc.cliente.nombre} ${cc.cliente.apellido}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [clientesCobros, search, localidadFilter]);

  const stats = useMemo(() => {
    const total = clientesCobros.length;
    const exonerados = clientesCobros.filter((cc) => cc.estado === 'exonerado').length;
    const pagados = clientesCobros.filter((cc) => cc.estado === 'pagado').length;
    const enMora = clientesCobros.filter((cc) => cc.estado === 'mora').length;
    const totalRecaudado = clientesCobros
      .filter((cc) => cc.estado === 'pagado' && cc.cobro)
      .reduce((sum, cc) => sum + (cc.cobro?.monto ?? 0), 0);
    const porCobrar = clientesCobros
      .filter((cc) => cc.estado !== 'pagado' && cc.estado !== 'exonerado')
      .reduce((sum, cc) => sum + cc.cliente.monto_mensual, 0);
    // Exonerados are resolved — exclude from denominator for tasa de cobro
    const cobrables = total - exonerados;
    const tasaCobro = cobrables > 0 ? Math.round((pagados / cobrables) * 100) : 0;
    return { total, pagados, exonerados, enMora, totalRecaudado, porCobrar, tasaCobro, cobrables };
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

  // Registra un cobro pagado automáticamente en el Libro Diario
  async function eliminarDeLibroDiario(origenId: string, origenTipo: string) {
    const supabase = createClient();
    await supabase.from('libro_diario').delete()
      .eq('origen_id', origenId).eq('origen_tipo', origenTipo);
  }

  async function registrarEnLibroDiario(
    cliente: Cliente,
    monto: number,
    mes: number,
    anio: number,
    fechaPago: string | null,
    cobroId: string | null,
    tipoPago?: TipoCobro | null,
    recibidoPor?: string | null
  ) {
    const fecha = fechaPago
      ? fechaPago.includes('T') ? fechaPago.split('T')[0] : fechaPago
      : new Date().toISOString().split('T')[0];

    const metodo_pago = tipoPago
      ? tipoPago.charAt(0).toUpperCase() + tipoPago.slice(1)
      : null;

    const payload: Record<string, unknown> = {
      fecha,
      tipo: 'ingreso',
      categoria: 'Cobros clientes',
      descripcion: `${cliente.nombre} ${cliente.apellido} — ${meses[mes - 1]} ${anio}`,
      monto,
      referencia: null,
      metodo_pago,
      recibido_en: recibidoPor ?? null,
      origen_id: cobroId,
      origen_tipo: 'cobro',
    };
    if (profile?.id) payload.registrado_por = profile.id;

    const supabase = createClient();
    const { data, error } = await supabase.from('libro_diario').insert(payload).select('id').single();
    if (error) {
      console.error('[LibroDiario] Error al insertar:', JSON.stringify(error));
      toast.error(`⚠ Libro Diario: ${error.message} [${error.code ?? 'sin código'}]`);
    } else {
      console.log('[LibroDiario] Entrada creada:', data?.id);
    }
  }

  async function upsertCobro(
    clienteId: string,
    estado: EstadoCobro,
    monto: number,
    tipoPago?: TipoCobro | null,
    notas?: string | null,
    fechaPago?: string | null,
    existingCobroId?: string | null,
    recibidoPor?: string | null
  ): Promise<string | null> {
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      cliente_id: clienteId,
      mes: currentMonth,
      anio: currentYear,
      monto,
      estado,
      tipo_pago: tipoPago ?? (estado === 'pagado' ? 'efectivo' : null),
      fecha_pago: fechaPago ?? (estado === 'pagado' ? new Date().toISOString() : null),
      recibido_por: recibidoPor ?? null,
      notas: notas ?? null,
    };

    if (existingCobroId) {
      const { error } = await supabase.from('cobros').update(payload).eq('id', existingCobroId);
      if (error) throw error;
      return existingCobroId;
    } else {
      const { data, error } = await supabase.from('cobros').insert(payload).select('id').single();
      if (error) throw error;
      return data?.id ?? null;
    }
  }

  async function handleQuickPay(cc: ClienteCobro) {
    const key = `pay-${cc.cliente.id}`;
    setLoading(key);
    const fechaPago = new Date().toISOString();
    try {
      const cobroId = await upsertCobro(
        cc.cliente.id, 'pagado', cc.cliente.monto_mensual, 'efectivo',
        null, fechaPago, cc.cobro?.id
      );
      // Solo registrar en libro diario si no había cobro pagado antes
      const yaEstabaPagado = cc.cobro?.estado === 'pagado' || cc.cobro?.estado === 'parcial';
      if (!yaEstabaPagado) {
        await registrarEnLibroDiario(cc.cliente, cc.cliente.monto_mensual, currentMonth, currentYear, fechaPago, cobroId, 'efectivo');
      }
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
    setFormEstado((cc.cobro?.estado as EstadoCobro) ?? 'pagado');
    setFormTipoPago((cc.cobro?.tipo_pago as TipoCobro) ?? 'efectivo');
    setFormRecibidoPor(cc.cobro?.recibido_por ?? '');
    setFormNotas(cc.cobro?.notas ?? '');
    setFormFechaPago(
      cc.cobro?.fecha_pago
        ? new Date(cc.cobro.fecha_pago).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setShowNewRecibidoPor(false);
    setNewRecibidoPor('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalData(null);
    setShowNewRecibidoPor(false);
    setNewRecibidoPor('');
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
      const esPago = formEstado === 'pagado' || formEstado === 'parcial';
      const fechaPagoISO = esPago
        ? (formFechaPago ? new Date(formFechaPago).toISOString() : new Date().toISOString())
        : null;

      const cobroId = await upsertCobro(
        modalData.cliente.id, formEstado, monto,
        esPago ? formTipoPago : null, formNotas || null, fechaPagoISO,
        modalData.cobro?.id, esPago ? (formRecibidoPor || null) : null
      );

      const estadoAnterior = modalData.cobro?.estado;
      const eraYaPago = estadoAnterior === 'pagado' || estadoAnterior === 'parcial';

      if (esPago && !eraYaPago) {
        // Transición a pagado → crear entrada
        await registrarEnLibroDiario(
          modalData.cliente, monto, currentMonth, currentYear,
          fechaPagoISO, cobroId, formTipoPago, formRecibidoPor || null
        );
      } else if (!esPago && eraYaPago && modalData.cobro?.id) {
        // Revertido a no-pagado → eliminar entrada
        await eliminarDeLibroDiario(modalData.cobro.id, 'cobro');
      }

      toast.success(`Cobro actualizado para ${modalData.cliente.nombre} ${modalData.cliente.apellido}`);
      closeModal();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err && typeof err === 'object' && 'message' in err) ? (err as {message: string}).message :
        'Error al guardar cobro';
      toast.error(msg);
    } finally {
      setSavingModal(false);
    }
  }

  async function handleDeleteCobro() {
    if (!modalData?.cobro) return;
    if (!window.confirm('¿Eliminar este registro de cobro? El cliente quedará en estado pendiente.')) return;
    setSavingModal(true);
    try {
      const cobroId = modalData.cobro.id;
      const supabase = createClient();
      const { error } = await supabase.from('cobros').delete().eq('id', cobroId);
      if (error) throw error;
      // Eliminar entrada vinculada del libro diario
      await eliminarDeLibroDiario(cobroId, 'cobro');
      toast.success('Cobro eliminado');
      closeModal();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message :
        (err && typeof err === 'object' && 'message' in err) ? (err as {message: string}).message :
        'Error al eliminar cobro';
      toast.error(msg);
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
          <div className="stat-value">{stats.pagados}/{stats.cobrables}</div>
          {stats.exonerados > 0 && (
            <div className="text-xs text-purple-400">{stats.exonerados} exonerados</div>
          )}
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
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-[#1C2333] transition-colors text-gray-400 hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="input py-1.5 pr-8 text-sm font-semibold text-white"
            >
              {meses.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              className="input py-1.5 pr-8 text-sm font-semibold text-white w-24"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
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

        {/* Localidad filter pills */}
        {localidades.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setLocalidadFilter(null)}
              className={`badge cursor-pointer transition-colors ${
                localidadFilter === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1C2333] text-gray-400 hover:bg-[#2A3142]'
              }`}
            >
              Todas las zonas
              <span className="ml-1.5 text-xs opacity-70">{clientesCobros.length}</span>
            </button>
            {localidades.map((loc) => {
              const count = clientesCobros.filter((cc) => cc.cliente.localidad === loc).length;
              return (
                <button
                  key={loc}
                  onClick={() => setLocalidadFilter(loc === localidadFilter ? null : loc)}
                  className={`badge cursor-pointer transition-colors ${
                    localidadFilter === loc
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1C2333] text-gray-400 hover:bg-[#2A3142]'
                  }`}
                >
                  {loc}
                  <span className="ml-1.5 text-xs opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Localidad summary */}
      {localidades.length > 0 && !localidadFilter && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {localidades.map((loc) => {
            const lcc = clientesCobros.filter((cc) => cc.cliente.localidad === loc);
            const pagados = lcc.filter((cc) => cc.estado === 'pagado').length;
            const pendientes = lcc.filter((cc) => cc.estado === 'pendiente' || cc.estado === 'mora').length;
            const recaudado = lcc.filter((cc) => cc.estado === 'pagado' && cc.cobro).reduce((s, cc) => s + (cc.cobro?.monto ?? 0), 0);
            return (
              <button
                key={loc}
                onClick={() => setLocalidadFilter(loc)}
                className="card p-3 text-left hover:bg-[#1C2333] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-white">{loc}</span>
                  <span className="text-xs text-gray-500">{lcc.length} clientes</span>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-400">{pagados} pagados</span>
                  <span className="text-red-400">{pendientes} pendientes</span>
                  <span className="text-blue-400 ml-auto">{formatCurrency(recaudado)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
                  {(cc.cliente.beca || cc.cliente.estado === 'becado') && (
                    <span className="ml-2 badge bg-purple-500/20 text-purple-400 text-xs">Becado</span>
                  )}
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
                  {cc.estado !== 'pagado' && cc.estado !== 'exonerado' && (
                    (cc.cliente.beca || cc.cliente.estado === 'becado') ? (
                      <button
                        onClick={() => upsertCobro(cc.cliente.id, 'exonerado', 0, null, 'Beca aplicada', null, cc.cobro?.id).then(() => { toast.success('Cobro exonerado'); router.refresh(); }).catch(() => toast.error('Error al exonerar'))}
                        disabled={!!loading}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
                      >
                        Exonerar
                      </button>
                    ) : (
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
                    )
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
              {/* Estado */}
              <div>
                <label className="label">Estado</label>
                <select
                  value={formEstado}
                  onChange={(e) => setFormEstado(e.target.value as EstadoCobro)}
                  className="input w-full"
                >
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="mora">Mora</option>
                  <option value="parcial">Parcial</option>
                  <option value="exonerado">Exonerado</option>
                </select>
              </div>
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
              {(formEstado === 'pagado' || formEstado === 'parcial') && (
                <>
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
                    <label className="label">Recibido por <span className="text-gray-600">(opcional)</span></label>
                    {showNewRecibidoPor ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newRecibidoPor}
                          onChange={(e) => setNewRecibidoPor(e.target.value)}
                          className="input w-full"
                          placeholder="Ej: Oficina, Juan, Banco..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = newRecibidoPor.trim();
                              if (val) {
                                setLocalRecibidosPor((p) => Array.from(new Set([...p, val])));
                                setFormRecibidoPor(val);
                              }
                              setShowNewRecibidoPor(false);
                              setNewRecibidoPor('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = newRecibidoPor.trim();
                            if (val) {
                              setLocalRecibidosPor((p) => Array.from(new Set([...p, val])));
                              setFormRecibidoPor(val);
                            }
                            setShowNewRecibidoPor(false);
                            setNewRecibidoPor('');
                          }}
                          className="btn-primary text-xs px-3 whitespace-nowrap"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowNewRecibidoPor(false); setNewRecibidoPor(''); }}
                          className="btn-secondary text-xs px-2"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={formRecibidoPor}
                          onChange={(e) => setFormRecibidoPor(e.target.value)}
                          className="input w-full"
                        >
                          <option value="">— Sin especificar —</option>
                          {allRecibidosPor.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowNewRecibidoPor(true)}
                          className="btn-secondary text-xs px-3 whitespace-nowrap flex items-center gap-1"
                          title="Agregar nuevo"
                        >
                          <Plus size={12} />
                          Nuevo
                        </button>
                      </div>
                    )}
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
                </>
              )}
              <div>
                <label className="label">Notas</label>
                <textarea
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  className="input w-full"
                  rows={2}
                  placeholder="Notas opcionales..."
                />
              </div>
              <div className="flex justify-between items-center pt-2">
                {modalData?.cobro ? (
                  <button
                    type="button"
                    onClick={handleDeleteCobro}
                    disabled={savingModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={13} />
                    Eliminar cobro
                  </button>
                ) : <span />}
                <div className="flex gap-3">
                  <button type="button" onClick={closeModal} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingModal} className="btn-primary">
                    {savingModal ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
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
