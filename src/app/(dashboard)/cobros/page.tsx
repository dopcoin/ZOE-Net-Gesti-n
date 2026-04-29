import { createClient } from '@/lib/supabase/server';
import CobrosClient from '@/components/cobros/CobrosClient';

export default async function CobrosPage() {
  const supabase = await createClient();
  // Excluye clientes retirados (suspendido / inactivo) — solo activos/becados/nuevos aparecen en cobros
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .in('estado', ['activo', 'becado', 'nuevo'])
    .order('nombre');
  const { data: cobros } = await supabase
    .from('cobros')
    .select('*, clientes(nombre, apellido, plan, monto_mensual)')
    .order('created_at', { ascending: false });

  // Distinct "recibido_por" values for the creatable select
  const { data: recibidosRaw } = await supabase
    .from('cobros')
    .select('recibido_por')
    .not('recibido_por', 'is', null);
  const recibidosPor = Array.from(
    new Set((recibidosRaw ?? []).map((r: { recibido_por: string }) => r.recibido_por).filter(Boolean))
  ).sort() as string[];

  return <CobrosClient clientes={clientes ?? []} cobros={cobros ?? []} recibidosPor={recibidosPor} />;
}
