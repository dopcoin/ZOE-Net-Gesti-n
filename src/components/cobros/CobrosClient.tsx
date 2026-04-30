'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { formatCurrency, estadoCobroColor, meses } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Search, CreditCard, X, DollarSign, TrendingUp, Users, AlertTriangle, History, Trash2, Plus, Banknote, FileText, Wallet, ArrowRightLeft } from 'lucide-react';
import type { Cliente, Cobro, EstadoCobro, TipoCobro } from '@/types';

// Etiquetas visuales para los estados de cobro (en BD se guardan como en el tipo)
const ESTADO_LABEL: Record<EstadoCobro, string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  mora: 'Mora',
  exonerado: 'Exonerado',
  parcial: 'Parcial',
  condonado: 'Remitido',
};

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

  // Menú de remisión (dropdown) por fila
  const [remisionMenuFor, setRemisionMenuFor] = useState<string | null>(null);

  // Bulk selection — clientes seleccionados para acciones en masa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTipoPago, setBulkTipoPago] = useState<TipoCobro>('efectivo');
  const [bulkRecibidoPor, setBulkRecibidoPor] = useState('Rodeo');
  const [bulkSaving, setBulkSaving] = useState(false);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllPendientes() {
    const pendientesIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      filtered
        .filter((cc) => cc.estado === 'pendiente' || cc.estado === 'mora')
        .map((cc) => cc.cliente.id)
    );
    setSelectedIds(pendientesIds);
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function aplicarBulkPago() {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    let exitos = 0, errores = 0;

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const seleccionados = filtered.filter((cc) => selectedIds.has(cc.cliente.id));

    for (const cc of seleccionados) {
      try {
        const cobroId = await upsertCobro(
          cc.cliente.id,
          'pagado',
          cc.cliente.monto_mensual,
          bulkTipoPago,
          null,
          new Date().toISOString(),
          cc.cobro?.id,
          bulkRecibidoPor,
        );
        // Si era no-pagado, registrar en libro diario
        if (cc.estado !== 'pagado' && cc.estado !== 'parcial') {
          await registrarEnLibroDiario(
            cc.cliente,
            cc.cliente.monto_mensual,
            currentMonth,
            currentYear,
            new Date().toISOString(),
            cobroId,
            bulkTipoPago,
            bulkRecibidoPor,
          );
        }
        exitos++;
      } catch (err) {
        console.error('[bulk] error con', cc.cliente.nombre, err);
        errores++;
      }
    }

    setBulkSaving(false);
    setBulkModalOpen(false);
    clearSelection();
    if (exitos > 0) toast.success(`${exitos} cobro${exitos > 1 ? 's' : ''} marcado${exitos > 1 ? 's' : ''} como pagado${exitos > 1 ? 's' : ''}`);
    if (errores > 0) toast.error(`${errores} fallaron — ver consola`);
    router.refresh();
  }

  // Aplica una remisión con porcentaje (20/30/50/100)
  // 100% → cliente no paga (estado condonado, monto 0)
  // <100% → pago parcial (estado parcial, monto = mensual × (1 - %))
  async function aplicarRemision(cc: ClienteCobro, porcentajeRemision: number) {
    setRemisionMenuFor(null);
    const mensual = cc.cliente.monto_mensual;
    const montoARemitir = mensual * (porcentajeRemision / 100);
    const montoAPagar = Math.max(0, mensual - montoARemitir);

    const isTotal = porcentajeRemision >= 100;
    const estado: EstadoCobro = isTotal ? 'condonado' : 'parcial';
    const nota = isTotal
      ? `Remisión total (100%) por cortes/falla de servicio`
      : `Remisión ${porcentajeRemision}% (descuento RD$${montoARemitir.toFixed(2)}) por cortes/falla`;

    if (!confirm(
      isTotal
        ? `¿Remitir totalmente (100%) el cobro de ${cc.cliente.nombre}?\nEl cliente NO paga este mes.`
        : `¿Remitir ${porcentajeRemision}% a ${cc.cliente.nombre}?\n\nMensual: RD$${mensual.toFixed(2)}\nDescuento: RD$${montoARemitir.toFixed(2)} (${porcentajeRemision}%)\nA pagar: RD$${montoAPagar.toFixed(2)}`
    )) return;

    setLoading(`condonar-${cc.cliente.id}`);
    try {
      await upsertCobro(
        cc.cliente.id,
        estado,
        montoAPagar,
        null,
        nota,
        null,
        cc.cobro?.id,
      );
      toast.success(isTotal ? 'Cobro remitido al 100%' : `Remisión ${porcentajeRemision}% aplicada`);
      router.refresh();
    } catch (err: unknown) {
      // Extraer mensaje legible (puede ser Error, ServiceError, o un objeto Supabase)
      let msg = '';
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>;
        msg = (e.message as string) || (e.details as string) || (e.hint as string) || JSON.stringify(err);
      } else {
        msg = String(err);
      }
      // Detectar el constraint violation de 'condonado'
      if (msg.includes('cobros_estado_check') || msg.includes('check constraint') || msg.includes('violates check')) {
        toast.error(
          'La BD aún no acepta el estado "condonado/remitido". Falta ejecutar el SQL de migración pendiente.',
          { duration: 8000 }
        );
      } else {
        toast.error(`Error al aplicar la remisión: ${msg}`);
      }
    } finally {
      setLoading(null);
    }
  }

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
        if (!`${cc.cliente.nombre || ''} ${cc.cliente.apellido || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [clientesCobros, search, localidadFilter]);

  const stats = useMemo(() => {
    const total = clientesCobros.length;
    const exonerados = clientesCobros.filter((cc) => cc.estado === 'exonerado').length;
    const condonados = clientesCobros.filter((cc) => cc.estado === 'condonado').length;
    const pagados = clientesCobros.filter((cc) => cc.estado === 'pagado').length;
    const parciales = clientesCobros.filter((cc) => cc.estado === 'parcial').length;
    const enMora = clientesCobros.filter((cc) => cc.estado === 'mora').length;
    const totalRecaudado = clientesCobros
      .filter((cc) => (cc.estado === 'pagado' || cc.estado === 'parcial') && cc.cobro)
      .reduce((sum, cc) => sum + (cc.cobro?.monto ?? 0), 0);
    // Por cobrar: NO incluye pagados, exonerados, condonados ni parciales (parciales tienen su propio monto)
    const porCobrar = clientesCobros
      .filter((cc) => cc.estado === 'pendiente' || cc.estado === 'mora')
      .reduce((sum, cc) => sum + cc.cliente.monto_mensual, 0);
    // Exonerados y condonados son "resueltos" — no cuentan para tasa de cobro
    const cobrables = total - exonerados - condonados;
    const tasaCobro = cobrables > 0 ? Math.round(((pagados + parciales) / cobrables) * 100) : 0;

    // === Desglose por tipo de pago ===
    // Detecta cheques aunque vengan como tipo_pago='transferencia' (legacy del sheet)
    // mediante el texto "cheque" en recibido_por.
    const porTipoPago: Record<'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro', number> = {
      efectivo: 0, transferencia: 0, cheque: 0, tarjeta: 0, otro: 0,
    };
    const porReceptor: Record<string, number> = {};
    clientesCobros.forEach((cc) => {
      if (!cc.cobro || (cc.estado !== 'pagado' && cc.estado !== 'parcial')) return;
      const monto = cc.cobro.monto ?? 0;
      const tp = (cc.cobro.tipo_pago ?? 'otro') as keyof typeof porTipoPago;
      const recibidoPor = (cc.cobro.recibido_por ?? '').trim();
      const recibidoLower = recibidoPor.toLowerCase();

      // Cheque detection: si recibido_por dice "cheque", se reclasifica a cheque
      if (recibidoLower.includes('cheque')) {
        porTipoPago.cheque += monto;
      } else if (porTipoPago[tp] !== undefined) {
        porTipoPago[tp] += monto;
      } else {
        porTipoPago.otro += monto;
      }

      // Por receptor (quien recolectó)
      const key = recibidoPor || '— Sin especificar —';
      porReceptor[key] = (porReceptor[key] ?? 0) + monto;
    });

    return {
      total, pagados, parciales, exonerados, condonados, enMora,
      totalRecaudado, porCobrar, tasaCobro, cobrables,
      porTipoPago, porReceptor,
    };
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

  function loadFormFromClienteCobro(cc: ClienteCobro) {
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
  }

  function openModal(cc: ClienteCobro) {
    loadFormFromClienteCobro(cc);
    setModalOpen(true);
  }

  // Navegación entre clientes dentro del modal (flecha izquierda/derecha)
  const currentModalIndex = useMemo(() => {
    if (!modalData) return -1;
    return filtered.findIndex((cc) => cc.cliente.id === modalData.cliente.id);
  }, [filtered, modalData]);

  function navigateModal(direction: 'prev' | 'next') {
    if (currentModalIndex === -1 || filtered.length === 0) return;
    const newIndex = direction === 'next'
      ? Math.min(currentModalIndex + 1, filtered.length - 1)
      : Math.max(currentModalIndex - 1, 0);
    if (newIndex === currentModalIndex) return;
    loadFormFromClienteCobro(filtered[newIndex]);
  }

  // Keyboard shortcuts dentro del modal: ←/→ navegar, Esc cerrar
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Si el foco está en un input/textarea/select, no interceptar (excepto Escape)
      const tag = (e.target as HTMLElement)?.tagName;
      const isFormField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        closeModal();
      } else if (!isFormField && e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateModal('prev');
      } else if (!isFormField && e.key === 'ArrowRight') {
        e.preventDefault();
        navigateModal('next');
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, currentModalIndex, filtered.length]);

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

      {/* Recaudación por tipo de pago + receptor */}
      {stats.totalRecaudado > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Por tipo de pago */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Por tipo de pago</h3>
              </div>
              <span className="text-xs text-gray-500">
                {meses[currentMonth - 1]} {currentYear}
              </span>
            </div>
            <div className="space-y-2">
              {([
                { key: 'efectivo' as const,      label: 'Efectivo',      icon: Banknote,       bg: 'bg-emerald-500/10', text: 'text-emerald-400', bar: 'bg-emerald-500' },
                { key: 'transferencia' as const, label: 'Transferencia', icon: ArrowRightLeft, bg: 'bg-blue-500/10',    text: 'text-blue-400',    bar: 'bg-blue-500' },
                { key: 'cheque' as const,        label: 'Cheque',        icon: FileText,       bg: 'bg-purple-500/10',  text: 'text-purple-400',  bar: 'bg-purple-500' },
                { key: 'tarjeta' as const,       label: 'Tarjeta',       icon: CreditCard,     bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    bar: 'bg-cyan-500' },
                { key: 'otro' as const,          label: 'Otro',          icon: DollarSign,     bg: 'bg-gray-500/10',    text: 'text-gray-400',    bar: 'bg-gray-500' },
              ]).map((tp) => {
                const monto = stats.porTipoPago[tp.key];
                const pct = stats.totalRecaudado > 0 ? (monto / stats.totalRecaudado) * 100 : 0;
                if (monto === 0 && tp.key !== 'efectivo' && tp.key !== 'transferencia') return null;
                const Icon = tp.icon;
                return (
                  <div key={tp.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded ${tp.bg} flex-shrink-0`}>
                          <Icon size={12} className={tp.text} />
                        </div>
                        <span className="text-sm text-gray-300">{tp.label}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-sm font-bold font-mono tabular ${tp.text}`}>
                          {formatCurrency(monto)}
                        </span>
                        <span className="text-[10px] text-gray-500 ml-2 tabular">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-[#1C2333] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${tp.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-[#1F2937] flex items-center justify-between">
              <span className="text-sm text-gray-400">Total recaudado</span>
              <span className="text-base font-bold font-mono tabular text-white">{formatCurrency(stats.totalRecaudado)}</span>
            </div>
          </div>

          {/* Por receptor */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Por receptor</h3>
              </div>
              <span className="text-xs text-gray-500">Quien recolectó</span>
            </div>
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {Object.entries(stats.porReceptor)
                .sort((a, b) => b[1] - a[1])
                .map(([receptor, monto]) => {
                  const pct = stats.totalRecaudado > 0 ? (monto / stats.totalRecaudado) * 100 : 0;
                  return (
                    <div key={receptor} className="flex items-center justify-between p-2 rounded-lg bg-[#1C2333]/50 border border-[#1F2937]">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-400 flex-shrink-0">
                          {receptor.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-200 truncate">{receptor}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-sm font-bold font-mono tabular text-emerald-400">{formatCurrency(monto)}</div>
                        <div className="text-[10px] text-gray-500 tabular">{pct.toFixed(0)}%</div>
                      </div>
                    </div>
                  );
                })}
              {Object.keys(stats.porReceptor).length === 0 && (
                <div className="text-center text-sm text-gray-500 py-6">Sin pagos registrados</div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Bulk Action Bar — visible cuando hay seleccionados */}
      {selectedIds.size > 0 && (
        <div className="sticky top-14 z-20 card p-3 sm:p-4 bg-blue-500/10 border-blue-500/30 animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-bold tabular">
              {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
            </div>
            <div className="text-sm text-gray-300">
              Total a cobrar:{' '}
              <span className="font-bold text-blue-400 tabular">
                {formatCurrency(
                  filtered
                    .filter((cc) => selectedIds.has(cc.cliente.id))
                    .reduce((s, cc) => s + cc.cliente.monto_mensual, 0)
                )}
              </span>
            </div>
            <button
              onClick={clearSelection}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Limpiar
            </button>
          </div>
          <button
            onClick={() => setBulkModalOpen(true)}
            className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            ✓ Marcar todos como pagados
          </button>
        </div>
      )}

      {/* Cobros List */}
      <div className="card overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-[28px_1.5fr_110px_110px_120px_300px] gap-4 px-4 py-3 bg-[#0A0F1E] border-b border-[#1F2937] text-xs font-medium text-gray-500 uppercase tracking-wider items-center">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-[#1F2937] bg-[#1C2333] text-blue-600 focus:ring-blue-500 cursor-pointer"
            checked={selectedIds.size > 0 && selectedIds.size === filtered.filter(cc => cc.estado === 'pendiente' || cc.estado === 'mora').length}
            onChange={(e) => e.target.checked ? selectAllPendientes() : clearSelection()}
            title="Seleccionar todos los pendientes/mora"
          />
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
            {filtered.map((cc) => {
              const canSelect = cc.estado !== 'pagado' && cc.estado !== 'exonerado' && cc.estado !== 'condonado';
              return (
              <div
                key={cc.cliente.id}
                className={`grid grid-cols-1 md:grid-cols-[28px_1.5fr_110px_110px_120px_300px] gap-2 md:gap-4 items-center px-4 py-3 transition-colors ${
                  selectedIds.has(cc.cliente.id) ? 'bg-blue-500/5 hover:bg-blue-500/10' : 'hover:bg-[#1C2333]'
                }`}
              >
                {/* Checkbox bulk-select */}
                <div className="hidden md:flex items-center">
                  {canSelect ? (
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[#1F2937] bg-[#1C2333] text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={selectedIds.has(cc.cliente.id)}
                      onChange={() => toggleSelected(cc.cliente.id)}
                    />
                  ) : (
                    <span className="w-4 h-4 inline-block opacity-30" />
                  )}
                </div>

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
                  <span className={`badge ${estadoCobroColor(cc.estado)} whitespace-nowrap`}>
                    {ESTADO_LABEL[cc.estado] ?? cc.estado}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 md:justify-end">
                  {cc.estado !== 'pagado' && cc.estado !== 'exonerado' && cc.estado !== 'condonado' && (
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
                        {/* Botón Remitir con dropdown de porcentajes */}
                        <div className="relative">
                          <button
                            onClick={() => setRemisionMenuFor(remisionMenuFor === cc.cliente.id ? null : cc.cliente.id)}
                            disabled={loading === `condonar-${cc.cliente.id}`}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                            title="Remitir cobro (cortes/falla de servicio)"
                          >
                            {loading === `condonar-${cc.cliente.id}` ? '...' : (
                              <>
                                Remitir
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                              </>
                            )}
                          </button>

                          {remisionMenuFor === cc.cliente.id && (
                            <>
                              {/* Backdrop para cerrar al hacer click fuera */}
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setRemisionMenuFor(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg bg-[#1C2333] border border-cyan-500/30 shadow-2xl overflow-hidden animate-fade-in">
                                <div className="px-3 py-2 bg-cyan-500/10 border-b border-cyan-500/20">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                                    Remitir descuento
                                  </div>
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    Mensual: {formatCurrency(cc.cliente.monto_mensual)}
                                  </div>
                                </div>
                                {[20, 30, 50, 100].map((pct) => {
                                  const descuento = cc.cliente.monto_mensual * (pct / 100);
                                  const aPagar = cc.cliente.monto_mensual - descuento;
                                  return (
                                    <button
                                      key={pct}
                                      onClick={() => aplicarRemision(cc, pct)}
                                      className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-cyan-500/10 transition-colors border-b border-[#1F2937] last:border-b-0"
                                    >
                                      <div>
                                        <div className="text-sm font-semibold text-cyan-400">
                                          {pct}%
                                          {pct === 100 && <span className="ml-1 text-[10px] font-normal opacity-70">(total)</span>}
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                          Descuento {formatCurrency(descuento)}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-[10px] text-gray-500">Paga</div>
                                        <div className="text-xs font-bold font-mono tabular text-gray-200">
                                          {formatCurrency(aPagar)}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
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
                  {/* WhatsApp recordatorio — solo si está pendiente/mora y tiene teléfono */}
                  {(cc.estado === 'pendiente' || cc.estado === 'mora' || cc.estado === 'parcial') && cc.cliente.telefono && (
                    <button
                      onClick={() => {
                        const tel = (cc.cliente.telefono ?? '').replace(/\D/g, '');
                        const telWA = tel.startsWith('1') || tel.startsWith('+') ? tel : `1${tel}`;
                        const mensaje = `Hola ${cc.cliente.nombre}, te saludamos de *ZOE Net Internet*. Te recordamos tu pago del mes de *${meses[currentMonth - 1]} ${currentYear}* por *${formatCurrency(cc.cliente.monto_mensual)}*.${cc.estado === 'mora' ? '\n\nTu cuenta está atrasada — por favor regulariza para evitar interrupción del servicio.' : ''}\n\nGracias por tu preferencia. 📡`;
                        const url = `https://wa.me/${telWA}?text=${encodeURIComponent(mensaje)}`;
                        window.open(url, '_blank');
                      }}
                      className="p-1.5 rounded hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors"
                      title={`Recordar pago por WhatsApp · ${cc.cliente.telefono}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
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
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Pago Modal */}
      {bulkModalOpen && (
        <div className="modal-overlay" onClick={() => !bulkSaving && setBulkModalOpen(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="px-5 py-4 border-b border-[#1F2937] flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-100">
                ✓ Marcar {selectedIds.size} como pagados
              </h2>
              {!bulkSaving && (
                <button onClick={() => setBulkModalOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#1C2333]">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total a recibir</div>
                <div className="text-3xl font-bold font-mono tabular text-blue-400">
                  {formatCurrency(
                    filtered.filter((cc) => selectedIds.has(cc.cliente.id))
                      .reduce((s, cc) => s + cc.cliente.monto_mensual, 0)
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {selectedIds.size} cobro{selectedIds.size > 1 ? 's' : ''} de {meses[currentMonth - 1]} {currentYear}
                </div>
              </div>

              <div>
                <label className="label">Tipo de pago</label>
                <select
                  value={bulkTipoPago}
                  onChange={(e) => setBulkTipoPago(e.target.value as TipoCobro)}
                  className="input"
                  disabled={bulkSaving}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="label">Recibido por</label>
                <input
                  type="text"
                  value={bulkRecibidoPor}
                  onChange={(e) => setBulkRecibidoPor(e.target.value)}
                  className="input"
                  placeholder="Nombre del cobrador"
                  disabled={bulkSaving}
                  list="bulk-recibidos-por-list"
                />
                <datalist id="bulk-recibidos-por-list">
                  {allRecibidosPor.map((r) => <option key={r} value={r} />)}
                </datalist>
              </div>

              {/* Lista de clientes seleccionados */}
              <div className="max-h-[200px] overflow-y-auto border border-[#1F2937] rounded-lg divide-y divide-[#1F2937]">
                {filtered
                  .filter((cc) => selectedIds.has(cc.cliente.id))
                  .map((cc) => (
                    <div key={cc.cliente.id} className="p-2.5 flex items-center justify-between text-sm">
                      <span className="text-gray-200 truncate">
                        {cc.cliente.nombre} {cc.cliente.apellido}
                      </span>
                      <span className="font-mono tabular text-gray-300 ml-2 flex-shrink-0">
                        {formatCurrency(cc.cliente.monto_mensual)}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-md p-2">
                ⚠ Esta acción registra todos como <strong>pagados</strong> con fecha de hoy y crea entradas en el Libro Diario.
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#1F2937] flex items-center justify-end gap-3">
              <button onClick={() => setBulkModalOpen(false)} className="btn-secondary" disabled={bulkSaving}>
                Cancelar
              </button>
              <button onClick={aplicarBulkPago} className="btn-primary" disabled={bulkSaving}>
                {bulkSaving ? `Guardando...` : `Confirmar ${selectedIds.size} pago${selectedIds.size > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && modalData && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            {/* Header con navegación entre clientes */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => navigateModal('prev')}
                disabled={currentModalIndex <= 0}
                className="p-2 rounded-lg bg-[#1C2333] hover:bg-[#2A3142] text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                title="Cliente anterior (← flecha izquierda)"
                aria-label="Cliente anterior"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex-1 text-center min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                  {modalData.cliente.nombre} {modalData.cliente.apellido}
                </h2>
                {currentModalIndex >= 0 && (
                  <div className="text-[11px] text-gray-500 tabular">
                    {currentModalIndex + 1} de {filtered.length}
                  </div>
                )}
              </div>

              <button
                onClick={() => navigateModal('next')}
                disabled={currentModalIndex >= filtered.length - 1}
                className="p-2 rounded-lg bg-[#1C2333] hover:bg-[#2A3142] text-gray-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                title="Cliente siguiente (→ flecha derecha)"
                aria-label="Cliente siguiente"
              >
                <ChevronRight size={18} />
              </button>

              <button onClick={closeModal} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-[#1C2333] transition-colors flex-shrink-0 ml-1" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-400 mb-4 text-center">
              {meses[currentMonth - 1]} {currentYear} &middot; Plan: {modalData.cliente.plan ?? 'N/A'} &middot; Mensualidad: {formatCurrency(modalData.cliente.monto_mensual)}
            </p>

            {/* Tip de atajos */}
            <div className="text-[10px] text-gray-600 text-center mb-3 hidden sm:block">
              💡 Usa <kbd className="px-1.5 py-0.5 rounded bg-[#1C2333] border border-[#1F2937] text-gray-400">←</kbd> y <kbd className="px-1.5 py-0.5 rounded bg-[#1C2333] border border-[#1F2937] text-gray-400">→</kbd> para navegar entre clientes
            </div>
            <form onSubmit={handleModalSubmit} className="space-y-4">
              {/* Estado */}
              <div>
                <label className="label">Estado</label>
                <select
                  value={formEstado}
                  onChange={(e) => {
                    const newEstado = e.target.value as EstadoCobro;
                    setFormEstado(newEstado);
                    // Auto-llenar monto según el estado
                    if (newEstado === 'condonado' || newEstado === 'exonerado') {
                      setFormMonto('0');
                    } else if (newEstado === 'pagado' || newEstado === 'pendiente' || newEstado === 'mora') {
                      // Si está vacío o era 0, llenar con monto mensual
                      if (!formMonto || formMonto === '0') {
                        setFormMonto(String(modalData?.cliente.monto_mensual ?? 0));
                      }
                    }
                  }}
                  className="input w-full"
                >
                  <option value="pagado">✅ Pagado</option>
                  <option value="parcial">🔵 Parcial (pago reducido)</option>
                  <option value="pendiente">⏳ Pendiente</option>
                  <option value="mora">⚠️ Mora</option>
                  <option value="condonado">🌀 Remitido (cortes/falla servicio)</option>
                  <option value="exonerado">🎓 Exonerado (becado)</option>
                </select>
                {formEstado === 'condonado' && (
                  <p className="text-[11px] text-cyan-400 mt-1.5 flex items-start gap-1">
                    <span>💡</span>
                    <span>Remisión total: el cliente NO paga este mes por cortes o falla de servicio. Para remisión parcial (20/30/50%) usa el botón &quot;Remitir&quot; en la fila o cambia el estado a &quot;Parcial&quot; con el monto reducido.</span>
                  </p>
                )}
              </div>
              <div>
                <label className="label">
                  Monto
                  {(formEstado === 'condonado' || formEstado === 'exonerado') && (
                    <span className="text-[10px] text-gray-500 ml-2">(no aplica)</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMonto}
                  onChange={(e) => setFormMonto(e.target.value)}
                  className="input w-full"
                  disabled={formEstado === 'condonado' || formEstado === 'exonerado'}
                  required={formEstado !== 'condonado' && formEstado !== 'exonerado'}
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
