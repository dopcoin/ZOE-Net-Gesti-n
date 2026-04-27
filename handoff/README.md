# 📦 Carpeta de Handoff — ZOENet-proyecto-web-handoff

Esta carpeta contiene todo lo necesario para que otra persona (o tu yo del futuro) tome el proyecto **ZOE Net Gestión** y siga trabajando sin perder contexto.

---

## 📁 Contenido

```
handoff/
├── README.md                  ← Este archivo (instrucciones)
├── HANDOFF.md                 ← Documento principal: estado, arquitectura, pendientes
├── CREDENCIALES.md            ← Lista de credenciales necesarias (sin valores reales)
├── COMPARTIR-CREDENCIALES.md  ← Cómo transmitir secretos de forma segura
└── codigo-relevante/
    ├── CHANGELOG.md           ← Histórico de versiones
    ├── env.example            ← Plantilla de variables de entorno
    ├── package.json           ← Dependencias y scripts
    ├── tailwind.config.ts     ← Tema de diseño
    ├── globals.css            ← Design system completo
    ├── types/index.ts         ← Tipos TypeScript de toda la app
    ├── lib/
    │   ├── services.ts        ← CRUD centralizado
    │   ├── version.ts         ← Source of truth de versión
    │   ├── utils.ts           ← Helpers (formatCurrency, formatDate, etc.)
    │   └── supabase/
    │       ├── client.ts      ← Browser client
    │       └── server.ts      ← Server client (SSR)
    ├── layout/
    │   ├── Sidebar.tsx        ← Navegación agrupada
    │   ├── Header.tsx         ← Header con breadcrumb + versión
    │   └── MobileBottomNav.tsx ← Tab bar móvil
    ├── dashboard/
    │   └── DashboardClient.tsx ← Cockpit financiero
    └── finanzas/
        └── FinanzasClient.tsx  ← Análisis financiero ejecutivo
```

> **Nota**: Esta carpeta NO contiene todo el código. Para el código completo, ver el repositorio:
> https://github.com/dopcoin/ZOE-Net-Gesti-n

---

## 🚀 Cómo subir esto a Google Drive

Como no tengo acceso directo a Google Drive desde esta sesión, sigue estos pasos manualmente:

### Opción A — Subir la carpeta completa (recomendado)

1. Abre Google Drive en `https://drive.google.com`
2. Click derecho → **Subir carpeta**
3. Selecciona esta carpeta `handoff/` desde el explorador
4. Una vez subida, renómbrala a `ZOENet-proyecto-web-handoff`
5. (Opcional) Comparte la carpeta con quien necesite acceso

### Opción B — Crear carpeta y subir archivos

1. En Drive: **Nueva carpeta** → nómbrala `ZOENet-proyecto-web-handoff`
2. Entra en la carpeta
3. Drag-and-drop los archivos de esta carpeta `handoff/`
4. (Opcional) Compartir

### Opción C — Comprimir y subir un solo archivo

```powershell
# En PowerShell, desde la raíz del proyecto:
Compress-Archive -Path handoff/* -DestinationPath ZOENet-proyecto-web-handoff.zip
```
Luego sube el `.zip` a Drive.

---

## 🔐 Antes de subir a Drive

Verifica que:

- [ ] **`CREDENCIALES.md` NO contiene valores reales** (solo dice dónde obtenerlos) ✅ ya está limpio
- [ ] **`env.example` NO tiene tokens reales** (es solo la plantilla) ✅ ya está limpio
- [ ] **`.env.local` NO está en esta carpeta** ✅ correcto, no se incluye

Si vas a compartir la carpeta con personas externas:
- Asegúrate de que el repo de GitHub esté en visibilidad correcta
- Considera quitar de `HANDOFF.md` el ID del proyecto Supabase si no quieres exponerlo públicamente

---

## 📝 Mantenimiento

Cada vez que se haga un release significativo:

1. Actualiza `CHANGELOG.md` (en la raíz del repo)
2. Actualiza `HANDOFF.md` sección 7 (estado actual y pendientes)
3. Re-genera la carpeta de handoff:

```powershell
# PowerShell
Remove-Item -Recurse -Force handoff/codigo-relevante/*
# luego repetir los `cp` del README original o ejecutar el script de re-sync
```

4. Re-sube a Drive (sobreescribe la carpeta)

---

## 📞 Acceso necesario para retomar el proyecto

Quien reciba este handoff necesita acceso a:

1. **GitHub**: https://github.com/dopcoin/ZOE-Net-Gesti-n
2. **Supabase**: https://supabase.com/dashboard/project/bsiouklwhnxflorsrphz
3. **Vercel**: https://vercel.com/dashboard (proyecto del owner)
4. (Opcional) **Resend**: https://resend.com/dashboard (si se usa email)

El owner actual (`dopcoinrd@gmail.com`) puede invitar a estos servicios.

---

> Generado para versión `v1.0.0` · 2026-04-23
