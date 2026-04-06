import { createClient } from '@/lib/supabase/server';
import ReportesClient from '@/components/shared/ReportesClient';

export default async function ReportesPage() {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const { data: cobros } = await supabase.from('cobros').select('mes, anio, monto, estado').eq('anio', year);
  const { data: ventas } = await supabase.from('ventas').select('total, ganancia, tipo, created_at').eq('estado', 'completada').gte('created_at', `${year}-01-01`);
  return <ReportesClient cobros={cobros ?? []} ventas={ventas ?? []} year={year} />;
}
