import { createClient } from '@/lib/supabase/server';
import RevendedoresClient from '@/components/revendedores/RevendedoresClient';

export default async function RevendedoresPage() {
  const supabase = await createClient();
  const { data: revendedores } = await supabase.from('revendedores').select('*, profiles(nombre, apellido)').order('nombre');
  const { data: ganancias } = await supabase.from('ganancias_revendedores').select('*, revendedores(nombre, apellido), ventas(*)').order('created_at', { ascending: false });
  const { data: ventas } = await supabase.from('ventas').select('*, mercancia(nombre), revendedores(nombre, apellido)').eq('tipo', 'revendedor').order('created_at', { ascending: false });
  const { data: miembros } = await supabase.from('profiles').select('id, nombre, apellido, rol').eq('activo', true).order('nombre');
  return <RevendedoresClient revendedores={revendedores ?? []} ganancias={ganancias ?? []} ventas={ventas ?? []} miembros={miembros ?? []} />;
}
