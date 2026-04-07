import { createClient } from '@/lib/supabase/server';
import InstalacionesClient from '@/components/shared/InstalacionesClient';

export default async function InstalacionesPage() {
  const supabase = await createClient();
  const { data: instalaciones } = await supabase.from('instalaciones').select('*, clientes(nombre, apellido)').order('created_at', { ascending: false });
  const { data: clientes } = await supabase.from('clientes').select('id, nombre, apellido').order('nombre');
  return <InstalacionesClient instalaciones={instalaciones ?? []} clientes={clientes ?? []} />;
}
