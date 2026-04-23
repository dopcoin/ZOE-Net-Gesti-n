import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email es requerido' }, { status: 400 });
    }

    // Use admin client to generate the password reset link
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get the site URL from the request origin for the redirect
    const origin = req.headers.get('origin') || req.nextUrl.origin;
    const redirectTo = `${origin}/reset-password`;

    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      // Don't reveal if user exists or not — always return success
      console.error('Recovery email error:', error.message);
      return NextResponse.json({ success: true });
    }

    // If Supabase managed to generate the link, now send the email via Supabase's built-in mailer
    // The generateLink approach may not send the email automatically, so let's use resetPasswordForEmail
    // from the server side instead
    const { error: resetError } = await adminSupabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      console.error('Reset password email error:', resetError.message);
      // Still return success to not reveal if user exists
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Send recovery error:', err);
    // Always return success to not reveal if user exists
    return NextResponse.json({ success: true });
  }
}
