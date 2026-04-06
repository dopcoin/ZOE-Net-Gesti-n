import { createClient } from '@/lib/supabase/server';
import LibroDiarioClient from '@/components/shared/LibroDiarioClient';

export default async function LibroDiarioPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('libro_diario').select('*').order('created_at', { ascending: false });
  return <LibroDiarioClient registros={data ?? []} />;
}
