import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email es requerido' }, { status: 400 });
    }

    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const origin = req.headers.get('origin') || req.nextUrl.origin;

    // Use generateLink (admin API) — generates a magic link without relying on SMTP
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      },
    });

    if (error) {
      console.error('[send-recovery] generateLink error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.properties?.action_link) {
      return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 });
    }

    // Return the recovery link directly — the frontend will show it
    return NextResponse.json({
      success: true,
      // The action_link is the full recovery URL from Supabase
      recoveryLink: data.properties.action_link,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-recovery] Catch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
