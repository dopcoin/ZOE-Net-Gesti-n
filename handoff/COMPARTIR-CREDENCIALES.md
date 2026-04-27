# 🔐 Cómo Compartir Credenciales de Forma Segura

Guía práctica para transmitir secretos del proyecto **ZOE Net Gestión** sin exponerlos.

---

## ⭐ Regla de oro: NO las compartas. Invita a la plataforma.

La forma más segura de "compartir" una credencial es **no compartirla**. En su lugar, agrega a la persona como miembro de la plataforma. Así, ella misma genera/lee la credencial cuando la necesita, y tú puedes revocar el acceso en un click.

| Plataforma | Cómo invitar | Resultado |
|---|---|---|
| **GitHub** | Repo → Settings → Collaborators → Add people | Acceso al código + Actions |
| **Supabase** | Dashboard → Project Settings → Team → Invite | Pueden leer ANON/Service keys del dashboard |
| **Vercel** | Team Settings → Members → Invite | Pueden ver/editar env vars de producción |
| **Resend** | Settings → Team → Invite member | Pueden generar sus propias API keys |

> **Si tienen acceso al dashboard de Supabase, ellos copian la ANON key a su `.env.local` directamente.** No tienes que pasarles nada.

---

## 🛡 Cuando SÍ tienes que enviar el valor

Por orden de preferencia (de más profesional a más casual):

### 1. Password manager con vault compartido ⭐ (recomendado)

| Tool | Precio | Por qué es bueno |
|---|---|---|
| **1Password** | $3/mes/usuario | Vault de equipo, audit log, item sharing temporal, mejor UX |
| **Bitwarden** | Gratis (2 usuarios) o $1/mes | Open source, vault compartido, tiene "Send" para links efímeros |
| **Dashlane** | $5/mes | Alternativa similar |

**Flujo**:
1. Tú guardas el secreto en el vault compartido del equipo
2. La persona lo lee desde su 1Password/Bitwarden
3. Cuando se va del equipo, le quitas acceso al vault → ya no puede leerlo

**Bonus 1Password**: la integración con CLI te permite no pegar nunca secretos en disco:
```bash
# Inyecta secretos en runtime sin tocar .env.local
op run --env-file=.env.template -- npm run dev
```

---

### 2. Link de un solo uso (rápido y gratis)

Para casos puntuales donde no tiene sentido configurar un password manager.

| Tool | URL | Características |
|---|---|---|
| **One-Time Secret** | https://onetimesecret.com | Gratis, sin cuenta, autodestruye al abrir |
| **Bitwarden Send** | https://send.bitwarden.com | Gratis, configurable: max views, expiración, password |
| **1Password Item Sharing** | Desde la app | Link con OTP, expiración granular |
| **PrivateBin** | https://privatebin.info | Self-hostable, encriptación cliente |

**Flujo típico con onetimesecret.com**:
1. Pegas el valor → te da un URL como `https://onetimesecret.com/secret/abc123xyz`
2. Envías el URL por WhatsApp, email, lo que sea
3. La persona lo abre → ve el secreto → el link **se autodestruye**
4. Si alguien intercepta el link después, ya no funciona

> **Importante**: el medio por el que envías el LINK no necesita ser seguro (porque sin abrir → autodestruye → es inútil). Pero sí debes **avisar a la persona por OTRO canal** que le mandaste el link, para que lo abra rápido y no lo abra alguien más antes.

---

### 3. Secret manager dedicado (si el proyecto crece)

Cuando el equipo tiene 3+ devs y muchos secretos.

| Tool | Para qué sirve |
|---|---|
| **Doppler** | Sincroniza secretos entre dev/staging/prod, integra con Vercel automáticamente |
| **Infisical** | Open source, self-hostable, similar a Doppler |
| **HashiCorp Vault** | Enterprise, audit completo, rotation automático |
| **AWS Secrets Manager / GCP Secret Manager** | Si usas esa nube |

**Flujo con Doppler**:
```bash
# Setup inicial
doppler login
doppler setup

# Correr local con secretos inyectados (no toca .env.local)
doppler run -- npm run dev

# Sincronizar secretos a Vercel
doppler integrations create vercel
```

---

### 4. Vercel CLI (para variables de producción)

Si la persona ya tiene acceso al proyecto Vercel, puede sincronizar las env vars sin pasar por ti.

```bash
# Trae .env.local desde Vercel (los secretos están allí ya)
vercel env pull .env.local

# Subir un secreto nuevo a producción
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# → te pide pegar el valor en stdin (no queda en bash history si configuras espacio antes del comando)
```

---

### 5. Encriptación con clave pública (paranoid mode)

Si la persona tiene una llave pública GPG o age, le envías el valor cifrado. Solo ella puede descifrarlo.

```bash
# Con GPG
echo "MI_SECRETO" | gpg --encrypt --recipient destinatario@email.com > secret.gpg
# Le envías secret.gpg → ella corre: gpg --decrypt secret.gpg

# Con age (más moderno, más simple)
age -r age1qq3j8... -o secret.age <<< "MI_SECRETO"
# Le envías secret.age → ella corre: age --decrypt -i ~/.age/key.txt secret.age
```

Práctico para CI/CD o cuando no puedes usar nada online.

---

## ❌ Lo que NUNCA hacer

| ❌ Mal | Por qué |
|---|---|
| **Email** | Queda en servidores de Gmail/Outlook potencialmente para siempre |
| **WhatsApp / Telegram / SMS** | Backups en cloud, screenshots, history en el dispositivo del receptor |
| **Slack / Discord (incluso DMs)** | History retention indefinida, los admins de workspace lo pueden ver |
| **Google Docs / Notion** | Cualquiera con acceso al doc lo ve, share links se filtran |
| **Capturas de pantalla** | Van a Photos/iCloud/Drive, OCR-able |
| **Commit al repo (incluso privado)** | Si el repo se vuelve público o se filtra, expones todo el histórico |
| **Pastebin público / Gist público** | Indexado por Google y bots de scraping en minutos |
| **QR codes generados en sitios random** | El sitio puede guardar el contenido |
| **Pegado en Notion/Trello** | Queda en logs y backups |

---

## 🚨 Si una credencial se filtró

**Acción inmediata** (en orden):

1. **Rotar el secreto** en la plataforma origen:
   - **Supabase ANON/Service key** → Project Settings → API → "Reset" en la key comprometida
   - **Resend API key** → API keys → Revoke + crear nueva
   - **Password de cuenta** → cambiar password + activar 2FA si no está
2. **Actualizar el valor** en:
   - `.env.local` de cada dev del equipo
   - Vercel Environment Variables (`vercel env rm OLD_VAR && vercel env add NEW_VAR`)
   - Cualquier secret manager que la tenga
3. **Re-deploy** la app para que tome el nuevo valor
4. **Revisar logs** de la plataforma origen por uso sospechoso (Supabase tiene logs en Logs Explorer, Vercel en Logs)
5. **Si fue committeada al repo**, además: usar `git filter-repo` o BFG para borrarla del histórico, force-push, y considerar el repo comprometido (incluso así, lo que importa es que el valor ya está rotado)

---

## 🎯 Recomendación específica para ZOE Net Gestión (escala actual)

Dado que el proyecto tiene 1 dev (tú) y posiblemente 1-2 colaboradores ocasionales:

### Setup mínimo recomendado

1. **Cuenta de Bitwarden gratis** (https://bitwarden.com — gratis para 2 personas, ilimitados secretos)
   - Crea un Item por cada credencial:
     - "Supabase ZOE Net — ANON Key"
     - "Supabase ZOE Net — Service Role"
     - "Resend — API Key"
     - "GitHub PAT (si lo usas para CI)"
   - Si trabajas con alguien, usa "Organization" gratis (2 users) para vault compartido.

2. **Para colaboradores ocasionales** (un dev externo que viene 2 semanas):
   - Invítalo a GitHub, Supabase y Vercel directamente.
   - **NO le pases credenciales por chat**. Que él mismo lea ANON key del dashboard de Supabase.
   - Cuando termine, remueve sus accesos en las 3 plataformas.

3. **Para un secreto puntual que sí debes enviar**:
   - Usa **onetimesecret.com**.
   - Avisa por WhatsApp que mandaste el link, manda el link, dile que lo abra YA.
   - Si pasaste de las 24h sin que lo abra, regenera el link.

4. **`.env.local` jamás sale de tu máquina.** Cada dev tiene el suyo.

5. **Producción (Vercel) ya tiene los secretos cargados.** No los duplicas en ningún lado más.

---

## 📋 Checklist al darle handoff a alguien

- [ ] Invité a la persona a GitHub como collaborator
- [ ] Invité a la persona a Supabase como project member
- [ ] Invité a la persona a Vercel como team member
- [ ] Le pasé el link a este `handoff/` y al `HANDOFF.md`
- [ ] Le dije que lea `CREDENCIALES.md` (sección "Checklist de onboarding")
- [ ] Confirmé que la persona puede correr `npm run dev` localmente con su propia ANON key
- [ ] **NO le pasé credenciales por chat / email / WhatsApp**

Cuando termine su trabajo:

- [ ] Removí su acceso de GitHub
- [ ] Removí su acceso de Supabase
- [ ] Removí su acceso de Vercel
- [ ] Si compartí algún secreto puntual, lo roté

---

> Versión `v1.0.0` · 2026-04-23
> Este documento debe vivir en el repo (es solo guía, no contiene secretos).
