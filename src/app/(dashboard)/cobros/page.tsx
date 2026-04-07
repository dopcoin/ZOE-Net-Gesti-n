import { createClient } from '@/lib/supabase/server';
import CobrosClient from '@/components/cobros/CobrosClient';

export default async function CobrosPage() {
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .in('estado', ['activo', 'becado'])
    .order('nombre');
  const { data: cobros } = await supabase
    .from('cobros')
    .select('*, clientes(nombre, apellido, plan, monto_mensual)')
    .order('created_at', { ascending: false });

  return <CobrosClient clientes={clientes ?? []} cobros={cobros ?? []} />;
}
