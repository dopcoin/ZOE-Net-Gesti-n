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
    .select('*, clientes(nombre, apellido, plan, monto_mensual), profiles!cobros_registrado_por_fkey(nombre, apellido)')
    .order('created_at', { ascending: false });

  // Distinct "recibido_por" values for the creatable select
  const { data: recibidosRaw } = await supabase
    .from('cobros')
    .select('recibido_por')
    .not('recibido_por', 'is', null);
  const recibidosPor = Array.from(
    new Set((recibidosRaw ?? []).map((r: { recibido_por: string }) => r.recibido_por).filter(Boolean))
  ).sort() as string[];

  // Localidades distintas de TODOS los clientes (no solo los del listado de cobros)
  // para que un cliente recién creado con localidad nueva ya aparezca como filtro/zona.
  const { data: localidadesRaw } = await supabase
    .from('clientes')
    .select('localidad')
    .not('localidad', 'is', null)
    .neq('localidad', 'Sin localidad');
  const localidades = Array.from(
    new Set((localidadesRaw ?? []).map((r: { localidad: string }) => r.localidad).filter(Boolean))
  ).sort() as string[];

  return (
    <CobrosClient
      clientes={clientes ?? []}
      cobros={cobros ?? []}
      recibidosPor={recibidosPor}
      localidades={localidades}
    />
  );
}
