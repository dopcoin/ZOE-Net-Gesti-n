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
    // Redirect to auth callback which exchanges the code, then goes to reset-password
    const redirectTo = `${origin}/auth/callback?next=/reset-password`;

    console.log('[send-recovery] Sending recovery email to:', email, 'redirectTo:', redirectTo);

    // Use resetPasswordForEmail — this sends the email via Supabase's configured SMTP
    const { error } = await adminSupabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('[send-recovery] Error:', error.message, error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('[send-recovery] Email sent successfully to:', email);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-recovery] Catch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
