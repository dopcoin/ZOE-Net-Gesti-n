import { createClient } from '@/lib/supabase/server';
import EquipoClient from '@/components/shared/EquipoClient';

export default async function EquipoPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').order('nombre');
  return <EquipoClient miembros={data ?? []} />;
}
