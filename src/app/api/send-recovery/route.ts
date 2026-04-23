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
    const resendApiKey = process.env.RESEND_API_KEY!;
    const origin = req.headers.get('origin') || req.nextUrl.origin;

    // Step 1: Generate recovery token via GoTrue admin API
    const gotrueRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
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

    const gotrueData = await gotrueRes.json();
    console.log('[send-recovery] GoTrue status:', gotrueRes.status);

    if (!gotrueRes.ok) {
      // User not found — don't reveal, return generic success
      if (gotrueData?.msg?.includes('User not found') || gotrueData?.error?.includes('not found')) {
        return NextResponse.json({ success: true, sent: false });
      }
      console.error('[send-recovery] GoTrue error:', gotrueData);
      return NextResponse.json({
        error: gotrueData?.msg || gotrueData?.error || 'Error al generar enlace'
      }, { status: 400 });
    }

    const actionLink = gotrueData?.action_link as string | undefined;
    if (!actionLink) {
      return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 });
    }

    // Step 2: Build our direct recovery URL from the token
    const url = new URL(actionLink);
    const token = url.searchParams.get('token');
    const recoveryUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    // Step 3: Send the email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'ZOE Net Gestión <onboarding@resend.dev>',
        to: [email],
        subject: 'Restablecer tu contraseña — ZOE Net Gestión',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </head>
            <body style="margin:0;padding:0;background-color:#0F1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F1117;padding:40px 16px;">
                <tr>
                  <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
                      <!-- Logo -->
                      <tr>
                        <td align="center" style="padding-bottom:32px;">
                          <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">
                            <span style="color:#3B82F6;">ZOE</span> Net Gestión
                          </p>
                        </td>
                      </tr>
                      <!-- Card -->
                      <tr>
                        <td style="background-color:#161B27;border:1px solid #1F2937;border-radius:12px;padding:32px;">
                          <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#ffffff;text-align:center;">
                            Restablecer Contraseña
                          </p>
                          <p style="margin:0 0 24px;font-size:14px;color:#9CA3AF;text-align:center;">
                            Recibimos una solicitud para restablecer la contraseña de tu cuenta.
                          </p>
                          <!-- Button -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td align="center" style="padding-bottom:24px;">
                                <a href="${recoveryUrl}"
                                   style="display:inline-block;padding:12px 32px;background-color:#3B82F6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
                                  Cambiar Contraseña
                                </a>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0 0 8px;font-size:13px;color:#6B7280;text-align:center;">
                            Si no solicitaste esto, ignora este email.
                          </p>
                          <p style="margin:0;font-size:12px;color:#4B5563;text-align:center;">
                            Este enlace expira en 24 horas.
                          </p>
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td align="center" style="padding-top:24px;">
                          <p style="margin:0;font-size:12px;color:#4B5563;">
                            ZOE Net Gestión — Sistema de gestión para ISP
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      }),
    });

    const emailData = await emailRes.json();
    console.log('[send-recovery] Resend status:', emailRes.status, emailData);

    if (!emailRes.ok) {
      console.error('[send-recovery] Resend error:', emailData);
      // Email failed — fall back to showing the direct link
      return NextResponse.json({
        success: true,
        sent: false,
        recoveryLink: recoveryUrl,
      });
    }

    // Email sent successfully
    return NextResponse.json({ success: true, sent: true, recoveryLink: null });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-recovery] Catch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
