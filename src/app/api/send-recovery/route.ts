import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email es requerido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const origin = req.headers.get('origin') || req.nextUrl.origin;
    const redirectTo = `${origin}/reset-password`;

    // Call Supabase GoTrue admin API directly via REST
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
        redirect_to: redirectTo,
      }),
    });

    const data = await response.json();
    console.log('[send-recovery] GoTrue response status:', response.status);
    console.log('[send-recovery] GoTrue response keys:', Object.keys(data));

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
    console.log('[send-recovery] Got action_link:', !!actionLink);

    if (actionLink) {
      // Extract token from the action_link and build our own direct URL
      // action_link format: https://xxx.supabase.co/auth/v1/verify?token=TOKEN&type=recovery&redirect_to=...
      const url = new URL(actionLink);
      const token = url.searchParams.get('token');

      // Build direct link to our reset-password page with the token
      const recoveryUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      return NextResponse.json({
        success: true,
        recoveryLink: recoveryUrl
      });
    }

    return NextResponse.json({ success: true, recoveryLink: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-recovery] Catch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
