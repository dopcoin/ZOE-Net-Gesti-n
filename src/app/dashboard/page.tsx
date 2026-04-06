import { createClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalClientes },
    { count: clientesActivos },
    { data: cobrosDelMes },
    { count: instalacionesPendientes },
    { count: tareasPendientes },
    { data: ultimaActividad },
    { data: ventasDelMes },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
    supabase.from('cobros').select('monto, estado').eq('mes', new Date().getMonth() + 1).eq('anio', new Date().getFullYear()),
    supabase.from('instalaciones').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('completada', false),
    supabase.from('activity_log').select('*, profiles(nombre, apellido)').order('created_at', { ascending: false }).limit(10),
    supabase.from('ventas').select('total, ganancia').eq('estado', 'completada').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  const cobrosPagados = cobrosDelMes?.filter(c => c.estado === 'pagado') || [];
  const totalRecaudado = cobrosPagados.reduce((sum, c) => sum + (c.monto || 0), 0);
  const totalVentas = ventasDelMes?.reduce((sum, v) => sum + (v.total || 0), 0) || 0;

  const stats = {
    totalClientes: totalClientes || 0,
    clientesActivos: clientesActivos || 0,
    cobrosPagados: cobrosPagados.length,
    totalCobros: cobrosDelMes?.length || 0,
    totalRecaudado,
    instalacionesPendientes: instalacionesPendientes || 0,
    tareasPendientes: tareasPendientes || 0,
    totalVentas,
  };

  return <DashboardClient stats={stats} actividad={ultimaActividad || []} />;
}
