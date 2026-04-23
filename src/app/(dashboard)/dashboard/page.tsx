import { createClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Rango de los últimos 6 meses (para tendencias)
  const sixMonthsAgo = new Date(currentYear, now.getMonth() - 5, 1).toISOString().split('T')[0];

  // Mes anterior para comparaciones
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const [
    { count: totalClientes },
    { count: clientesActivos },
    { data: cobrosDelMes },
    { data: cobrosMesAnterior },
    { count: instalacionesPendientes },
    { count: tareasPendientes },
    { data: ultimaActividad },
    { data: ventasDelMes },
    { data: ventasMesAnterior },
    { data: libroDiarioReciente },
    { data: cobrosVencidos },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
    supabase.from('cobros').select('monto, estado, fecha_pago, created_at').eq('mes', currentMonth).eq('anio', currentYear),
    supabase.from('cobros').select('monto, estado').eq('mes', prevMonth).eq('anio', prevYear),
    supabase.from('instalaciones').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('completada', false),
    supabase.from('activity_log').select('*, profiles(nombre, apellido)').order('created_at', { ascending: false }).limit(8),
    supabase.from('ventas').select('total, ganancia, created_at').eq('estado', 'completada').gte('created_at', new Date(currentYear, now.getMonth(), 1).toISOString()),
    supabase.from('ventas').select('total, ganancia').eq('estado', 'completada').gte('created_at', new Date(prevYear, prevMonth - 1, 1).toISOString()).lt('created_at', new Date(currentYear, now.getMonth(), 1).toISOString()),
    supabase.from('libro_diario').select('fecha, tipo, monto').gte('fecha', sixMonthsAgo).order('fecha', { ascending: true }),
    // Cobros no pagados de meses anteriores (aging)
    supabase.from('cobros').select('monto, mes, anio, estado').in('estado', ['pendiente', 'mora', 'parcial']),
  ]);

  // === Cálculos del mes actual ===
  const cobrosPagados = cobrosDelMes?.filter(c => c.estado === 'pagado') || [];
  const cobrosExonerados = cobrosDelMes?.filter(c => c.estado === 'exonerado') || [];
  const totalRecaudadoMes = cobrosPagados.reduce((s, c) => s + (c.monto || 0), 0);
  const totalPorCobrarMes = (cobrosDelMes || []).filter(c => c.estado === 'pendiente' || c.estado === 'mora' || c.estado === 'parcial').reduce((s, c) => s + (c.monto || 0), 0);
  const cobrablesMes = (cobrosDelMes?.length || 0) - cobrosExonerados.length;
  const tasaCobro = cobrablesMes > 0 ? (cobrosPagados.length / cobrablesMes) * 100 : 0;

  // Mes anterior
  const cobrosPagadosPrev = cobrosMesAnterior?.filter(c => c.estado === 'pagado') || [];
  const totalRecaudadoPrev = cobrosPagadosPrev.reduce((s, c) => s + (c.monto || 0), 0);
  const ventasTotalMes = ventasDelMes?.reduce((s, v) => s + (v.total || 0), 0) || 0;
  const ventasTotalPrev = ventasMesAnterior?.reduce((s, v) => s + (v.total || 0), 0) || 0;
  const gananciaMes = ventasDelMes?.reduce((s, v) => s + (v.ganancia || 0), 0) || 0;

  // === Libro Diario — ingresos/egresos del mes y últimos 6 meses ===
  const currentMonthStart = new Date(currentYear, now.getMonth(), 1);
  const ingresosMes = (libroDiarioReciente || [])
    .filter(r => r.tipo === 'ingreso' && r.fecha && new Date(r.fecha + 'T00:00:00') >= currentMonthStart)
    .reduce((s, r) => s + (r.monto || 0), 0);
  const egresosMes = (libroDiarioReciente || [])
    .filter(r => r.tipo === 'egreso' && r.fecha && new Date(r.fecha + 'T00:00:00') >= currentMonthStart)
    .reduce((s, r) => s + (r.monto || 0), 0);
  const utilidadMes = ingresosMes - egresosMes;
  const margenMes = ingresosMes > 0 ? (utilidadMes / ingresosMes) * 100 : 0;

  // Balance total (histórico del libro diario que tenemos, últimos 6 meses — no es todo, pero es el rango visible)
  const ingresosTotal = (libroDiarioReciente || []).filter(r => r.tipo === 'ingreso').reduce((s, r) => s + (r.monto || 0), 0);
  const egresosTotal = (libroDiarioReciente || []).filter(r => r.tipo === 'egreso').reduce((s, r) => s + (r.monto || 0), 0);
  const balanceTotal = ingresosTotal - egresosTotal;

  // Serie de 6 meses (flujo de caja mensual)
  const meses6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, now.getMonth() - (5 - i), 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const monthData = (libroDiarioReciente || []).filter(r => {
      if (!r.fecha) return false;
      const rd = new Date(r.fecha + 'T00:00:00');
      return rd.getMonth() === m && rd.getFullYear() === y;
    });
    const ingr = monthData.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + (r.monto || 0), 0);
    const egr = monthData.filter(r => r.tipo === 'egreso').reduce((s, r) => s + (r.monto || 0), 0);
    return {
      label: d.toLocaleDateString('es-DO', { month: 'short' }),
      ingresos: ingr,
      egresos: egr,
      balance: ingr - egr,
    };
  });

  // === Aging de cuentas por cobrar ===
  // Buckets: corriente (mes actual), 30 días (1 mes de mora), 60 (2 meses), 90+ (3+ meses)
  const monthsSince = (m: number, y: number) => (currentYear - y) * 12 + (currentMonth - m);
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  (cobrosVencidos || []).forEach(c => {
    const diff = monthsSince(c.mes, c.anio);
    const monto = c.monto || 0;
    if (diff <= 0) aging.current += monto;
    else if (diff === 1) aging.d30 += monto;
    else if (diff === 2) aging.d60 += monto;
    else aging.d90 += monto;
  });

  const stats = {
    // Financial
    ingresosMes,
    egresosMes,
    utilidadMes,
    margenMes,
    balanceTotal,
    totalRecaudadoMes,
    totalPorCobrarMes,
    totalRecaudadoPrev,
    ventasTotalMes,
    ventasTotalPrev,
    gananciaMes,
    // Operational
    totalClientes: totalClientes || 0,
    clientesActivos: clientesActivos || 0,
    cobrosPagados: cobrosPagados.length,
    totalCobros: cobrosDelMes?.length || 0,
    tasaCobro,
    instalacionesPendientes: instalacionesPendientes || 0,
    tareasPendientes: tareasPendientes || 0,
    // Trends
    flujoMensual: meses6,
    aging,
  };

  return <DashboardClient stats={stats} actividad={ultimaActividad || []} />;
}
