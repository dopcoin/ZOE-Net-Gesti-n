import { createClient } from '@/lib/supabase/server';
import LibroDiarioClient from '@/components/libro-diario/LibroDiarioClient';

export const dynamic = 'force-dynamic';

export default async function LibroDiarioPage() {
  const supabase = await createClient();

  const { data: registros } = await supabase
    .from('libro_diario')
    .select('*, profiles(nombre, apellido)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  const { data: categoriasRaw } = await supabase
    .from('libro_diario')
    .select('categoria')
    .not('categoria', 'is', null);

  const categorias = Array.from(
    new Set((categoriasRaw ?? []).map((r: { categoria: string }) => r.categoria).filter(Boolean))
  ).sort() as string[];

  return <LibroDiarioClient registros={registros ?? []} categorias={categorias} />;
}
