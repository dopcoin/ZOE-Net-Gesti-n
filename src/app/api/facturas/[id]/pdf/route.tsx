// Endpoint de descarga de PDF de factura.
// Renderiza el PDF server-side con @react-pdf/renderer.
// Acceso público (sin auth) — el UUID de la factura actúa como token,
// igual que la vista /factura/[id]/view. Si en el futuro se quiere mayor
// control, agregar un token firmado con expiración.

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { renderToStream } from '@react-pdf/renderer';
import { FacturaPDF } from '@/components/facturas/FacturaPDF';
import { NextResponse } from 'next/server';
import type { Factura } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  // Service role: se usa porque la vista pública debe poder leer la factura
  // aunque el visitante no esté autenticado. Es seguro porque solo
  // exponemos UNA factura por request, identificada por su UUID.
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

  if (error || !factura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
  }

  try {
    const stream = await renderToStream(<FacturaPDF factura={factura as Factura} />);
    // Convertir Node.js Readable a Web ReadableStream para Next runtime
    const webStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream as AsyncIterable<Buffer>) {
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
      },
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="factura-${factura.numero}.pdf"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error generando PDF';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
