import { createClient } from '@/lib/supabase/server';
import ConciliacionClient from '@/components/shared/ConciliacionClient';

export default async function ConciliacionPage() {
  const supabase = await createClient();
  const { data: conciliaciones } = await supabase.from('conciliacion').select('*, mercancia(nombre), revendedores(nombre, apellido)').order('created_at', { ascending: false });
  const { data: mercancia } = await supabase.from('mercancia').select('id, nombre, stock').eq('activo', true).order('nombre');
  const { data: revendedores } = await supabase.from('revendedores').select('id, nombre, apellido').eq('activo', true).order('nombre');
  return <ConciliacionClient conciliaciones={conciliaciones ?? []} mercancia={mercancia ?? []} revendedores={revendedores ?? []} />;
}
