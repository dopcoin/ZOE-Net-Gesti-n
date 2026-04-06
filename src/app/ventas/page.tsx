import { createClient } from '@/lib/supabase/server';
import VentasClient from '@/components/shared/VentasClient';

export default async function VentasPage() {
  const supabase = await createClient();
  const { data: ventas } = await supabase.from('ventas').select('*, mercancia(nombre), clientes(nombre, apellido), revendedores(nombre, apellido)').order('created_at', { ascending: false });
  const { data: mercancia } = await supabase.from('mercancia').select('*').eq('activo', true).order('nombre');
  const { data: clientes } = await supabase.from('clientes').select('id, nombre, apellido').order('nombre');
  const { data: revendedores } = await supabase.from('revendedores').select('id, nombre, apellido').eq('activo', true).order('nombre');
  return <VentasClient ventas={ventas ?? []} mercancia={mercancia ?? []} clientes={clientes ?? []} revendedores={revendedores ?? []} />;
}
