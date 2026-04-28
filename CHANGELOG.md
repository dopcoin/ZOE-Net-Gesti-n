# Changelog

Todos los cambios relevantes de **ZOE Net Gestión** se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

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
