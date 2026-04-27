# 🔑 Credenciales Necesarias — ZOE Net Gestión

> **⚠ IMPORTANTE**: Este archivo solo lista QUÉ credenciales se necesitan y DÓNDE obtenerlas. **Nunca pegues valores reales aquí**. Los valores reales viven en `.env.local` (no committeado, en `.gitignore`) y en Vercel Environment Variables.

> **📨 Para saber CÓMO transmitir secretos de forma segura, ver [`COMPARTIR-CREDENCIALES.md`](./COMPARTIR-CREDENCIALES.md).**

---

## 1. Supabase (REQUERIDO)

Las dos variables que usa la app para conectarse a la base de datos.

| Variable | Dónde obtenerla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → **anon public key** |

**Acceso al dashboard**:
- URL: https://supabase.com/dashboard/project/bsiouklwhnxflorsrphz
- Owner: `dopcoinrd@gmail.com`

> La `anon public key` está diseñada para ser visible en el cliente (browser) — no es un secreto crítico. Aun así, mejor no compartirla en chats públicos.

---

## 2. Service Role Key (OPCIONAL — solo para tareas admin)

Se usa solo si se agregan jobs server-side que necesitan saltarse RLS (ej. seeds, migraciones programáticas, cron jobs).

| Variable | Dónde obtenerla |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → **service_role key** |

> **🚨 Esta SÍ es secreta**. Saltarse RLS = acceso total a la base de datos. Nunca exponer en el cliente, nunca committear, solo en variables de entorno server-side.

---

## 3. Resend (Email transaccional — OPCIONAL)

Solo si se reactiva el envío real de emails (recovery password, notificaciones, recibos).

| Variable | Dónde obtenerla |
|---|---|
| `RESEND_API_KEY` | https://resend.com/api-keys → Create API Key |
| `RESEND_FROM_EMAIL` | Email de envío validado en Resend (ej. `noreply@zoenet.do`) |

> **Estado actual**: la funcionalidad de "Recuperar contraseña" está deshabilitada en el login. Si se reactiva hay que configurar Resend.

---

## 4. Vercel (Deploy)

Acceso al dashboard de Vercel donde está deployada la app.

- **URL**: https://vercel.com/dashboard
- **Owner del proyecto**: `dopcoinrd@gmail.com`
- **Proyecto**: `zoe-net-gestion` (o el slug correspondiente)

**Configurar variables de entorno en Vercel**:
1. Project → Settings → Environment Variables
2. Agregar las mismas variables que `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Marcar para **Production**, **Preview**, y **Development** según corresponda.
4. Re-deploy para que tomen efecto.

---

## 5. GitHub

- **Repo**: https://github.com/dopcoin/ZOE-Net-Gesti-n
- **Owner**: organización `dopcoin`
- Para colaborar: agregar usuario como Collaborator o miembro de la organización.

---

## 6. Plantilla `.env.example`

Crear o validar este archivo en la raíz del repo (versionable, sin valores reales):

```bash
# === Supabase (REQUERIDO) ===
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# === Service Role (solo backend admin tasks — OPCIONAL) ===
# SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# === Resend (envío de emails — OPCIONAL) ===
# RESEND_API_KEY=re_...
# RESEND_FROM_EMAIL=noreply@example.com
```

---

## 7. Cuentas administrativas creadas en Supabase

Para entrar a la app, los usuarios deben existir en `auth.users` Y en `profiles` con un rol asignado.

**Crear usuario admin desde Supabase Dashboard**:
1. Authentication → Users → Add User → Create new user (email + password).
2. Tomar el `user_id` (UUID) generado.
3. SQL Editor → ejecutar:
```sql
INSERT INTO profiles (id, email, nombre, apellido, rol, equipo, activo)
VALUES (
  '<UUID-DEL-USUARIO>',
  'email@example.com',
  'Nombre',
  'Apellido',
  'admin',
  'administrativo',
  true
);
```

---

## 8. Roles disponibles en la app

| Rol | Acceso |
|---|---|
| `admin` | Todo |
| `financiero` | Cobros, Facturas, Ventas, Libro Diario, Finanzas, Reportes, Tareas |
| `administrativo` | Inventario, Conciliación, Revendedores, Equipo, Tareas |
| `soporte` | Clientes, Instalaciones, Tareas |

Configurado en cada item del array `navGroups` en `src/components/layout/Sidebar.tsx`.

---

## 9. Checklist de onboarding para un nuevo desarrollador

- [ ] Recibir invitación al repo de GitHub (`dopcoin/ZOE-Net-Gesti-n`)
- [ ] Recibir invitación al proyecto de Supabase
- [ ] Recibir invitación al proyecto de Vercel (si va a deploy)
- [ ] Clonar el repo y correr `npm install`
- [ ] Crear `.env.local` con las dos variables de Supabase
- [ ] Verificar que `npm run dev` arranca sin errores
- [ ] Crear su cuenta de admin en Supabase + insertar en `profiles`
- [ ] Loguearse en `localhost:3000/login`
- [ ] Leer `HANDOFF.md` y `CHANGELOG.md`
- [ ] Revisar la lista de pendientes en HANDOFF (sección 7)

---

> **Nunca**:
> - committees `.env.local`
> - pegues credenciales en Slack, WhatsApp, o emails
> - compartas la `service_role key` por chat
> - publiques URLs con tokens en parámetros de query
