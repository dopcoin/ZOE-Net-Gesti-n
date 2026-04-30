-- ============================================================
-- 🚨 EJECUTAR ESTE SQL UNA VEZ EN SUPABASE AHORA
-- ============================================================
-- Consolidación de TODAS las migraciones pendientes:
--   v1.2.0 — storage bucket + columnas (facturas.fecha, libro_diario.origen, etc.)
--   v1.3.1 — clientes.fecha_retiro
--   v1.3.2 — cobros.estado acepta 'condonado'
--
-- Este script es IDEMPOTENTE — se puede correr varias veces sin problema.
-- Pegar en: https://supabase.com/dashboard/project/bsiouklwhnxflorsrphz/sql/new
-- Click "Run" y listo. ✅
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- 1) Columnas pendientes en tablas existentes
-- ════════════════════════════════════════════════════════════
ALTER TABLE clientes      ADD COLUMN IF NOT EXISTS fecha_retiro DATE;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS recibido_en TEXT;
ALTER TABLE instalaciones ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE libro_diario  ADD COLUMN IF NOT EXISTS origen_id UUID;
ALTER TABLE libro_diario  ADD COLUMN IF NOT EXISTS origen_tipo TEXT;
ALTER TABLE libro_diario  ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
ALTER TABLE libro_diario  ADD COLUMN IF NOT EXISTS recibido_en TEXT;
ALTER TABLE cobros        ADD COLUMN IF NOT EXISTS recibido_por TEXT;
ALTER TABLE facturas      ADD COLUMN IF NOT EXISTS fecha DATE;

-- ════════════════════════════════════════════════════════════
-- 2) Backfill: clientes ya retirados con fecha tentativa
-- ════════════════════════════════════════════════════════════
UPDATE clientes
SET fecha_retiro = CURRENT_DATE
WHERE estado IN ('suspendido', 'inactivo')
  AND fecha_retiro IS NULL;

-- ════════════════════════════════════════════════════════════
-- 3) Constraint de cobros.estado: agregar 'condonado'
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE con_name TEXT;
BEGIN
  SELECT conname INTO con_name FROM pg_constraint
  WHERE conrelid = 'cobros'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%estado%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE cobros DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE cobros ADD CONSTRAINT cobros_estado_check
  CHECK (estado IN ('pagado', 'pendiente', 'mora', 'exonerado', 'parcial', 'condonado'));

-- ════════════════════════════════════════════════════════════
-- 4) RLS policy del Libro Diario (visible a authenticated)
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'libro_diario'
      AND policyname = 'ver_libro_diario'
  ) THEN
    EXECUTE 'CREATE POLICY "ver_libro_diario" ON libro_diario FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 5) Storage bucket para fotos de instalaciones
-- ════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instalacion-fotos', 'instalacion-fotos', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "instalacion_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "instalacion_fotos_insert" ON storage.objects;
DROP POLICY IF EXISTS "instalacion_fotos_update" ON storage.objects;
DROP POLICY IF EXISTS "instalacion_fotos_delete" ON storage.objects;

CREATE POLICY "instalacion_fotos_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'instalacion-fotos');
CREATE POLICY "instalacion_fotos_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'instalacion-fotos');
CREATE POLICY "instalacion_fotos_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'instalacion-fotos')
  WITH CHECK (bucket_id = 'instalacion-fotos');
CREATE POLICY "instalacion_fotos_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'instalacion-fotos');

COMMIT;

-- ════════════════════════════════════════════════════════════
-- ✅ Verificación
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  has_fecha_retiro BOOLEAN;
  has_fecha_factura BOOLEAN;
  has_origen_libro BOOLEAN;
  has_condonado BOOLEAN;
  has_bucket BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='fecha_retiro') INTO has_fecha_retiro;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facturas' AND column_name='fecha') INTO has_fecha_factura;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libro_diario' AND column_name='origen_id') INTO has_origen_libro;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'cobros'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%condonado%'
  ) INTO has_condonado;
  SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id='instalacion-fotos') INTO has_bucket;

  RAISE NOTICE '═════════════════════════════════════';
  RAISE NOTICE '✅ MIGRACIÓN COMPLETADA';
  RAISE NOTICE '═════════════════════════════════════';
  RAISE NOTICE '  clientes.fecha_retiro:        %', has_fecha_retiro;
  RAISE NOTICE '  facturas.fecha:               %', has_fecha_factura;
  RAISE NOTICE '  libro_diario.origen_id:       %', has_origen_libro;
  RAISE NOTICE '  cobros acepta ''condonado'':    %', has_condonado;
  RAISE NOTICE '  bucket instalacion-fotos:     %', has_bucket;
  RAISE NOTICE '═════════════════════════════════════';
END $$;
