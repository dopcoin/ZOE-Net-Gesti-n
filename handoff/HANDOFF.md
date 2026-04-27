# 📦 HANDOFF — ZOE Net Gestión

> Documento de traspaso para continuar el desarrollo de la plataforma de gestión empresarial **ZOE Net Gestión**.

---

## 1. Identidad del proyecto

| Campo | Valor |
|---|---|
| **Nombre** | ZOE Net Gestión |
| **Versión actual** | `v1.0.0` (2026-04-23) |
| **Repositorio** | https://github.com/dopcoin/ZOE-Net-Gesti-n |
| **Owner** | Sheka — `dopcoinrd@gmail.com` |
| **Idioma** | Español (Rep. Dominicana) — moneda DOP |
| **Stack** | Next.js 14 (App Router) · TypeScript · Supabase · Tailwind · Recharts · Zustand · Sonner |
| **Hosting App** | Vercel |
| **Hosting BD** | Supabase (Postgres + Auth + RLS + Realtime) |
| **Proyecto Supabase** | `bsiouklwhnxflorsrphz` (`https://bsiouklwhnxflorsrphz.supabase.co`) |

---

## 2. Qué hace la plataforma

Sistema integral de gestión para un proveedor de internet (ISP) en República Dominicana. Cubre:

### Operaciones
- **Clientes**: CRM con planes mensuales, estados (activo/inactivo/nuevo/becado/suspendido), GPS, credenciales router, IP asignada.
- **Instalaciones**: workflow de instalación/mantenimiento con asignación de técnicos, prioridad y cobros opcionales por instalación.
- **Tareas**: gestión de pendientes por equipo (soporte, financiero, administrativo).

### Ventas y Cobros
- **Cobros**: facturación mensual recurrente con estados (pagado/pendiente/mora/exonerado/parcial), método de pago, "recibido por".
- **Facturas**: emisión de facturas formales con items, ITBIS, descuentos.
- **Ventas**: directas y por revendedor, con cálculo automático de margen (`precio_venta - precio_compra`).
- **Revendedores**: socios con comisiones (porcentaje/fijo/mixto) y ledger de ganancias.

### Inventario
- **Inventario / Mercancía**: stock, mín/máx, precio compra/venta, categorías.
- **Conciliación**: comparación stock sistema vs físico con diferencias.

### Contabilidad
- **Libro Diario**: entradas/salidas con categorías. Vinculación bidireccional con cobros/ventas/facturas/instalaciones (`origen_id` + `origen_tipo`).

### Análisis (página `/finanzas`)
- KPIs financieros: Ingresos, Egresos, Utilidad Neta, Margen Neto.
- KPIs ejecutivos: MRR (Monthly Recurring Revenue), ARPU, Por Cobrar, Comisiones Pendientes.
- Flujo de caja 12 meses.
- Aging de cuentas por cobrar (corriente / 30 / 60 / 90+).
- Top deudores y top clientes.
- Export CSV del estado de resultados.

### Sistema
- **Equipo**: usuarios con roles (admin/soporte/financiero/administrativo).
- **Activity Log**: audit trail con realtime subscription.

---

## 3. Arquitectura

```
┌────────────────────────────────────────────────────────────┐
│  Next.js 14 App Router (Vercel)                            │
│  ├── src/app/(dashboard)/...    Server Components          │
│  ├── src/components/...         Client Components          │
│  ├── src/lib/supabase/          Browser + Server clients   │
│  ├── src/lib/services.ts        Centralized DB operations  │
│  └── src/store/                 Zustand stores             │
└────────────────────────────────────────────────────────────┘
                       ↕ HTTP + WebSocket (realtime)
┌────────────────────────────────────────────────────────────┐
│  Supabase (Postgres + Auth + RLS)                          │
│  ├── Tablas: clientes, cobros, mercancia, ventas, ...      │
│  ├── RLS policies por rol                                  │
│  ├── Triggers: activity_log, ganancias_revendedores        │
│  └── Auth: Email/Password + Magic Link                     │
└────────────────────────────────────────────────────────────┘
```

### Patrones clave

- **Server Components** fetchean datos iniciales con `createClient()` de `lib/supabase/server.ts` (usa cookies para SSR auth).
- **Client Components** mutan datos con `createClient()` de `lib/supabase/client.ts` (`createBrowserClient`).
- **`lib/services.ts`** centraliza todas las mutaciones (CRUD de cada entidad) con error handling tipado (`ServiceResult<T>`).
- **`lib/version.ts`** es la única fuente de verdad para la versión (importa de `package.json`).
- **`useAuthStore` (Zustand)** persiste el `profile` del usuario logueado.
- **RLS**: todas las tablas tienen Row Level Security activado. La política SELECT del `libro_diario` es `USING (true)` para todos los autenticados.

---

## 4. Archivos clave

### Configuración global
| Ruta | Propósito |
|---|---|
| `package.json` | Versión + dependencias + scripts (`release:patch/minor/major`) |
| `tailwind.config.ts` | Tema con paleta de colores + breakpoint `xs: 400px` |
| `tsconfig.json` | TS strict + `paths: { "@/*": ["./src/*"] }` |
| `next.config.mjs` | Config Next.js (mínima) |
| `src/app/globals.css` | Design system completo (`.kpi-card`, `.list-card`, `.aging-bucket`, etc.) |
| `src/app/layout.tsx` | Root layout con viewport mobile-first |
| `src/middleware.ts` | Auth middleware Supabase |

### Layout principal
| Ruta | Propósito |
|---|---|
| `src/app/(dashboard)/layout.tsx` | Layout autenticado con Sidebar, Header, BottomNav |
| `src/components/layout/Sidebar.tsx` | Navegación agrupada (Resumen, Operaciones, Ventas, Inventario, Contabilidad, Sistema) |
| `src/components/layout/Header.tsx` | Header con breadcrumb + badge de versión |
| `src/components/layout/MobileBottomNav.tsx` | Tab bar inferior solo en móvil |
| `src/components/layout/AuthProvider.tsx` | Context provider con profile cargado |
| `src/components/shared/PageHeader.tsx` | Header reutilizable de página |

### Datos
| Ruta | Propósito |
|---|---|
| `src/types/index.ts` | Todos los tipos TypeScript (Profile, Cliente, Cobro, ...) |
| `src/lib/services.ts` | CRUD centralizado con `ServiceResult<T>` |
| `src/lib/supabase/client.ts` | Browser client (`createBrowserClient`) |
| `src/lib/supabase/server.ts` | Server client (`createServerClient` + cookies) |
| `src/lib/utils.ts` | `formatCurrency`, `formatDate`, `meses[]`, helpers de color |
| `src/lib/version.ts` | `APP_VERSION`, `APP_NAME`, `BUILD_DATE` |

### Páginas críticas (server + client)
| Página | Server `page.tsx` | Client component |
|---|---|---|
| Dashboard | `src/app/(dashboard)/dashboard/page.tsx` | `src/components/dashboard/DashboardClient.tsx` |
| Finanzas | `src/app/(dashboard)/finanzas/page.tsx` | `src/components/finanzas/FinanzasClient.tsx` |
| Cobros | `src/app/(dashboard)/cobros/page.tsx` | `src/components/cobros/CobrosClient.tsx` |
| Libro Diario | `src/app/(dashboard)/libro-diario/page.tsx` | `src/components/libro-diario/LibroDiarioClient.tsx` |
| Instalaciones | `src/app/(dashboard)/instalaciones/page.tsx` | `src/components/shared/InstalacionesClient.tsx` |
| Ventas | `src/app/(dashboard)/ventas/page.tsx` | `src/components/shared/VentasClient.tsx` |
| Facturas | `src/app/(dashboard)/facturas/page.tsx` | `src/components/shared/FacturasClient.tsx` |

---

## 5. Esquema de base de datos (Supabase)

### Tablas principales

| Tabla | Columnas críticas |
|---|---|
| `profiles` | id, email, nombre, apellido, rol, equipo |
| `clientes` | id, nombre, apellido, cedula, plan, plan_mensual, estado, beca, fecha_inicio, gps_*, router_* |
| `cobros` | id, cliente_id, mes, anio, monto, estado, tipo_pago, fecha_pago, recibido_por |
| `mercancia` | id, nombre, categoria_id, precio_compra, precio_venta, stock, stock_minimo |
| `ventas` | id, mercancia_id, cantidad, precio_unitario, total, ganancia, tipo, estado, cliente_id, revendedor_id |
| `revendedores` | id, nombre, apellido, tipo_comision, comision_porcentaje, comision_fijo |
| `ganancias_revendedores` | id, revendedor_id, venta_id, monto, pagado, fecha_pago |
| `instalaciones` | id, cliente_id, tipo, direccion, prioridad, estado, costo, estado_cobro, **metodo_pago**, **recibido_en** |
| `facturas` | id, numero, cliente_id, items (jsonb), subtotal, descuento, itbis, total, estado |
| `libro_diario` | id, fecha, tipo, categoria, descripcion, monto, **metodo_pago**, **recibido_en**, **origen_id**, **origen_tipo**, registrado_por |
| `tareas` | id, titulo, descripcion, equipo, asignado_a, prioridad, fecha_limite, completada, completada_en |
| `conciliacion` | id, mercancia_id, stock_sistema, stock_fisico, diferencia, revendedor_id, fecha |
| `activity_log` | id, usuario_id, accion, entidad, entidad_id, detalles (jsonb), created_at |

### Migraciones SQL pendientes de aplicar

Si se trabaja sobre BD limpia, asegurar estas columnas existen:

```sql
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS recibido_en TEXT;
ALTER TABLE libro_diario ADD COLUMN IF NOT EXISTS origen_id UUID;
ALTER TABLE libro_diario ADD COLUMN IF NOT EXISTS origen_tipo TEXT;
ALTER TABLE libro_diario ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
ALTER TABLE libro_diario ADD COLUMN IF NOT EXISTS recibido_en TEXT;
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS recibido_por TEXT;

-- RLS policy crítica para que aparezcan los registros
CREATE POLICY "ver_libro_diario" ON libro_diario
  FOR SELECT TO authenticated USING (true);
```

---

## 6. Lógica financiera importante

### Vinculación bidireccional Libro Diario ↔ Origen

**Cuando se marca como pagado un cobro/instalación/venta/factura** → se inserta automáticamente en `libro_diario` con `origen_id` + `origen_tipo`.

**Cuando se elimina la entrada del libro diario**:
- `origen_tipo='cobro'` → revierte el cobro a `pendiente` (NO se elimina porque es recurrente mensual)
- `origen_tipo='instalacion'` → **ELIMINA** la instalación completa
- `origen_tipo='venta'` → **ELIMINA** la venta + restaura stock
- `origen_tipo='factura'` → **ELIMINA** la factura completa

**Cuando se elimina la entidad origen** → se eliminan automáticamente las entradas vinculadas en libro_diario.

### Cálculos en `/finanzas`

| Métrica | Fórmula |
|---|---|
| **MRR** | `Σ plan_mensual` de clientes activos (no becados) |
| **ARPU** | `MRR / count(clientes activos no becados)` |
| **Margen Neto** | `(Ingresos - Egresos) / Ingresos × 100` |
| **Aging** | Diferencia en meses entre cobro pendiente y mes actual: `current` (≤0), `d30` (1), `d60` (2), `d90` (3+) |
| **Margen Venta** | `(precio_venta - precio_compra) / precio_venta × 100` |

---

## 7. Estado actual y pendientes

### ✅ Completado en v1.0.0

- [x] CRUD completo de todas las entidades
- [x] Auth con Supabase + roles
- [x] RLS configurado en todas las tablas
- [x] Activity log con realtime
- [x] Libro Diario con vinculación bidireccional
- [x] Página `/finanzas` con KPIs ejecutivos, aging, flujo de caja
- [x] Dashboard rediseñado como cockpit financiero
- [x] Mobile-first responsive (bottom nav, safe-area, modal bottom-sheet)
- [x] Navegación agrupada en sidebar
- [x] Versionado semántico + CHANGELOG
- [x] Export CSV de estado de resultados

### 🚧 Pendiente / Próximas iteraciones

**Mobile (alta prioridad)**:
- [ ] Migrar tablas restantes a vista de cards en móvil: Cobros, Ventas, Instalaciones, Facturas, Clientes, Inventario
- [ ] Validar swipe-to-close en modales bottom-sheet
- [ ] Probar PWA (manifest.json + service worker para uso offline básico)

**Funcional**:
- [ ] Notificaciones (campana del header está sin lógica)
- [ ] Generación de PDF de facturas
- [ ] WhatsApp integration para envío de recordatorios de cobro
- [ ] Búsqueda global con cmd+K
- [ ] Importación masiva CSV de clientes

**Análisis financiero**:
- [ ] Year-over-year comparison en reportes
- [ ] Forecasting de cash flow (próximos 3 meses)
- [ ] Alertas automáticas de mora (cliente con N meses pendientes)
- [ ] P&L formal por período con comparativo presupuesto vs real

**Operaciones**:
- [ ] SLA tracking de instalaciones (días hasta completar)
- [ ] Time tracking de técnicos
- [ ] Subtareas y dependencias en `/tareas`

**Tech debt**:
- [ ] Tests (Vitest + Playwright)
- [ ] Reemplazar cálculos client-side por SQL views materializadas
- [ ] Indexes en campos de búsqueda frecuente (cliente_id, mes+anio en cobros)
- [ ] Storybook para documentar componentes del design system
- [ ] Internationalización (i18n) — actualmente todo está hardcoded en español

**Seguridad**:
- [ ] Auditoría completa de RLS policies por rol
- [ ] Rate limiting en endpoints críticos
- [ ] 2FA opcional para admins
- [ ] Backups programados de BD

---

## 8. Cómo correr el proyecto localmente

```bash
# 1. Clonar
git clone https://github.com/dopcoin/ZOE-Net-Gesti-n.git
cd ZOE-Net-Gesti-n

# 2. Instalar dependencias
npm install

# 3. Configurar credenciales
cp .env.example .env.local   # luego rellenar con valores reales

# 4. Correr
npm run dev                  # http://localhost:3000

# Otros scripts útiles
npm run build                # build de producción
npm run lint                 # linter
npm run release:patch        # bump 1.0.0 → 1.0.1 + commit + tag
npm run release:minor        # bump 1.0.0 → 1.1.0
npm run release:major        # bump 1.0.0 → 2.0.0
```

---

## 9. Deploy

- **Producción**: Vercel (auto-deploy desde rama `main` de GitHub).
- **Variables de entorno** se configuran en Vercel Project Settings → Environment Variables (ver `CREDENCIALES.md`).
- **DB migrations**: ejecutar SQL manualmente en Supabase Dashboard → SQL Editor.

---

## 10. Convenciones del proyecto

- **Idioma**: nombres de archivos y código en español, comentarios en español.
- **Moneda**: DOP (peso dominicano), formato `RD$ 1,234.56`.
- **Fechas**: formato `dd/MM/yyyy` y `MMM yyyy` para meses.
- **Commits**: formato `tipo(scope): mensaje` (feat, fix, chore, refactor, docs).
- **Versiones**: semantic versioning con tags `vX.Y.Z` en git.
- **Estilo**: Tailwind utility-first, design tokens en `globals.css` y `tailwind.config.ts`.

---

## 11. Contactos y permisos

- **Owner / Acceso completo**: Sheka — `dopcoinrd@gmail.com`
- **GitHub**: organización `dopcoin`, repo `ZOE-Net-Gesti-n`
- **Supabase**: dashboard en `https://supabase.com/dashboard/project/bsiouklwhnxflorsrphz`
- **Vercel**: dashboard del proyecto en Vercel del owner

---

> **Última actualización**: 2026-04-23 · **Versión**: v1.0.0
> Para el detalle de cambios por versión, ver [CHANGELOG.md](../CHANGELOG.md).
