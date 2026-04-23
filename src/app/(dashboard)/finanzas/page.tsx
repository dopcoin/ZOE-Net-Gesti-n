import { createClient } from '@/lib/supabase/server';
import FinanzasClient from '@/components/finanzas/FinanzasClient';

export const dynamic = 'force-dynamic';

export default async function FinanzasPage() {
  const supabase = await createClient();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const startOfYear = new Date(currentYear, 0, 1).toISOString().split('T')[0];
  const twelveMonthsAgo = new Date(currentYear, now.getMonth() - 11, 1).toISOString().split('T')[0];

  const [
    { data: libroDiario },
    { data: cobros },
    { data: clientes },
    { data: ventas },
    { data: facturas },
    { data: gananciasRevendedores },
  ] = await Promise.all([
    // Libro diario — últimos 12 meses
    supabase
      .from('libro_diario')
      .select('id, fecha, tipo, categoria, descripcion, monto, metodo_pago, recibido_en, origen_tipo')
      .gte('fecha', twelveMonthsAgo)
      .order('fecha', { ascending: true }),
    // Cobros del año — para análisis de clientes
    supabase
      .from('cobros')
      .select('id, cliente_id, monto, estado, mes, anio, fecha_pago, clientes(id, nombre, apellido)')
      .gte('anio', currentYear - 1),
    // Clientes
    supabase
      .from('clientes')
      .select('id, nombre, apellido, plan_mensual, estado, beca'),
    // Ventas del año
    supabase
      .from('ventas')
      .select('id, total, ganancia, tipo, estado, created_at, mercancia(nombre, categoria_id)')
      .gte('created_at', startOfYear)
      .eq('estado', 'completada'),
    // Facturas del año
    supabase
      .from('facturas')
      .select('id, total, estado, created_at')
      .gte('created_at', startOfYear),
    // Ganancias revendedores pendientes
    supabase
      .from('ganancias_revendedores')
      .select('id, monto, pagado, revendedor_id, revendedores(nombre, apellido)'),
  ]);

  // Normalizar relaciones (Supabase a veces infiere como arrays)
  const normalize = <T,>(arr: unknown): T[] => (arr as T[]) || [];

  return (
    <FinanzasClient
      libroDiario={normalize(libroDiario)}
      cobros={normalize(cobros)}
      clientes={normalize(clientes)}
      ventas={normalize(ventas)}
      facturas={normalize(facturas)}
      gananciasRevendedores={normalize(gananciasRevendedores)}
      currentMonth={currentMonth}
      currentYear={currentYear}
    />
  );
}
