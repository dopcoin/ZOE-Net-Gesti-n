-- Comprobantes Fiscales (NCF / DGII República Dominicana)
--
-- Agrega:
-- 1. Distinción persona/empresa en clientes + RNC + razón social
-- 2. Tipo de comprobante (B01 Crédito Fiscal, B02 Consumo, etc.) + NCF en facturas
-- 3. Datos del emisor congelados en cada factura (rnc_emisor, razon_social_emisor)
--    para que facturas históricas no cambien si en el futuro cambia la empresa.

BEGIN;

-- ===== Clientes =====
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_cliente TEXT NOT NULL DEFAULT 'persona';
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS rnc TEXT;
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS razon_social TEXT;

-- Constraint persona/empresa (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_tipo_cliente_check'
  ) THEN
    ALTER TABLE clientes
      ADD CONSTRAINT clientes_tipo_cliente_check
      CHECK (tipo_cliente IN ('persona', 'empresa'));
  END IF;
END $$;

-- ===== Facturas =====
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS tipo_comprobante TEXT NOT NULL DEFAULT 'B02';
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS ncf TEXT;
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS rnc_emisor TEXT NOT NULL DEFAULT '131718264';
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS razon_social_emisor TEXT NOT NULL DEFAULT 'ZoeNet (DopCoin)';
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS direccion_emisor TEXT NOT NULL DEFAULT 'Dr Ferrys #168, La Romana';
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS telefono_emisor TEXT NOT NULL DEFAULT '849-340-4919';

-- Validar formato NCF: B/E + 2 dígitos tipo + 8-10 dígitos secuencia.
-- Permite NULL para facturas tipo B02 sin NCF asignado.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_ncf_format_check'
  ) THEN
    ALTER TABLE facturas
      ADD CONSTRAINT facturas_ncf_format_check
      CHECK (ncf IS NULL OR ncf ~ '^[BE]\d{2}\d{8,10}$');
  END IF;
END $$;

-- Validar tipo_comprobante (lista DGII vigente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_tipo_comprobante_check'
  ) THEN
    ALTER TABLE facturas
      ADD CONSTRAINT facturas_tipo_comprobante_check
      CHECK (tipo_comprobante IN (
        'B01', -- Crédito Fiscal
        'B02', -- Consumo
        'B11', -- Proveedor Informal
        'B14', -- Régimen Especial
        'B15', -- Gubernamental
        'B16', -- Exportaciones
        'E31', -- e-CF Crédito Fiscal
        'E32'  -- e-CF Consumo
      ));
  END IF;
END $$;

-- Index para búsqueda por NCF
CREATE INDEX IF NOT EXISTS idx_facturas_ncf ON facturas(ncf) WHERE ncf IS NOT NULL;

COMMIT;
