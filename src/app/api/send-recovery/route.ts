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

    // First verify the user exists
    const { data: usersData } = await adminSupabase.auth.admin.listUsers();
    const userExists = usersData?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!userExists) {
      // Don't reveal if user exists — still show success
      return NextResponse.json({ success: true, recoveryLink: null });
    }

    const origin = req.headers.get('origin') || req.nextUrl.origin;
    const redirectTo = `${origin}/auth/callback?next=/reset-password`;

    // generateLink generates a token — may return error about SMTP but data may still have the link
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    console.log('[send-recovery] generateLink result:', {
      hasData: !!data,
      hasLink: !!data?.properties?.action_link,
      hasError: !!error,
      errorMsg: error?.message,
    });

    // Check if we got the link even if there was an SMTP error
    const actionLink = data?.properties?.action_link;

    if (actionLink) {
      return NextResponse.json({ success: true, recoveryLink: actionLink });
    }

    // If generateLink completely failed, fall back to generating a temp password approach
    if (error) {
      console.error('[send-recovery] Full error:', error);
      return NextResponse.json(
        { error: `No se pudo generar el enlace: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, recoveryLink: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-recovery] Catch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
