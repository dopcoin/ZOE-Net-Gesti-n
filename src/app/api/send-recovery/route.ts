import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email es requerido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const origin = req.headers.get('origin') || req.nextUrl.origin;

    // Generate direct recovery link via GoTrue admin API
    // This always works and gives us a usable token
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        type: 'recovery',
        email,
        redirect_to: `${origin}/reset-password`,
      }),
    });

    const data = await response.json();
    console.log('[send-recovery] GoTrue response status:', response.status);

    if (!response.ok) {
      console.error('[send-recovery] GoTrue error:', data);
      // If user not found, don't reveal — return generic success
      if (data?.msg?.includes('User not found') || data?.error?.includes('not found')) {
        return NextResponse.json({ success: true, recoveryLink: null });
      }
      return NextResponse.json({
        error: data?.msg || data?.error || data?.message || 'Error al generar enlace'
      }, { status: 400 });
    }

    const actionLink = data?.action_link as string | undefined;

    if (actionLink) {
      // Extract token and build our direct URL
      const url = new URL(actionLink);
      const token = url.searchParams.get('token');
      const recoveryUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      // Also try to send the recovery email in the background (non-blocking)
      // If Supabase SMTP is configured, the user will also get an email
      try {
        const supabase = createServerClient(
          supabaseUrl,
          supabaseAnonKey,
          {
            cookies: {
              getAll() { return []; },
              setAll() { /* no-op */ },
            },
          }
        );
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/auth/callback?next=/reset-password`,
        }).catch(() => { /* ignore email failures silently */ });
      } catch {
        // Ignore — the direct link is the primary method
      }

      return NextResponse.json({
        success: true,
        recoveryLink: recoveryUrl,
      });
    }

    return NextResponse.json({ success: true, recoveryLink: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-recovery] Catch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
