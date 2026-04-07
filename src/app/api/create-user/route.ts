import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Temporal: verificar si la service role key está configurada (no expone el valor)
export async function GET() {
  return NextResponse.json({
    serviceKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}

export async function POST(req: NextRequest) {
  try {
    // Verificar sesión del solicitante (server-side, sin problemas de JWT)
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Verificar que sea admin leyendo de la DB directamente
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (callerProfile?.rol !== 'admin') {
      return NextResponse.json(
        { error: 'Solo administradores pueden crear usuarios' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, nombre, apellido, rol, equipo, telefono } = body;

    if (!email || !password || !nombre) {
      return NextResponse.json(
        { error: 'Email, contraseña y nombre son requeridos' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Usar service_role para crear el usuario (solo disponible server-side)
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, apellido: apellido || '', rol: rol || 'soporte' },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (newUser.user) {
      await adminSupabase.from('profiles').update({
        nombre,
        apellido: apellido || '',
        rol: rol || 'soporte',
        equipo: equipo || null,
        telefono: telefono || null,
        email,
        activo: true,
      }).eq('id', newUser.user.id);
    }

    return NextResponse.json({ success: true, user: { id: newUser.user?.id, email } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
