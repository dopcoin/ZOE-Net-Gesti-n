-- ============================================================
-- Migración v1.3.2 — Estado "condonado" en cobros
-- ============================================================
-- Permite marcar un cobro como condonado: el cliente no paga ese
-- mes específico por motivos de servicio (cortes/fallas/cortesía).
-- Distinto a "exonerado" (becado permanente).
-- ============================================================

-- 1) Buscar el constraint actual y eliminarlo (su nombre puede variar)
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'cobros'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%estado%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE cobros DROP CONSTRAINT %I', con_name);
    RAISE NOTICE 'Constraint % eliminado', con_name;
  ELSE
    RAISE NOTICE 'No se encontró constraint previo en cobros.estado';
  END IF;
END $$;

-- 2) Crear el nuevo CHECK constraint con 'condonado' incluido
ALTER TABLE cobros
  ADD CONSTRAINT cobros_estado_check
  CHECK (estado IN ('pagado', 'pendiente', 'mora', 'exonerado', 'parcial', 'condonado'));

-- 3) Verificación
DO $$
DECLARE
  total_cobros INT;
BEGIN
  SELECT COUNT(*) INTO total_cobros FROM cobros;
  RAISE NOTICE '✅ Constraint actualizado. Total cobros en BD: %', total_cobros;
  RAISE NOTICE 'Valores permitidos ahora: pagado, pendiente, mora, exonerado, parcial, condonado';
END $$;
