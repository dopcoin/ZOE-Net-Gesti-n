#!/usr/bin/env node
/**
 * Ejecuta la migración EJECUTAR_AHORA.sql via Supabase Management API.
 * Uso: SUPABASE_PAT=sbp_xxx node scripts/run-migration.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PAT = process.env.SUPABASE_PAT;
const REF = process.env.SUPABASE_PROJECT_REF || 'bsiouklwhnxflorsrphz';

if (!PAT) {
  console.error('❌ Falta SUPABASE_PAT en env');
  process.exit(1);
}

async function runQuery(query, label) {
  process.stdout.write(`▶ ${label}... `);
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) {
    const text = await r.text();
    console.log('❌');
    console.error(`  ${r.status}: ${text}`);
    return null;
  }
  const data = await r.json();
  console.log('✅');
  return data;
}

// === Migraciones (cada bloque por separado para mejor reporting) ===

const blocks = [
  {
    label: 'clientes.fecha_retiro',
    sql: `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_retiro DATE;`,
  },
  {
    label: 'instalaciones.metodo_pago',
    sql: `ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS metodo_pago TEXT;`,
  },
  {
    label: 'instalaciones.recibido_en',
    sql: `ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS recibido_en TEXT;`,
  },
  {
    label: 'instalaciones.fotos',
    sql: `ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb;`,
  },
  {
    label: 'libro_diario.origen_id',
    sql: `ALTER TABLE libro_diario ADD COLUMN IF NOT EXISTS origen_id UUID;`,
  },
  {
    label: 'libro_diario.origen_tipo',
    sql: `ALTER TABLE libro_diario ADD COLUMN IF NOT EXISTS origen_tipo TEXT;`,
  },
  {
    label: 'libro_diario.metodo_pago',
    sql: `ALTER TABLE libro_diario ADD COLUMN IF NOT EXISTS metodo_pago TEXT;`,
  },
  {
    label: 'libro_diario.recibido_en',
    sql: `ALTER TABLE libro_diario ADD COLUMN IF NOT EXISTS recibido_en TEXT;`,
  },
  {
    label: 'cobros.recibido_por',
    sql: `ALTER TABLE cobros ADD COLUMN IF NOT EXISTS recibido_por TEXT;`,
  },
  {
    label: 'facturas.fecha',
    sql: `ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha DATE;`,
  },
  {
    label: 'Backfill fecha_retiro de retirados',
    sql: `UPDATE clientes SET fecha_retiro = CURRENT_DATE
          WHERE estado IN ('suspendido', 'inactivo') AND fecha_retiro IS NULL;`,
  },
  {
    label: 'Drop check constraint de cobros.estado',
    sql: `DO $$
DECLARE con_name TEXT;
BEGIN
  SELECT conname INTO con_name FROM pg_constraint
  WHERE conrelid = 'cobros'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%estado%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE cobros DROP CONSTRAINT %I', con_name);
  END IF;
END $$;`,
  },
  {
    label: 'Add check constraint con condonado',
    sql: `ALTER TABLE cobros ADD CONSTRAINT cobros_estado_check
          CHECK (estado IN ('pagado','pendiente','mora','exonerado','parcial','condonado'));`,
  },
  {
    label: 'RLS policy ver_libro_diario',
    sql: `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='libro_diario' AND policyname='ver_libro_diario'
  ) THEN
    EXECUTE 'CREATE POLICY "ver_libro_diario" ON libro_diario FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;`,
  },
  {
    label: 'Storage bucket instalacion-fotos',
    sql: `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
          VALUES ('instalacion-fotos', 'instalacion-fotos', true, 5242880,
                  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic'])
          ON CONFLICT (id) DO UPDATE SET public=EXCLUDED.public,
            file_size_limit=EXCLUDED.file_size_limit,
            allowed_mime_types=EXCLUDED.allowed_mime_types;`,
  },
  {
    label: 'Storage policies (drop + recreate)',
    sql: `DROP POLICY IF EXISTS "instalacion_fotos_select" ON storage.objects;
          DROP POLICY IF EXISTS "instalacion_fotos_insert" ON storage.objects;
          DROP POLICY IF EXISTS "instalacion_fotos_update" ON storage.objects;
          DROP POLICY IF EXISTS "instalacion_fotos_delete" ON storage.objects;
          CREATE POLICY "instalacion_fotos_select" ON storage.objects
            FOR SELECT TO public USING (bucket_id='instalacion-fotos');
          CREATE POLICY "instalacion_fotos_insert" ON storage.objects
            FOR INSERT TO authenticated WITH CHECK (bucket_id='instalacion-fotos');
          CREATE POLICY "instalacion_fotos_update" ON storage.objects
            FOR UPDATE TO authenticated USING (bucket_id='instalacion-fotos')
            WITH CHECK (bucket_id='instalacion-fotos');
          CREATE POLICY "instalacion_fotos_delete" ON storage.objects
            FOR DELETE TO authenticated USING (bucket_id='instalacion-fotos');`,
  },
];

console.log('🚀 Ejecutando migración EJECUTAR_AHORA.sql\n');
for (const b of blocks) {
  await runQuery(b.sql, b.label);
}

// Verificación
console.log('\n📊 Verificación...');
const checks = [
  ['clientes.fecha_retiro', `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='fecha_retiro') AS exists;`],
  ['facturas.fecha',        `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facturas' AND column_name='fecha') AS exists;`],
  ['libro_diario.origen_id',`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libro_diario' AND column_name='origen_id') AS exists;`],
  ['cobros condonado',      `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='cobros'::regclass AND pg_get_constraintdef(oid) ILIKE '%condonado%') AS exists;`],
  ['bucket instalacion-fotos',`SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id='instalacion-fotos') AS exists;`],
];

console.log('\n══════════════════════════════════════');
for (const [label, q] of checks) {
  const result = await runQuery(q, `Check: ${label}`);
  if (result && result[0]) {
    console.log(`  ${result[0].exists ? '✅' : '❌'} ${label}`);
  }
}
console.log('══════════════════════════════════════');
console.log('\n🎉 Migración completada');
