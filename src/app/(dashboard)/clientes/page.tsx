import { createClient } from '@/lib/supabase/server';
import ClientesClient from '@/components/clientes/ClientesClient';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });

  // Get distinct ubicaciones for the location selector
  const { data: ubicacionesRaw } = await supabase
    .from('clientes')
    .select('localidad')
    .not('localidad', 'is', null)
    .not('localidad', 'eq', 'Sin localidad');
  const ubicaciones = Array.from(
    new Set((ubicacionesRaw ?? []).map((r: { localidad: string }) => r.localidad).filter(Boolean))
  ).sort() as string[];

  // Get distinct medios de pago (tipo_pago) for the selector
  const { data: mediosRaw } = await supabase
    .from('clientes')
    .select('tipo_pago')
    .not('tipo_pago', 'is', null);
  const mediosPago = Array.from(
    new Set((mediosRaw ?? []).map((r: { tipo_pago: string }) => r.tipo_pago).filter(Boolean))
  ).sort() as string[];

  return <ClientesClient clientes={data ?? []} ubicaciones={ubicaciones} mediosPago={mediosPago} />;
}
