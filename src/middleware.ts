import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const publicPages = ['/login', '/reset-password', '/registro'];
  const isAuthPage = publicPages.includes(request.nextUrl.pathname);
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth/callback');
  // Vista pública de facturas: /factura/{uuid}/view — el cliente abre desde
  // un link compartido por WhatsApp/email. El UUID actúa como token.
  const isFacturaPublica = /^\/factura\/[0-9a-f-]{36}\/view\/?$/i.test(request.nextUrl.pathname);
  const isProtectedRoute =
    !isAuthPage && !isAuthCallback && !isFacturaPublica && request.nextUrl.pathname !== '/';

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Check if authenticated user's profile is active (only on protected routes)
  if (user && isProtectedRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('activo')
      .eq('id', user.id)
      .single();

    if (profile && !profile.activo) {
      // Inactive user — sign out and redirect with cookies properly set
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('inactive', '1');
      const redirectResponse = NextResponse.redirect(url);
      // Copy the signOut cookies to the redirect response
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, {
          path: '/',
          maxAge: 0,
        });
      });
      return redirectResponse;
    }
  }

  // Redirect authenticated users away from login/registro
  // But NOT from reset-password (user needs to stay there to change password)
  if (user && isAuthPage && request.nextUrl.pathname !== '/reset-password') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
