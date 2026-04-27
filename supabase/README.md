# Migraciones de Supabase

Carpeta para versionar las migraciones SQL del proyecto. Antes solo vivían en
el SQL Editor del Dashboard, lo que hacía difícil saber el estado real del
schema en cualquier momento. A partir de aquí, **toda DDL nueva** (ALTER,
CREATE TABLE, RLS policies, triggers) debe quedar en un archivo aquí
con prefijo numérico (`0001_`, `0002_`, …).

## Cómo aplicar una migración

Hasta que instalemos el `supabase` CLI en CI, se aplican manualmente:

1. Abrir el SQL Editor del proyecto:
   <https://supabase.com/dashboard/project/bsiouklwhnxflorsrphz/sql/new>
2. Pegar el contenido del archivo `.sql` correspondiente.
3. Ejecutar.
4. Marcar el archivo como aplicado en `_applied.md` con la fecha.

## Migraciones pendientes

| Archivo | Descripción | Aplicada |
|---|---|---|
| `0001_factura_instalacion.sql` | Vincular facturas con instalaciones (`facturas.instalacion_id`) | ❌ |

## Reglas

- **Nunca editar** una migración ya aplicada en prod. Si algo cambia, crear
  una nueva migración (`0002_…`).
- Toda migración debe ser **idempotente** (`IF NOT EXISTS`, `IF EXISTS`) para
  poder re-correrla sin romper.
- Envolver cambios complejos en `BEGIN; … COMMIT;`.
- Si la migración modifica RLS, validar después con un `SELECT` desde el rol
  afectado.
