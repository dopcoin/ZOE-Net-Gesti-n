-- Vincular facturas con instalaciones
-- Permite generar una factura desde una instalación y ver de qué instalación
-- proviene la factura, sin pasar por el libro_diario.
--
-- Aplicar en Supabase Dashboard → SQL Editor (proyecto bsiouklwhnxflorsrphz).

BEGIN;

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS instalacion_id UUID
  REFERENCES instalaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_instalacion_id
  ON facturas(instalacion_id);

COMMIT;
