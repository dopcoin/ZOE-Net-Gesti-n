# Changelog

Todos los cambios relevantes de **ZOE Net Gestión** se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

## [1.3.8] — 2026-04-29

### Added
- **Navegación entre clientes en el modal de cobros** sin cerrar la ventana:
  - Botones `<` y `>` en el header del modal con tooltip
  - Indicador "X de N" mostrando posición actual en la lista filtrada
  - Atajos de teclado: `←` y `→` para navegar
  - `Esc` para cerrar
  - Las teclas se respetan dentro de inputs (no rompen escritura)
  - El form se actualiza automáticamente al saltar al siguiente cliente
- **Tip visual** dentro del modal explicando los atajos de teclado.
- **Migración Database aplicada** vía Management API:
  - `clientes.fecha_retiro`, `facturas.fecha`, `instalaciones.metodo_pago/recibido_en/fotos`, `libro_diario.origen_id/origen_tipo/metodo_pago/recibido_en`, `cobros.recibido_por`
  - Constraint `cobros_estado_check` actualizado para aceptar `'condonado'`
  - RLS policy `ver_libro_diario`
  - Bucket Storage `instalacion-fotos` con sus 4 RLS policies
- Script de runtime: `scripts/run-migration.mjs` (reusable con `SUPABASE_PAT=...`).

## [1.3.7] — 2026-04-29

### Fixed
- **Warning falso al guardar cliente activo**: el toast de "Cliente guardado pero la fecha de retiro no se persistió" solo aparece ahora si REALMENTE había una fecha de retiro en el form. Para clientes activos comunes, sale `toast.success` normal.
- **"Error al aplicar la remisión: [object Object]"**: el catch ahora extrae correctamente `message`/`details`/`hint` del error de Supabase. Los constraint violations muestran un mensaje claro indicando que falta la migración SQL.

## [1.3.6] — 2026-04-29

### Fixed
- **Error PGRST204 al guardar cliente activo** (cualquier cambio): el código ya no envía `fecha_retiro: null` al payload cuando el cliente está activo/becado/nuevo. Solo se envía cuando tiene un valor real. Esto evita el error de "column not found" mientras la migración SQL no se haya ejecutado.
- **Trade-off conocido**: si reactivas un cliente que tenía fecha_retiro, ahora hay que borrar manualmente la fecha desde el form (visible solo cuando el estado es suspendido/inactivo). Antes se borraba automáticamente.

## [1.3.5] — 2026-04-29

### Added
- **Migración consolidada `supabase/migrations/EJECUTAR_AHORA.sql`** que aplica de un golpe TODAS las pendientes:
  - `clientes.fecha_retiro` (v1.3.1)
  - `cobros.estado` acepta `'condonado'` (v1.3.2)
  - `facturas.fecha`, `instalaciones.fotos/metodo_pago/recibido_en`, `libro_diario.origen_id/origen_tipo/metodo_pago/recibido_en`, `cobros.recibido_por`
  - RLS policy `ver_libro_diario` y bucket de Storage `instalacion-fotos`
  - **Idempotente** — re-ejecutable sin riesgo
  - Verificación al final con `RAISE NOTICE` confirmando cada item

### Fixed
- **Error oculto al guardar cliente con fecha de retiro**: si la columna no existe en BD, el código ahora hace retry sin el campo y muestra un warning claro indicando qué SQL ejecutar — antes mostraba un PGRST204 críptico.
- **Error oculto al marcar Remitir/Condonar**: si el constraint no acepta el estado, ahora se muestra un mensaje específico apuntando al SQL de migración pendiente.

## [1.3.4] — 2026-04-29

### Changed
- **"Condonar" renombrado a "Remitir/Remisión"** (terminología financiera correcta).
  - El estado interno en BD sigue siendo `condonado` (compatibilidad con datos existentes), pero la UI muestra siempre "Remitido" / "Remisión".
- **Botón "Remitir" ahora es un dropdown** con porcentajes preestablecidos:
  - **20%** → cliente paga 80% (estado `parcial` con descuento aplicado)
  - **30%** → cliente paga 70%
  - **50%** → cliente paga 50%
  - **100%** → cliente NO paga (estado `condonado`)
  - Cada opción muestra el descuento y monto a pagar antes de confirmar
- **Layout del row de cobros corregido**: ancho de columna de acciones ampliado de 180px a 300px → el badge "Pendiente" ya no queda tapado por los botones.
- **`whitespace-nowrap`** agregado al badge de estado para evitar que se rompa en 2 líneas.

## [1.3.3] — 2026-04-29

### Added
- **Desglose de recaudación por tipo de pago** en `/cobros`:
  - Card visual con barras de progreso por categoría: Efectivo, Transferencia, Cheque, Tarjeta, Otro
  - Cada barra muestra monto, % del total y total de la categoría
  - Detección automática de cheques aunque estén guardados como `transferencia` (cuando `recibido_por` contiene "cheque")
- **Desglose de recaudación por receptor** en `/cobros`:
  - Quién recolectó cada peso (Rodeo, Oscar, DopCoin Cheque, etc.)
  - Ordenado por monto descendente
  - Muestra monto + % del total
- Útil para conciliación bancaria y rendición de cuentas con cobradores.

## [1.3.2] — 2026-04-29

### Added
- **Nuevo estado de cobro: `condonado`** — perdonar el cobro de un mes específico (cortes de servicio, fallas, cortesía):
  - Distinto a `exonerado` (cliente becado permanente)
  - Solo aplica al mes específico, no afecta a meses futuros
  - Monto se setea automáticamente en RD$0 (no aplica)
  - Color cyan en el badge para distinguir visualmente
  - Migración SQL: `supabase/migrations/20260429_v1_3_2_condonado.sql`
- **Botón rápido "Condonar"** en cada fila de la lista de cobros (entre "Pagar" y "Mora")
  - Confirmación antes de aplicar
  - Nota automática: "Condonado por cortes/falla de servicio"
- **Stats actualizados**:
  - "Tasa de cobro" ahora cuenta condonados como resueltos (no penaliza el porcentaje)
  - "Por cobrar" excluye condonados y exonerados (es realista)
  - Pagados+parciales se cuentan juntos para "Total recaudado"

### Fixed
- El monto del modal se auto-restablece al monto mensual del cliente cuando cambias entre estados (pagado/pendiente/mora) — antes había que escribirlo manualmente.

## [1.3.1] — 2026-04-29

### Added
- **Fecha de retiro de clientes**: nuevo campo `fecha_retiro DATE` en tabla `clientes`.
  - Migración SQL: `supabase/migrations/20260429_v1_3_1_fecha_retiro.sql`
  - Aparece automáticamente en el form de cliente cuando el estado es `suspendido` o `inactivo`
  - Auto-llenado con fecha actual al cambiar el estado a retirado
  - Se limpia automáticamente al reactivar el cliente
- **Clientes retirados ya no aparecen en `/cobros`**:
  - El query ahora filtra por `estado in ('activo', 'becado', 'nuevo')` — los suspendidos/inactivos quedan fuera
  - Sus cobros históricos siguen visibles en Finanzas y Libro Diario (auditoría)

### Fixed
- Crash en búsqueda de clientes/cobros/ventas/instalaciones/facturas/historial cuando algún cliente tenía `apellido = null` (introducido por la importación del sheet con clientes de un solo nombre).

## [1.3.0] — 2026-04-29

### Added
- **Seed inicial de datos** (`supabase/migrations/20260429_v1_3_0_seed_inicial.sql`):
  - Importación desde el Google Sheets histórico "Cobros ZAID-INTERNET"
  - **38 clientes** con localidad, monto mensual, estado, becas, fecha de inicio y notas
  - **~140 cobros mensuales** (nov 2025 → abr 2026) con estado, tipo de pago y "recibido por"
  - **18 productos de inventario** (orden septiembre 2025 + orden enero 2026)
  - SQL **idempotente** (NOT EXISTS) — re-ejecutable sin duplicar
  - Bloque de verificación al final que reporta totales en NOTICE

### Pendiente
- Rediseño de **Conciliaciones** como flujo de consignación a revendedores:
  - Tabla nueva o extensión de `conciliacion` para registrar equipos entregados al revendedor (consignación).
  - Cálculo automático: `entregados − devueltos − vendidos = a cobrar`.
  - Marcado de "pagado" con vinculación a Libro Diario.
  - Stats por revendedor (entregado, vendido, debido).
- Avatares de usuario en `/equipo` (skipped en v1.2.0 por solicitud).
- Refactor de services CRUD para que llamen automáticamente `logActivity()` en cada create/update/delete.

## [1.2.0] — 2026-04-28

### Added
- **Apartado técnico con fotos en Instalaciones**:
  - Componente `PhotoGallery` reutilizable: uploader multi-archivo, grid con previews, lightbox, delete on hover.
  - Hasta 10 fotos por instalación, 5MB cada una, formatos `image/*`.
  - Bucket público de Supabase Storage `instalacion-fotos` con RLS por rol authenticated.
  - Badge en la tabla de instalaciones con conteo de fotos.
  - Las fotos se agregan al editar (ya con ID asignado), no al crear.
- **Página de Historial** (`/historial`) — solo accesible para `admin`:
  - Filtros: usuario, entidad, tipo de acción (crear/editar/eliminar/estado/ver/otro), rango de fechas, búsqueda libre.
  - Stats por tipo de acción + ranking de top 5 usuarios más activos en el rango.
  - Vista cronológica con clasificación visual de acciones por icono y color.
  - Export a CSV con filtros aplicados.
  - Por defecto muestra los últimos 90 días, hasta 2000 registros.
- **Helper `logActivity()`** en `services.ts` — uso simple para registrar acciones desde cualquier componente:
  ```ts
  await logActivity({ accion: 'Cliente creado', entidad: 'clientes', entidad_id: c.id, detalle: c.nombre });
  ```
- **Migración SQL versionada** en `supabase/migrations/20260428_v1_2_0_storage_y_fotos.sql`.

### Changed
- Sidebar: nuevo item **Historial** en grupo Sistema (solo admin).
- Header: breadcrumb actualizado para `/historial`.

---

## [1.1.0] — 2026-04-28

### Added
- **Apartado de Gastos** (`/gastos`) — vista especializada de egresos del Libro Diario:
  - 7 categorías visuales predefinidas con iconos (Nóminas, Mantenimientos, Viáticos, Servicios, Equipos, Suministros, Otros)
  - Cards de categoría clickables: filtran la lista y permiten crear gasto en esa categoría con un click
  - Total general por período + totales individuales por categoría
  - Quick filters (Hoy, Este mes, Mes pasado, Este año)
  - Form rápido con beneficiario, método de pago, referencia, fecha
  - Vista mobile (cards) + desktop (tabla)
- **Libro Diario con rango de fechas + quick filters**:
  - Presets: Hoy, Esta semana, Este mes, Mes pasado, Últimos 30 días, Este año, Personalizado
  - Selector de rango custom con dos campos `date`
  - El rango activo aplica también al cálculo de stats del período
- **Permisos granulares de Inventario**:
  - `soporte` y `financiero` pueden ver el inventario en modo solo lectura
  - `admin` y `administrativo` mantienen control total (crear/editar/eliminar)
  - Indicador visual "Modo solo lectura" en el header
  - Botones de acción ocultos para usuarios sin permisos de edición
- **Facturas con vinculación a inventario, ITBIS toggle, fecha editable** (de v1.0.x previo recopilado).

### Changed
- Sidebar: nuevo item **Gastos** en grupo Contabilidad (visible para admin/financiero/administrativo).
- Header: breadcrumb actualizado para `/gastos`.

### Fixed
- Stats del Libro Diario muestran "del período" en vez de "del mes" cuando el rango no es mensual.

---

## [1.0.0] — 2026-04-23

Primera versión estable. Plataforma completa de gestión ISP con contabilidad, facturación, inventario y análisis financiero.

### Added
- **Navegación agrupada** en el sidebar por áreas funcionales (Resumen, Operaciones, Ventas, Inventario, Contabilidad, Sistema).
- **Indicador de versión** en el sidebar con el número de release actual.
- **Mobile bottom navigation** con 4 atajos principales + acceso al menú completo.
- **Soporte completo para móviles**: viewport correcto, safe-area-insets, Apple Web App metadata, tap-highlight transparente, font-size 16px en inputs (evita zoom iOS), modales como bottom-sheets.
- **Vista de cards** en el Libro Diario para móviles (reemplaza tabla en `< md`).
- **Nueva página `/finanzas`** — análisis financiero ejecutivo con:
  - KPIs principales (Ingresos, Egresos, Utilidad Neta, Margen Neto)
  - KPIs secundarios (MRR, ARPU, Por Cobrar, Comisiones Pendientes)
  - Flujo de caja de 12 meses
  - Ingresos y egresos por categoría con pie charts
  - Aging de cuentas por cobrar (corriente / 30 / 60 / 90+ días)
  - Top deudores y top clientes con rankings
  - Comisiones por pagar a revendedores
  - Export a CSV del estado de resultados
- **Dashboard rediseñado** como cockpit financiero con:
  - Salud Financiera (4 KPIs con indicadores delta mes vs mes anterior)
  - Flujo de caja últimos 6 meses (gráfico compuesto barras + línea)
  - Cuentas por cobrar con aging
  - KPIs operacionales (Clientes, Tasa Cobro, Ventas, Instalaciones, Tareas)
  - Actividad en tiempo real
- **Vinculación bidireccional Libro Diario ↔ origen**:
  - Cobro/Venta/Instalación/Factura pagada → crea entrada automática en Libro Diario
  - Revertir estado → elimina entrada del Libro Diario
  - Eliminar desde Libro Diario → elimina instalación/venta/factura (o revierte cobro recurrente)
- **Design system profesional**:
  - Tipografía monoespaciada `JetBrains Mono` con `tabular-nums` para cifras financieras
  - KPI cards con barras de color gradientes por categoría (ingreso/egreso/balance/margen)
  - Indicadores delta (↑ verde / ↓ rojo / = gris)
  - Aging buckets con colores de riesgo progresivos
  - Badges semánticos (`badge-success`, `badge-warning`, `badge-danger`, `badge-info`)
  - Animaciones `fadeIn`, `slideUp`, `pulseGlow`
- **Método de pago y "Recibido por/en"** en Cobros, Instalaciones, Libro Diario.
- **"Recibido por" como select creatable** (+ botón para agregar nuevos valores) en Cobros e Instalaciones.
- **Ventas con selector prominente** directa/revendedor (toggle buttons).
- **Breakpoint `xs: 400px`** en Tailwind para phones grandes vs pequeños.

### Changed
- Toaster posicionado `top-center` con `maxWidth: 95vw` (mejor UX móvil).
- Sidebar con ancho `85vw max-w-[320px]` en móvil, 85% en vez de 64 fijos.
- Tap targets mínimos de 42px en botones, 40px en botones icono (WCAG AA).
- Inputs con `py-2.5` en móvil vs `py-2` en desktop.
- Scrollbars ocultos (`width: 0`) en móviles.
- Header muestra título de página actual en móvil.

### Fixed
- RLS del Libro Diario ahora permite `SELECT` a usuarios `authenticated`.
- `registrado_por` solo se incluye cuando hay `profile?.id` (evita FK null).
- Zoom automático en iOS al hacer focus en inputs (font-size ≥ 16px).

---

## Leyenda

- **Added** — Nuevas funcionalidades.
- **Changed** — Cambios en funcionalidades existentes.
- **Deprecated** — Funcionalidades que serán removidas.
- **Removed** — Funcionalidades eliminadas.
- **Fixed** — Corrección de bugs.
- **Security** — Parches de seguridad.
