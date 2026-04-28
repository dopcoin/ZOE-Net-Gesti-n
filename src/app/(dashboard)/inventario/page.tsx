import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InventarioClient from '@/components/inventario/InventarioClient';

export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
  const supabase = await createClient();

  // Determinar si el usuario tiene permisos de edición
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const canEdit = profile?.rol === 'admin' || profile?.rol === 'administrativo';

  const [{ data: mercancia }, { data: categorias }] = await Promise.all([
    supabase.from('mercancia').select('*, categorias_mercancia(nombre)').order('nombre'),
    supabase.from('categorias_mercancia').select('*').order('nombre'),
  ]);

  return (
    <InventarioClient
      mercancia={mercancia ?? []}
      categorias={categorias ?? []}
      canEdit={canEdit}
    />
  );
}
