import { createClient } from '@/lib/supabase/server';
import TareasClient from '@/components/shared/TareasClient';

export const dynamic = 'force-dynamic';

export default async function TareasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // IMPORTANT: Must use explicit FK name because tareas has TWO FKs to profiles
  // (asignado_a and creado_por). Without the hint, PostgREST returns error PGRST200.
  const { data: tareas, error: tareasError } = await supabase
    .from('tareas')
    .select('*, profiles!tareas_asignado_a_fkey(nombre, apellido), clientes!tareas_cliente_id_fkey(nombre, apellido)')
    .order('created_at', { ascending: false });

  if (tareasError) {
    console.error('Error fetching tareas:', tareasError);
  }

  const { data: miembros } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, equipo, rol')
    .eq('activo', true)
    .order('nombre');

  const { data: clientesData } = await supabase
    .from('clientes')
    .select('id, nombre, apellido')
    .in('estado', ['activo', 'nuevo', 'becado'])
    .order('nombre');

  return (
    <TareasClient
      tareas={tareas ?? []}
      miembros={miembros ?? []}
      clientes={clientesData ?? []}
      userId={user?.id ?? null}
    />
  );
}
