# Migraciones de Supabase

Carpeta para versionar las migraciones SQL del proyecto. Antes solo vivían en
el SQL Editor del Dashboard, lo que hacía difícil saber el estado real del
schema en cualquier momento. A partir de aquí, **toda DDL nueva** (ALTER,
CREATE TABLE, RLS policies, triggers) debe quedar en un archivo aquí
con prefijo numérico (`0001_`, `0002_`, …).

## Cómo aplicar una migración

**Vía Management API (preferido)** — requiere `SUPABASE_ACCESS_TOKEN` en
`.env.local`:

```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/bsiouklwhnxflorsrphz/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'query': sys.stdin.read()}))" \
       < supabase/migrations/0001_factura_instalacion.sql)"
```

**Alternativa manual** — Dashboard → SQL Editor:
<https://supabase.com/dashboard/project/bsiouklwhnxflorsrphz/sql/new>

## Estado de migraciones

| Archivo | Descripción | Estado |
|---|---|---|
| `0001_factura_instalacion.sql` | Vincular facturas con instalaciones (`facturas.instalacion_id`) | ✅ Aplicada 2026-04-27 |

## Reglas

- **Nunca editar** una migración ya aplicada en prod. Si algo cambia, crear
  una nueva migración (`0002_…`).
- Toda migración debe ser **idempotente** (`IF NOT EXISTS`, `IF EXISTS`) para
  poder re-correrla sin romper.
- Envolver cambios complejos en `BEGIN; … COMMIT;`.
- Si la migración modifica RLS, validar después con un `SELECT` desde el rol
  afectado.
