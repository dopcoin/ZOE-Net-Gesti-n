import { createClient } from '@/lib/supabase/server';
import TareasClient from '@/components/shared/TareasClient';

export default async function TareasPage() {
  const supabase = await createClient();
  const { data: tareas } = await supabase.from('tareas').select('*, profiles(nombre, apellido)').order('created_at', { ascending: false });
  const { data: miembros } = await supabase.from('profiles').select('id, nombre, apellido, equipo').eq('activo', true).order('nombre');
  return <TareasClient tareas={tareas ?? []} miembros={miembros ?? []} />;
}
