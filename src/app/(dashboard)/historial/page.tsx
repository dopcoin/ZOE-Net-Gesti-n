import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import HistorialClient from '@/components/historial/HistorialClient';

export const dynamic = 'force-dynamic';

export default async function HistorialPage() {
  const supabase = await createClient();

  // Solo admin puede ver el historial completo
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (profile?.rol !== 'admin') redirect('/dashboard');

  // Últimos 90 días por defecto (ampliable con filtros del cliente)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [{ data: logs }, { data: profiles }] = await Promise.all([
    supabase
      .from('activity_log')
      .select('id, usuario_id, usuario_nombre, accion, entidad, entidad_id, detalles, detalle, created_at, profiles(nombre, apellido, rol)')
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('profiles')
      .select('id, nombre, apellido, rol')
      .eq('activo', true)
      .order('nombre'),
  ]);

  return (
    <HistorialClient
      logs={(logs ?? []) as unknown[] as Parameters<typeof HistorialClient>[0]['logs']}
      profiles={profiles ?? []}
    />
  );
}
