-- ============================================================
-- Seed inicial v1.3.0 — Importación desde Google Sheets
-- ============================================================
-- Origen: "Cobros ZAID-INTERNET" (sheet ID 1KuhcZCxTphIqcgXXQpYGhPhlHS7QgpI2ZDQSUZ8c630)
-- Última modificación del sheet: 2026-04-06
-- Importa: 38 clientes, ~140 cobros, 18 productos de inventario
--
-- IDEMPOTENTE: usa NOT EXISTS para evitar duplicados — se puede re-ejecutar.
-- Los clientes se identifican por (nombre, apellido).
-- Los cobros por (cliente_id, mes, anio).
-- Los productos por nombre.
--
-- Ejecutar en: SQL Editor del dashboard de Supabase
-- https://supabase.com/dashboard/project/bsiouklwhnxflorsrphz/sql/new
-- ============================================================

BEGIN;

-- =============================================================
-- 1) CLIENTES
-- =============================================================
CREATE TEMP TABLE _seed_clientes (
  nombre TEXT,
  apellido TEXT,
  localidad TEXT,
  monto_mensual NUMERIC,
  estado TEXT,
  beca BOOLEAN,
  notas TEXT,
  fecha_inicio DATE,
  direccion TEXT
);

INSERT INTO _seed_clientes (nombre, apellido, localidad, monto_mensual, estado, beca, notas, fecha_inicio, direccion) VALUES
  ('Agustin',   '(COLMADO)',                'Higua Seibo',    0,    'becado',     true,  'Becado total · Torre Higua',         NULL,         NULL),
  ('Rosa',      'Walki',                    'Rodeo Seibo',    1000, 'becado',     true,  'Becado parcial · Media veca 750',    NULL,         NULL),
  ('Francisco', 'Paula',                    'Rodeo Seibo',    0,    'becado',     true,  'Becado total · Torre Rodeo',         NULL,         NULL),
  ('Milagros',  '',                         'Higua Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-07', NULL),
  ('Don',       'Vicente',                  'Higua Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-11', NULL),
  ('Tolito',    'Colmado',                  'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-01', NULL),
  ('Julio',     'Diego Berroa',             'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-03', NULL),
  ('Cristian',  '/equipos',                 'Rodeo Seibo',    0,    'activo',     false, 'Cliente especial — sin mensualidad',  NULL,         NULL),
  ('Yohana',    '',                         'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-03', NULL),
  ('Yerny',     '(Caballo)',                'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-02', NULL),
  ('Ezequiel',  '(Pastor)',                 'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-03', NULL),
  ('Don',       'Cesar',                    'Rodeo Seibo',    1500, 'activo',     false, 'Paga via Depósito',                   '2025-11-02', NULL),
  ('Dolores',   '',                         'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-02', NULL),
  ('Nancy',     'Peguero',                  'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-03', NULL),
  ('Virginia',  'Pie',                      'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-03', NULL),
  ('Milady',    '',                         'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-02', NULL),
  ('Wanda',     '(Kenia)',                  'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-03', NULL),
  ('Justina',   '',                         'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-02', NULL),
  ('Evelin',    '(Tony)',                   'Rodeo Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-03', NULL),
  ('Maciel',    'Dionis',                   'Rodeo Seibo',    1500, 'activo',     false, 'Paga via Transferencia',              '2025-11-02', NULL),
  ('Kikila',    'Pie',                      'Higua Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-15', NULL),
  ('Agustin',   'Benabel Severino (CASA)',  'Higua Seibo',    1500, 'activo',     false, NULL,                                  '2025-11-02', NULL),
  ('Ivelisset', '',                         'Higua Seibo',    1500, 'activo',     false, NULL,                                  '2025-12-22', NULL),
  ('ESCUELA',   'BASICA RODEO',             'Rodeo Seibo',    1770, 'activo',     false, 'Pagan via Cheque',                    '2025-11-11', NULL),
  ('ESCUELA',   'BASICA HIGUA',             'Higua Seibo',    1770, 'activo',     false, 'Pagan via Cheque',                    '2025-11-11', NULL),
  ('Licenciada','C.',                       'Higua Seibo',    1500, 'activo',     false, NULL,                                  '2025-12-31', NULL),
  ('Francisco', 'Polanco',                  'Rodeo Seibo',    1500, 'suspendido', false, 'Cortado · Debe 3 Meses',              '2025-11-03', 'Atras del Play'),
  ('Andres',    '(Papa)',                   'Rodeo Seibo',    1500, 'inactivo',   false, 'Fuera de Servicio · Se cambió a Starlink', '2025-11-02', NULL),
  ('Alondra',   'Maria',                    'Villa Real LR',  1500, 'activo',     false, 'Cambiar antena y Modificar',          '2026-04-01', NULL),
  ('Delia',     'Maria',                    'Villa Real LR',  1500, 'activo',     false, 'Instalado y funcionando',             '2025-11-06', NULL),
  ('Paula',     'Areche',                   'Villa Real LR',  1500, 'becado',     true,  'Becado · Funcionando',                '2025-11-06', NULL),
  ('Porfirio',  'Roman',                    'Villa Real LR',  1500, 'becado',     true,  'Becado · Atrasado',                   '2025-11-01', NULL),
  ('Nicol',     'M',                        'Villa Real LR',  1500, 'activo',     false, 'Funcionando',                         '2025-11-06', NULL),
  ('Wilmari',   '',                         'Higua Seibo',    0,    'inactivo',   false, 'Fuera de Servicio',                   NULL,         NULL),
  ('Erick',     'Gil',                      'Higua Seibo',    1500, 'activo',     false, 'Instalado y probado dia 22 por Kendry · Pago via transferencia · Pendiente pago Kendry', '2026-01-22', 'Frente a la Torre Higua'),
  ('Wanda',     'Kenia Mercedes',           'Higua Seibo',    1500, 'activo',     false, 'Activo proporcional · Instalada en el play una Litebeam, instalación completa (RD$6,000) + 80 pies de cable (RD$800) + regleta (RD$300) + tubos y cemento (RD$3,500)', '2026-02-09', NULL),
  ('Ada',       'Severino (Dulceria)',      'Rodeo Seibo',    1500, 'activo',     false, 'Activo proporcional · Una loco · Falta tubos rígidos (666x3=1800) · Se instalaron tubos 4 y alambre', '2026-02-09', NULL),
  ('Cheo',      'Moreno',                   'Higua Seibo',    1500, 'activo',     false, 'Instalado',                           '2026-03-07', NULL);

-- Insertar solo los clientes que NO existen
INSERT INTO clientes (nombre, apellido, localidad, monto_mensual, estado, beca, notas, fecha_inicio, direccion)
SELECT s.nombre, NULLIF(s.apellido, ''), s.localidad, s.monto_mensual, s.estado, s.beca, s.notas, s.fecha_inicio, s.direccion
FROM _seed_clientes s
WHERE NOT EXISTS (
  SELECT 1 FROM clientes c
  WHERE c.nombre = s.nombre AND COALESCE(c.apellido, '') = COALESCE(s.apellido, '')
);


-- =============================================================
-- 2) COBROS — pagos mensuales por cliente
-- =============================================================
-- Lógica de estado:
--   pagado:    monto pagado >= monto_mensual
--   parcial:   monto pagado > 0 y < monto_mensual
--   pendiente: monto pagado = 0 y cliente activo
--   exonerado: cliente con beca = true (o monto_mensual = 0)
--
-- Tipo de pago en sheet → mapeo:
--   "Cash Rodeo"            → tipo_pago='efectivo',     recibido_por='Rodeo'
--   "Transferencia Oscar"   → tipo_pago='transferencia',recibido_por='Oscar'
--   "Cheque DopCoin"        → tipo_pago='otro',         recibido_por='DopCoin (Cheque)'

CREATE TEMP TABLE _seed_cobros (
  nombre_cliente TEXT,
  apellido_cliente TEXT,
  mes INT,
  anio INT,
  monto NUMERIC,
  estado TEXT,
  tipo_pago TEXT,
  recibido_por TEXT,
  notas TEXT
);

INSERT INTO _seed_cobros (nombre_cliente, apellido_cliente, mes, anio, monto, estado, tipo_pago, recibido_por, notas) VALUES
  -- Rosa Walki (becado parcial RD$1000)
  ('Rosa', 'Walki', 11, 2025, 1000, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Rosa', 'Walki', 12, 2025, 1000, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Rosa', 'Walki',  1, 2026, 1000, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Rosa', 'Walki',  3, 2026, 1000, 'pendiente', 'efectivo', 'Rodeo', NULL),

  -- Milagros (1500 x 6 meses)
  ('Milagros', '', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milagros', '', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milagros', '',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milagros', '',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milagros', '',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milagros', '',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Don Vicente
  ('Don', 'Vicente', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Don', 'Vicente', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Don', 'Vicente',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Don', 'Vicente',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Don', 'Vicente',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Don', 'Vicente',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Tolito Colmado
  ('Tolito', 'Colmado', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Tolito', 'Colmado', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Tolito', 'Colmado',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Tolito', 'Colmado',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Tolito', 'Colmado',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Tolito', 'Colmado',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Julio Diego Berroa (5 meses)
  ('Julio', 'Diego Berroa', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Julio', 'Diego Berroa', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Julio', 'Diego Berroa',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Julio', 'Diego Berroa',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Julio', 'Diego Berroa',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Yohana (con un mes pendiente)
  ('Yohana', '', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Yohana', '', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Yohana', '',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Yohana', '',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Yohana', '',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', NULL),
  ('Yohana', '',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Yerny (Caballo)
  ('Yerny', '(Caballo)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Yerny', '(Caballo)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Yerny', '(Caballo)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Yerny', '(Caballo)',  2, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', NULL),
  ('Yerny', '(Caballo)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Ezequiel (Pastor)
  ('Ezequiel', '(Pastor)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Ezequiel', '(Pastor)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Ezequiel', '(Pastor)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Ezequiel', '(Pastor)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Ezequiel', '(Pastor)',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', NULL),

  -- Don Cesar (transferencia)
  ('Don', 'Cesar', 11, 2025, 1500, 'pagado', 'transferencia', 'Oscar', NULL),
  ('Don', 'Cesar', 12, 2025, 1500, 'pagado', 'transferencia', 'Oscar', NULL),
  ('Don', 'Cesar',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', NULL),
  ('Don', 'Cesar',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Don', 'Cesar',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', NULL),

  -- Dolores
  ('Dolores', '', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Dolores', '', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Dolores', '',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Dolores', '',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Dolores', '',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Nancy Peguero (6 meses)
  ('Nancy', 'Peguero', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Nancy', 'Peguero', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Nancy', 'Peguero',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Nancy', 'Peguero',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Nancy', 'Peguero',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Nancy', 'Peguero',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Virginia Pie
  ('Virginia', 'Pie', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Virginia', 'Pie', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Virginia', 'Pie',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Virginia', 'Pie',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Virginia', 'Pie',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', NULL),

  -- Milady
  ('Milady', '', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milady', '', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milady', '',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milady', '',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milady', '',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Milady', '',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Wanda (Kenia)
  ('Wanda', '(Kenia)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Wanda', '(Kenia)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Wanda', '(Kenia)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Wanda', '(Kenia)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Wanda', '(Kenia)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Justina
  ('Justina', '', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Justina', '', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Justina', '',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Justina', '',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Justina', '',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Evelin (Tony)
  ('Evelin', '(Tony)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Evelin', '(Tony)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Evelin', '(Tony)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Evelin', '(Tony)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Evelin', '(Tony)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Maciel Dionis (con pago parcial)
  ('Maciel', 'Dionis', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Maciel', 'Dionis', 12, 2025,  800, 'parcial',   'transferencia', 'Oscar', 'Pago parcial RD$800 de RD$1,500'),
  ('Maciel', 'Dionis',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Maciel', 'Dionis',  2, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Maciel', 'Dionis',  3, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Maciel', 'Dionis',  4, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),

  -- Kikila Pie
  ('Kikila', 'Pie', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Kikila', 'Pie', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Kikila', 'Pie',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Kikila', 'Pie',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Kikila', 'Pie',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),
  ('Kikila', 'Pie',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', NULL),

  -- Agustin Benabel Severino (CASA)
  ('Agustin', 'Benabel Severino (CASA)', 11, 2025, 1500, 'pagado', 'transferencia', 'Oscar', NULL),
  ('Agustin', 'Benabel Severino (CASA)', 12, 2025, 1500, 'pagado', 'transferencia', 'Oscar', NULL),
  ('Agustin', 'Benabel Severino (CASA)',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', NULL),
  ('Agustin', 'Benabel Severino (CASA)',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', NULL),
  ('Agustin', 'Benabel Severino (CASA)',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', NULL),

  -- Ivelisset (inscrito 22/12 → primer mes proporcional)
  ('Ivelisset', '', 11, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Antes de inscripción (22/12/25)'),
  ('Ivelisset', '', 12, 2025,  600, 'parcial',   'efectivo', 'Rodeo', 'Proporcional · Inscrito 22/12/25'),
  ('Ivelisset', '',  1, 2026, 1500, 'pagado',    'efectivo', 'Rodeo', NULL),
  ('Ivelisset', '',  2, 2026, 1500, 'pagado',    'efectivo', 'Rodeo', NULL),
  ('Ivelisset', '',  3, 2026, 1500, 'pagado',    'efectivo', 'Rodeo', NULL),

  -- ESCUELA BASICA RODEO (cheque · todos pendientes)
  ('ESCUELA', 'BASICA RODEO', 11, 2025, 1770, 'pendiente', 'otro', 'DopCoin (Cheque)', NULL),
  ('ESCUELA', 'BASICA RODEO', 12, 2025, 1770, 'pendiente', 'otro', 'DopCoin (Cheque)', NULL),
  ('ESCUELA', 'BASICA RODEO',  1, 2026, 1770, 'pendiente', 'otro', 'DopCoin (Cheque)', NULL),

  -- ESCUELA BASICA HIGUA
  ('ESCUELA', 'BASICA HIGUA', 11, 2025, 1500, 'parcial',   'otro', 'DopCoin (Cheque)', 'Pago parcial RD$1,500 de RD$1,770'),
  ('ESCUELA', 'BASICA HIGUA', 12, 2025, 1500, 'parcial',   'otro', 'DopCoin (Cheque)', 'Pago parcial RD$1,500 de RD$1,770'),
  ('ESCUELA', 'BASICA HIGUA',  1, 2026, 1770, 'pendiente', 'otro', 'DopCoin (Cheque)', NULL),

  -- Licenciada C. (inscrita 31/12)
  ('Licenciada', 'C.', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', 'Antes de inscripción (31/12/25)'),
  ('Licenciada', 'C.', 12, 2025,  700, 'parcial',   'transferencia', 'Oscar', 'Proporcional · Inscrita 31/12/25'),
  ('Licenciada', 'C.',  1, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Licenciada', 'C.',  2, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Licenciada', 'C.',  3, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Licenciada', 'C.',  4, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),

  -- Francisco Polanco (cortado · debe 3 meses)
  ('Francisco', 'Polanco', 11, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'),
  ('Francisco', 'Polanco', 12, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'),
  ('Francisco', 'Polanco',  1, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'),
  ('Francisco', 'Polanco',  2, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', NULL),
  ('Francisco', 'Polanco',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', NULL),

  -- Andres (Papa) — fuera de servicio, solo nov pagado
  ('Andres', '(Papa)', 11, 2025, 1500, 'pagado',    'efectivo', 'Rodeo', NULL),
  ('Andres', '(Papa)', 12, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cambió a Starlink'),
  ('Andres', '(Papa)',  1, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cambió a Starlink'),

  -- Alondra Maria — primer pago abr 2026
  ('Alondra', 'Maria', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Alondra', 'Maria', 12, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Alondra', 'Maria',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Alondra', 'Maria',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Alondra', 'Maria',  3, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Alondra', 'Maria',  4, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),

  -- Delia Maria
  ('Delia', 'Maria', 11, 2025, 1000, 'parcial',   'transferencia', 'Oscar', 'Pago parcial RD$1,000'),
  ('Delia', 'Maria', 12, 2025, 1000, 'parcial',   'transferencia', 'Oscar', 'Pago parcial RD$1,000'),
  ('Delia', 'Maria',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Delia', 'Maria',  2, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Delia', 'Maria',  4, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),

  -- Nicol M
  ('Nicol', 'M', 11, 2025, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Nicol', 'M', 12, 2025, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Nicol', 'M',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', NULL),
  ('Nicol', 'M',  2, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),
  ('Nicol', 'M',  4, 2026, 1500, 'pagado',    'transferencia', 'Oscar', NULL),

  -- Erick Gil — inscrito 22/01/26
  ('Erick', 'Gil',  1, 2026, 1500, 'pagado',    'transferencia', 'Oscar', 'Recibido RD$6,500 (incluye instalación + mes) por Kendry'),
  ('Erick', 'Gil',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', 'Saldo a favor RD$500 por aplicar'),

  -- Cheo Moreno — primer pago may 2026
  ('Cheo', 'Moreno',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', 'Inscrito 07/03/26');

-- Insert solo cobros nuevos (no duplicados por cliente_id + mes + anio)
INSERT INTO cobros (cliente_id, mes, anio, monto, estado, tipo_pago, recibido_por, fecha_pago, notas)
SELECT
  c.id,
  s.mes,
  s.anio,
  s.monto,
  s.estado,
  s.tipo_pago,
  s.recibido_por,
  CASE WHEN s.estado IN ('pagado', 'parcial') THEN make_date(s.anio, s.mes, 5) ELSE NULL END,
  s.notas
FROM _seed_cobros s
JOIN clientes c
  ON c.nombre = s.nombre_cliente
  AND COALESCE(c.apellido, '') = COALESCE(NULLIF(s.apellido_cliente, ''), '')
WHERE NOT EXISTS (
  SELECT 1 FROM cobros co
  WHERE co.cliente_id = c.id AND co.mes = s.mes AND co.anio = s.anio
);


-- =============================================================
-- 3) MERCANCIA — registro de inventario (septiembre 2025 + enero 2026)
-- =============================================================
CREATE TEMP TABLE _seed_mercancia (
  nombre TEXT,
  precio_compra NUMERIC,
  precio_venta NUMERIC,
  stock INT,
  stock_minimo INT,
  notas TEXT
);

INSERT INTO _seed_mercancia (nombre, precio_compra, precio_venta, stock, stock_minimo, notas) VALUES
  -- Orden Septiembre 2025
  ('ASUS VIVOBOOK 64GB+64GB MSD',                          10500, 17000, 1, 1, 'Orden Septiembre 2025'),
  ('MOTO E15 64GB',                                         3900,  7800, 0, 1, 'Liquidado · Orden Septiembre 2025'),
  ('HONOR PLAY 10 128GB',                                   4500,  4500, 0, 1, 'Liquidado · Orden Septiembre 2025'),
  ('GALAXY A16 128GB 4RAM',                                 7000, 10000, 0, 1, 'Liquidado · Orden Septiembre 2025'),
  ('Rollo 1000 metros',                                     4800,  4800, 0, 1, 'Pendiente Parcial · Orden Septiembre 2025'),

  -- Orden Enero 2026 (Rodeo + Romana)
  ('TABLET QLINK SCEPTER (16GB, 8", 2GB RAM, +COVER)',      1800,  3500, 1, 1, 'Rodeo · Orden Enero 2026'),
  ('SPARK GO 1 2025 (128GB, 6.67" 120HZ, 8GB RAM 4+4)',     4800,  6700, 1, 1, 'Rodeo · Orden Enero 2026'),
  ('MOTO G06 (64GB, 6.88" 120HZ, 12GB RAM 4+8, 50MP)',      4299,  7800, 0, 1, 'Liquidado · Rodeo · Orden Enero 2026'),
  ('REDMI BUDS 6 PLAY',                                      800,  1500, 2, 1, 'Rodeo · Orden Enero 2026'),
  ('REDMI A5 (64GB, 6.88" 120HZ, 6GB RAM 3+3)',             4800,  6800, 0, 1, 'Rodeo · Orden Enero 2026'),
  ('NANO',                                                  1500,  2500, 2, 1, 'Rodeo · Orden Enero 2026'),
  ('LiteBeam',                                              1800,  3000, 3, 1, 'Rodeo · Orden Enero 2026'),
  ('Microtik',                                              5100,  7500, 1, 1, 'Romana · Orden Enero 2026'),
  ('CARGADOR TECNO',                                         300,   500, 5, 2, 'Rodeo · Orden Enero 2026'),
  ('CABEZAS DOBLES',                                         200,   350, 6, 2, 'Rodeo · Orden Enero 2026'),
  ('CABLES USBC',                                            100,   180, 6, 2, 'Rodeo · Orden Enero 2026'),
  ('ROUTER USADOS',                                          800,  1500, 5, 2, 'Rodeo · Orden Enero 2026'),
  ('ROUTER NEW',                                            1500,  2500, 2, 1, 'Rodeo · Orden Enero 2026');

-- Insertar productos nuevos (idempotente por nombre)
INSERT INTO mercancia (nombre, precio_compra, precio_venta, stock, stock_minimo, descripcion, activo)
SELECT s.nombre, s.precio_compra, s.precio_venta, s.stock, s.stock_minimo, s.notas, true
FROM _seed_mercancia s
WHERE NOT EXISTS (
  SELECT 1 FROM mercancia m WHERE m.nombre = s.nombre
);


-- =============================================================
-- 4) RESUMEN — verificación
-- =============================================================
DO $$
DECLARE
  total_clientes INT;
  total_cobros INT;
  total_mercancia INT;
  cobros_pagados INT;
  monto_pagado NUMERIC;
  monto_pendiente NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_clientes FROM clientes;
  SELECT COUNT(*) INTO total_cobros   FROM cobros;
  SELECT COUNT(*) INTO total_mercancia FROM mercancia;
  SELECT COUNT(*) INTO cobros_pagados FROM cobros WHERE estado = 'pagado';
  SELECT COALESCE(SUM(monto), 0) INTO monto_pagado FROM cobros WHERE estado IN ('pagado', 'parcial');
  SELECT COALESCE(SUM(monto), 0) INTO monto_pendiente FROM cobros WHERE estado = 'pendiente';

  RAISE NOTICE '======================================';
  RAISE NOTICE 'SEED v1.3.0 — Resumen post-importación';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Clientes en BD:           %', total_clientes;
  RAISE NOTICE 'Cobros en BD:             %', total_cobros;
  RAISE NOTICE '  Pagados/parciales:      %', cobros_pagados;
  RAISE NOTICE '  Monto recibido:         RD$ %', monto_pagado;
  RAISE NOTICE '  Monto pendiente:        RD$ %', monto_pendiente;
  RAISE NOTICE 'Mercancía en BD:          %', total_mercancia;
  RAISE NOTICE '======================================';
END $$;

COMMIT;

-- ============================================================
-- Notas omitidas intencionalmente:
-- - Wanda Kenia Mercedes & Ada Severino: ajustes negativos grandes
--   (-RD$10,600 / -RD$7,800) corresponden a costos de instalación,
--   no a pagos de servicio. Se importaron como clientes pero sin cobros.
--   Registrar las instalaciones en /instalaciones cuando aplique.
-- - Cristian/equipos & Wilmari: monto_mensual = 0 → no se generan cobros.
-- - Becados totales (Agustin Colmado, Francisco Paula, Paula Areche,
--   Porfirio Roman): no se generan cobros (servicio gratuito).
-- - Meses futuros (mayo 2026 en adelante) no se importaron — se generarán
--   automáticamente cuando llegue cada mes en la plataforma.
-- ============================================================
