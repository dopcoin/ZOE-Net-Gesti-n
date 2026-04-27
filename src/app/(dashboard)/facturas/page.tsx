import { createClient } from '@/lib/supabase/server';
import FacturasClient from '@/components/shared/FacturasClient';

export default async function FacturasPage() {
  const supabase = await createClient();
  const { data: facturas } = await supabase
    .from('facturas')
    .select('*, clientes(nombre, apellido, telefono)')
    .order('created_at', { ascending: false });
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, apellido, tipo_cliente, rnc, razon_social')
    .order('nombre');
  return <FacturasClient facturas={facturas ?? []} clientes={clientes ?? []} />;
}
