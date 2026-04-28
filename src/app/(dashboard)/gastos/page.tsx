import { createClient } from '@/lib/supabase/server';
import GastosClient from '@/components/gastos/GastosClient';

export const dynamic = 'force-dynamic';

export default async function GastosPage() {
  const supabase = await createClient();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

  // Solo egresos, del año actual hacia adelante (suficiente para análisis)
  const { data: gastos } = await supabase
    .from('libro_diario')
    .select('id, fecha, categoria, descripcion, monto, metodo_pago, recibido_en, referencia, tipo')
    .eq('tipo', 'egreso')
    .gte('fecha', yearStart)
    .order('fecha', { ascending: false });

  // Categorías existentes para el autocomplete
  const { data: catRows } = await supabase
    .from('libro_diario')
    .select('categoria')
    .eq('tipo', 'egreso');

  const categoriasUsadas = Array.from(
    new Set((catRows ?? []).map((r) => r.categoria).filter(Boolean))
  ).sort() as string[];

  return (
    <GastosClient
      gastos={gastos ?? []}
      categoriasUsadas={categoriasUsadas}
    />
  );
}
