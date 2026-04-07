import { createClient } from '@/lib/supabase/server';
import InstalacionesClient from '@/components/shared/InstalacionesClient';

export const dynamic = 'force-dynamic';

export default async function InstalacionesPage() {
  const supabase = await createClient();
  const { data: instalaciones } = await supabase
    .from('instalaciones')
    .select('*, clientes(nombre, apellido)')
    .order('created_at', { ascending: false });
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, apellido')
    .order('nombre');
  const { data: tecnicos } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, equipo, rol')
    .eq('activo', true)
    .order('nombre');
  return (
    <InstalacionesClient
      instalaciones={instalaciones ?? []}
      clientes={clientes ?? []}
      tecnicos={tecnicos ?? []}
    />
  );
}
