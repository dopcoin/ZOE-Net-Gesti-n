-- ============================================================
-- Migración v1.3.1 — Agregar fecha_retiro a clientes
-- ============================================================
-- Para registrar cuándo un cliente fue dado de baja (suspendido/inactivo).
-- Los clientes con estado en ('suspendido', 'inactivo') NO aparecen en
-- la lista de Cobros para nuevos meses.
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS fecha_retiro DATE;

-- Backfill: para los clientes ya retirados, poner today como fecha tentativa
-- (puedes editarla luego cliente por cliente con la fecha real)
UPDATE clientes
SET fecha_retiro = CURRENT_DATE
WHERE estado IN ('suspendido', 'inactivo')
  AND fecha_retiro IS NULL;

-- Verificación
DO $$
DECLARE
  total_retirados INT;
  con_fecha INT;
BEGIN
  SELECT COUNT(*) INTO total_retirados FROM clientes WHERE estado IN ('suspendido', 'inactivo');
  SELECT COUNT(*) INTO con_fecha FROM clientes WHERE fecha_retiro IS NOT NULL;
  RAISE NOTICE 'Clientes retirados: %', total_retirados;
  RAISE NOTICE 'Con fecha_retiro:  %', con_fecha;
END $$;
