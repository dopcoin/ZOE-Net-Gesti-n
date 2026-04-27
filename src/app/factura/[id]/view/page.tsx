// Vista pública de factura. URL ejemplo:
//   https://zoe-net-gestion.vercel.app/factura/{uuid}/view
//
// Sin autenticación: cualquier persona con el link puede verla. El UUID
// actúa como token (no se adivina). Optimizada para móvil — pensada para
// que el cliente la abra desde un link de WhatsApp.
//
// Botones: Descargar PDF e Imprimir (window.print con CSS print-only).

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Factura, FacturaItem, Cliente } from '@/types';
import FacturaViewClient from '@/components/facturas/FacturaViewClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function FacturaPublicView({ params }: Props) {
  const id = params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: factura, error } = await supabase
    .from('facturas')
    .select('*, clientes(nombre, apellido, cedula, rnc, razon_social, direccion, telefono, tipo_cliente)')
    .eq('id', id)
    .single();

  if (error || !factura) notFound();

  return <FacturaViewClient factura={factura as Factura & { clientes?: Cliente | null }} />;
}

// Export para que Next pueda servir el metadata correcto al compartir el link
export async function generateMetadata({ params }: Props) {
  return {
    title: `Factura ${params.id.slice(0, 8)}`,
    description: 'Factura emitida por ZoeNet (DopCoin)',
    robots: { index: false, follow: false },
  };
}

// Forzar este tipo en TS
export type { FacturaItem };
