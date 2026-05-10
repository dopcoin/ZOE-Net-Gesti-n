import { createClient } from '@/lib/supabase/server';
import InstalacionesClient from '@/components/shared/InstalacionesClient';

export const dynamic = 'force-dynamic';

export default async function InstalacionesPage() {
  const supabase = await createClient();
  const { data: instalaciones } = await supabase
    .from('instalaciones')
    .select('*, clientes(nombre, apellido, telefono, email, cedula, direccion, localidad)')
    .order('created_at', { ascending: false });
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, apellido, telefono, email, cedula, direccion, localidad')
    .order('nombre');
  const { data: tecnicos } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, equipo, rol')
    .eq('activo', true)
    .order('nombre');

  // Distinct "recibido_en" para el select creatable
  const { data: recibidosRaw } = await supabase
    .from('instalaciones')
    .select('recibido_en')
    .not('recibido_en', 'is', null);
  const recibidosPor = Array.from(
    new Set((recibidosRaw ?? []).map((r: { recibido_en: string }) => r.recibido_en).filter(Boolean))
  ).sort() as string[];

  return (
    <InstalacionesClient
      instalaciones={instalaciones ?? []}
      clientes={clientes ?? []}
      tecnicos={tecnicos ?? []}
      recibidosPor={recibidosPor}
    />
  );
}
