import { createClient } from '@/lib/supabase/server';
import ClientesClient from '@/components/clientes/ClientesClient';

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
  return <ClientesClient clientes={data ?? []} />;
}
