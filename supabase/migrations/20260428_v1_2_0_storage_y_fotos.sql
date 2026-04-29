-- ============================================================
-- Migración v1.2.0 — Storage bucket + fotos en instalaciones
-- ============================================================
-- Ejecutar en: SQL Editor del dashboard de Supabase
-- https://supabase.com/dashboard/project/bsiouklwhnxflorsrphz/sql/new
-- ============================================================

-- 1) Columna de fotos en instalaciones (array de paths)
ALTER TABLE instalaciones
  ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb;

-- 2) Bucket de Storage para fotos de instalaciones
-- public=true para que las URLs sean accesibles directamente desde la app sin tokens
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instalacion-fotos',
  'instalacion-fotos',
  true,
  5242880, -- 5 MB por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) RLS policies para el bucket
-- (eliminar previas por idempotencia)
DROP POLICY IF EXISTS "instalacion_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "instalacion_fotos_insert" ON storage.objects;
DROP POLICY IF EXISTS "instalacion_fotos_update" ON storage.objects;
DROP POLICY IF EXISTS "instalacion_fotos_delete" ON storage.objects;

-- SELECT: público (las URLs son accesibles sin auth porque el bucket es public=true)
CREATE POLICY "instalacion_fotos_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'instalacion-fotos');

-- INSERT: solo usuarios autenticados pueden subir
CREATE POLICY "instalacion_fotos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'instalacion-fotos');

-- UPDATE: solo usuarios autenticados (para upsert si se usa)
CREATE POLICY "instalacion_fotos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'instalacion-fotos')
  WITH CHECK (bucket_id = 'instalacion-fotos');

-- DELETE: solo usuarios autenticados pueden eliminar
CREATE POLICY "instalacion_fotos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'instalacion-fotos');

-- ============================================================
-- Verificación (opcional — debería retornar el bucket)
-- ============================================================
-- SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'instalacion-fotos';
