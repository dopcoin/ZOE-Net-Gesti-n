import { createClient } from '@/lib/supabase/server';
import InventarioClient from '@/components/inventario/InventarioClient';

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data: mercancia } = await supabase.from('mercancia').select('*, categorias_mercancia(nombre)').order('nombre');
  const { data: categorias } = await supabase.from('categorias_mercancia').select('*').order('nombre');
  return <InventarioClient mercancia={mercancia ?? []} categorias={categorias ?? []} />;
}
