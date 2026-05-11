import { createClient } from '@/lib/supabase/server';
import FacturasClient from '@/components/shared/FacturasClient';

export const dynamic = 'force-dynamic';

export default async function FacturasPage() {
  const supabase = await createClient();
  const [
    { data: facturas },
    { data: clientes },
    { data: mercancia },
  ] = await Promise.all([
    supabase.from('facturas').select('*, clientes(nombre, apellido, telefono, email, cedula, direccion, localidad)').order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre, apellido, telefono, email, cedula, direccion, localidad').order('nombre'),
    supabase.from('mercancia').select('id, nombre, precio_venta, stock, activo').eq('activo', true).order('nombre'),
  ]);

  return (
    <FacturasClient
      facturas={facturas ?? []}
      clientes={clientes ?? []}
      mercancia={(mercancia ?? []) as { id: string; nombre: string; precio_venta: number; stock: number }[]}
    />
  );
}
