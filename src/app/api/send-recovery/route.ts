import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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

    // Method 1: Try sending actual email via resetPasswordForEmail
    // This uses Supabase's built-in SMTP to deliver the recovery email
    try {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() { return []; },
            setAll() { /* no-op for API route */ },
          },
        }
      );

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });

      if (!resetError) {
        console.log('[send-recovery] Email sent successfully via resetPasswordForEmail');
        return NextResponse.json({
          success: true,
          method: 'email',
          recoveryLink: null // No direct link — email was sent
        });
      }

      console.warn('[send-recovery] resetPasswordForEmail failed:', resetError.message);
      // Fall through to Method 2
    } catch (emailErr) {
      console.warn('[send-recovery] resetPasswordForEmail exception:', emailErr);
      // Fall through to Method 2
    }

    // Method 2: Fallback — generate link directly via GoTrue admin API
    // This creates a direct recovery link (shown as button) when email delivery fails
    console.log('[send-recovery] Falling back to direct link generation');

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
    console.log('[send-recovery] GoTrue fallback response status:', response.status);

    if (!response.ok) {
      console.error('[send-recovery] GoTrue error:', data);
      if (data?.msg?.includes('User not found') || data?.error?.includes('not found')) {
        return NextResponse.json({ success: true, method: 'email', recoveryLink: null });
      }
      return NextResponse.json({
        error: data?.msg || data?.error || data?.message || 'Error al generar enlace'
      }, { status: 400 });
    }

    const actionLink = data?.action_link as string | undefined;

    if (actionLink) {
      const url = new URL(actionLink);
      const token = url.searchParams.get('token');
      const recoveryUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      return NextResponse.json({
        success: true,
        method: 'link',
        recoveryLink: recoveryUrl
      });
    }

    return NextResponse.json({ success: true, method: 'email', recoveryLink: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-recovery] Catch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
