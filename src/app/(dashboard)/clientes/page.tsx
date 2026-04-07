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

  return <ClientesClient clientes={data ?? []} ubicaciones={ubicaciones} />;
}
