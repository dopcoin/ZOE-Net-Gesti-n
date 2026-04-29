#!/usr/bin/env node
/**
 * Seed inicial v1.3.0 — Importa clientes, cobros y mercancía via REST API.
 *
 * Uso:
 *   1. Agrega TEMPORALMENTE al .env.local:
 *        SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
 *      (obtener en Dashboard → Settings → API → service_role → Reveal)
 *   2. node scripts/run-seed.mjs
 *   3. Borra esa línea del .env.local cuando termine.
 *
 * IDEMPOTENTE: re-ejecutar no duplica datos.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- env ----------
function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ No existe .env.local en la raíz del proyecto');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE) {
  console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL en .env.local');
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY en .env.local');
  console.error('');
  console.error('Agrégala temporalmente al .env.local:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=<tu service_role key>');
  console.error('');
  console.error('Obténla en: ' + URL_BASE.replace(/^https?:\/\/([^.]+).*/, 'https://supabase.com/dashboard/project/$1/settings/api'));
  process.exit(1);
}

// Verificar que sea service_role JWT
try {
  const payload = JSON.parse(Buffer.from(SERVICE_KEY.split('.')[1], 'base64').toString());
  if (payload.role !== 'service_role') {
    console.error(`❌ La key no es service_role (es "${payload.role}"). Pega la correcta.`);
    process.exit(1);
  }
} catch {
  console.error('❌ La SUPABASE_SERVICE_ROLE_KEY no parece ser un JWT válido.');
  process.exit(1);
}

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function get(table, filter) {
  const url = `${URL_BASE}/rest/v1/${table}?${filter}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET ${table}: ${res.status} ${t}`);
  }
  return res.json();
}

async function post(table, body) {
  const url = `${URL_BASE}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST ${table}: ${res.status} ${t}`);
  }
  return res.json();
}

// ============================================================
// DATOS — extraídos del Google Sheets
// ============================================================

const CLIENTES = [
  { nombre: 'Agustin',    apellido: '(COLMADO)',                localidad: 'Higua Seibo',   monto_mensual: 0,    estado: 'becado',     beca: true,  notas: 'Becado total · Torre Higua',                  fecha_inicio: null,         direccion: null },
  { nombre: 'Rosa',       apellido: 'Walki',                    localidad: 'Rodeo Seibo',   monto_mensual: 1000, estado: 'becado',     beca: true,  notas: 'Becado parcial · Media veca 750',             fecha_inicio: null,         direccion: null },
  { nombre: 'Francisco',  apellido: 'Paula',                    localidad: 'Rodeo Seibo',   monto_mensual: 0,    estado: 'becado',     beca: true,  notas: 'Becado total · Torre Rodeo',                  fecha_inicio: null,         direccion: null },
  { nombre: 'Milagros',   apellido: null,                       localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-07', direccion: null },
  { nombre: 'Don',        apellido: 'Vicente',                  localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-11', direccion: null },
  { nombre: 'Tolito',     apellido: 'Colmado',                  localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-01', direccion: null },
  { nombre: 'Julio',      apellido: 'Diego Berroa',             localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-03', direccion: null },
  { nombre: 'Cristian',   apellido: '/equipos',                 localidad: 'Rodeo Seibo',   monto_mensual: 0,    estado: 'activo',     beca: false, notas: 'Cliente especial — sin mensualidad',          fecha_inicio: null,         direccion: null },
  { nombre: 'Yohana',     apellido: null,                       localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-03', direccion: null },
  { nombre: 'Yerny',      apellido: '(Caballo)',                localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-02', direccion: null },
  { nombre: 'Ezequiel',   apellido: '(Pastor)',                 localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-03', direccion: null },
  { nombre: 'Don',        apellido: 'Cesar',                    localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Paga via Depósito',                           fecha_inicio: '2025-11-02', direccion: null },
  { nombre: 'Dolores',    apellido: null,                       localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-02', direccion: null },
  { nombre: 'Nancy',      apellido: 'Peguero',                  localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-03', direccion: null },
  { nombre: 'Virginia',   apellido: 'Pie',                      localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-03', direccion: null },
  { nombre: 'Milady',     apellido: null,                       localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-02', direccion: null },
  { nombre: 'Wanda',      apellido: '(Kenia)',                  localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-03', direccion: null },
  { nombre: 'Justina',    apellido: null,                       localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-02', direccion: null },
  { nombre: 'Evelin',     apellido: '(Tony)',                   localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-03', direccion: null },
  { nombre: 'Maciel',     apellido: 'Dionis',                   localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Paga via Transferencia',                      fecha_inicio: '2025-11-02', direccion: null },
  { nombre: 'Kikila',     apellido: 'Pie',                      localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-15', direccion: null },
  { nombre: 'Agustin',    apellido: 'Benabel Severino (CASA)',  localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-11-02', direccion: null },
  { nombre: 'Ivelisset',  apellido: null,                       localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-12-22', direccion: null },
  { nombre: 'ESCUELA',    apellido: 'BASICA RODEO',             localidad: 'Rodeo Seibo',   monto_mensual: 1770, estado: 'activo',     beca: false, notas: 'Pagan via Cheque',                            fecha_inicio: '2025-11-11', direccion: null },
  { nombre: 'ESCUELA',    apellido: 'BASICA HIGUA',             localidad: 'Higua Seibo',   monto_mensual: 1770, estado: 'activo',     beca: false, notas: 'Pagan via Cheque',                            fecha_inicio: '2025-11-11', direccion: null },
  { nombre: 'Licenciada', apellido: 'C.',                       localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_inicio: '2025-12-31', direccion: null },
  { nombre: 'Francisco',  apellido: 'Polanco',                  localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'suspendido', beca: false, notas: 'Cortado · Debe 3 Meses',                      fecha_inicio: '2025-11-03', direccion: 'Atras del Play' },
  { nombre: 'Andres',     apellido: '(Papa)',                   localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'inactivo',   beca: false, notas: 'Fuera de Servicio · Cambió a Starlink',       fecha_inicio: '2025-11-02', direccion: null },
  { nombre: 'Alondra',    apellido: 'Maria',                    localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Cambiar antena y Modificar',                  fecha_inicio: '2026-04-01', direccion: null },
  { nombre: 'Delia',      apellido: 'Maria',                    localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Instalado y funcionando',                     fecha_inicio: '2025-11-06', direccion: null },
  { nombre: 'Paula',      apellido: 'Areche',                   localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'becado',     beca: true,  notas: 'Becado · Funcionando',                        fecha_inicio: '2025-11-06', direccion: null },
  { nombre: 'Porfirio',   apellido: 'Roman',                    localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'becado',     beca: true,  notas: 'Becado · Atrasado',                           fecha_inicio: '2025-11-01', direccion: null },
  { nombre: 'Nicol',      apellido: 'M',                        localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Funcionando',                                 fecha_inicio: '2025-11-06', direccion: null },
  { nombre: 'Wilmari',    apellido: null,                       localidad: 'Higua Seibo',   monto_mensual: 0,    estado: 'inactivo',   beca: false, notas: 'Fuera de Servicio',                           fecha_inicio: null,         direccion: null },
  { nombre: 'Erick',      apellido: 'Gil',                      localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Instalado y probado dia 22 por Kendry · Pago via transferencia · Pendiente pago Kendry', fecha_inicio: '2026-01-22', direccion: 'Frente a la Torre Higua' },
  { nombre: 'Wanda',      apellido: 'Kenia Mercedes',           localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Activo proporcional · Litebeam instalada en el play · Instalación completa RD$6,000 + 80 pies cable RD$800 + regleta RD$300 + tubos y cemento RD$3,500', fecha_inicio: '2026-02-09', direccion: null },
  { nombre: 'Ada',        apellido: 'Severino (Dulceria)',      localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Activo proporcional · Una loco · Falta tubos rígidos (666x3=1800) · Se instalaron tubos 4 y alambre', fecha_inicio: '2026-02-09', direccion: null },
  { nombre: 'Cheo',       apellido: 'Moreno',                   localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Instalado',                                   fecha_inicio: '2026-03-07', direccion: null },
];

// (nombre, apellido, mes, anio, monto, estado, tipo_pago, recibido_por, notas)
const COBROS = [
  // Rosa Walki
  ['Rosa', 'Walki', 11, 2025, 1000, 'pagado', 'efectivo', 'Rodeo', null],
  ['Rosa', 'Walki', 12, 2025, 1000, 'pagado', 'efectivo', 'Rodeo', null],
  ['Rosa', 'Walki',  1, 2026, 1000, 'pagado', 'efectivo', 'Rodeo', null],
  ['Rosa', 'Walki',  3, 2026, 1000, 'pendiente', 'efectivo', 'Rodeo', null],
  // Milagros
  ['Milagros', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null,  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Don Vicente
  ['Don', 'Vicente', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Tolito Colmado
  ['Tolito', 'Colmado', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Julio Diego Berroa
  ['Julio', 'Diego Berroa', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Yohana
  ['Yohana', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null,  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Yohana', null,  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Yerny
  ['Yerny', '(Caballo)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)',  2, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Ezequiel
  ['Ezequiel', '(Pastor)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  // Don Cesar
  ['Don', 'Cesar', 11, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Don', 'Cesar', 12, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Don', 'Cesar',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Don', 'Cesar',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Don', 'Cesar',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  // Dolores
  ['Dolores', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Dolores', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Dolores', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Dolores', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Dolores', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Nancy Peguero
  ['Nancy', 'Peguero', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Virginia Pie
  ['Virginia', 'Pie', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  // Milady
  ['Milady', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null,  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Wanda (Kenia)
  ['Wanda', '(Kenia)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Justina
  ['Justina', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Evelin
  ['Evelin', '(Tony)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Maciel Dionis
  ['Maciel', 'Dionis', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Maciel', 'Dionis', 12, 2025,  800, 'parcial', 'transferencia', 'Oscar', 'Pago parcial RD$800 de RD$1,500'],
  ['Maciel', 'Dionis',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Maciel', 'Dionis',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Maciel', 'Dionis',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Maciel', 'Dionis',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  // Kikila Pie
  ['Kikila', 'Pie', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // Agustin Benabel
  ['Agustin', 'Benabel Severino (CASA)', 11, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Agustin', 'Benabel Severino (CASA)', 12, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Agustin', 'Benabel Severino (CASA)',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Agustin', 'Benabel Severino (CASA)',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Agustin', 'Benabel Severino (CASA)',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  // Ivelisset
  ['Ivelisset', null, 11, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Antes de inscripción (22/12/25)'],
  ['Ivelisset', null, 12, 2025,  600, 'parcial', 'efectivo', 'Rodeo', 'Proporcional · Inscrito 22/12/25'],
  ['Ivelisset', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ivelisset', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ivelisset', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  // ESCUELA BASICA RODEO
  ['ESCUELA', 'BASICA RODEO', 11, 2025, 1770, 'pendiente', 'otro', 'DopCoin (Cheque)', null],
  ['ESCUELA', 'BASICA RODEO', 12, 2025, 1770, 'pendiente', 'otro', 'DopCoin (Cheque)', null],
  ['ESCUELA', 'BASICA RODEO',  1, 2026, 1770, 'pendiente', 'otro', 'DopCoin (Cheque)', null],
  // ESCUELA BASICA HIGUA
  ['ESCUELA', 'BASICA HIGUA', 11, 2025, 1500, 'parcial', 'otro', 'DopCoin (Cheque)', 'Pago parcial RD$1,500 de RD$1,770'],
  ['ESCUELA', 'BASICA HIGUA', 12, 2025, 1500, 'parcial', 'otro', 'DopCoin (Cheque)', 'Pago parcial RD$1,500 de RD$1,770'],
  ['ESCUELA', 'BASICA HIGUA',  1, 2026, 1770, 'pendiente', 'otro', 'DopCoin (Cheque)', null],
  // Licenciada C.
  ['Licenciada', 'C.', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', 'Antes de inscripción (31/12/25)'],
  ['Licenciada', 'C.', 12, 2025,  700, 'parcial', 'transferencia', 'Oscar', 'Proporcional · Inscrita 31/12/25'],
  ['Licenciada', 'C.',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Licenciada', 'C.',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Licenciada', 'C.',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Licenciada', 'C.',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  // Francisco Polanco
  ['Francisco', 'Polanco', 11, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'],
  ['Francisco', 'Polanco', 12, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'],
  ['Francisco', 'Polanco',  1, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'],
  ['Francisco', 'Polanco',  2, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Francisco', 'Polanco',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  // Andres (Papa)
  ['Andres', '(Papa)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Andres', '(Papa)', 12, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cambió a Starlink'],
  ['Andres', '(Papa)',  1, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cambió a Starlink'],
  // Alondra Maria
  ['Alondra', 'Maria', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria', 12, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria',  3, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  // Delia Maria
  ['Delia', 'Maria', 11, 2025, 1000, 'parcial', 'transferencia', 'Oscar', 'Pago parcial RD$1,000'],
  ['Delia', 'Maria', 12, 2025, 1000, 'parcial', 'transferencia', 'Oscar', 'Pago parcial RD$1,000'],
  ['Delia', 'Maria',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Delia', 'Maria',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Delia', 'Maria',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  // Nicol M
  ['Nicol', 'M', 11, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Nicol', 'M', 12, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Nicol', 'M',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Nicol', 'M',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Nicol', 'M',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  // Erick Gil
  ['Erick', 'Gil',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', 'Recibido RD$6,500 (incluye instalación + mes) por Kendry'],
  ['Erick', 'Gil',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', 'Saldo a favor RD$500 por aplicar'],
  // Cheo Moreno
  ['Cheo', 'Moreno',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', 'Inscrito 07/03/26'],
];

const MERCANCIA = [
  { nombre: 'ASUS VIVOBOOK 64GB+64GB MSD',                           precio_compra: 10500, precio_venta: 17000, stock: 1, stock_minimo: 1, descripcion: 'Orden Septiembre 2025' },
  { nombre: 'MOTO E15 64GB',                                          precio_compra: 3900,  precio_venta: 7800,  stock: 0, stock_minimo: 1, descripcion: 'Liquidado · Orden Septiembre 2025' },
  { nombre: 'HONOR PLAY 10 128GB',                                    precio_compra: 4500,  precio_venta: 4500,  stock: 0, stock_minimo: 1, descripcion: 'Liquidado · Orden Septiembre 2025' },
  { nombre: 'GALAXY A16 128GB 4RAM',                                  precio_compra: 7000,  precio_venta: 10000, stock: 0, stock_minimo: 1, descripcion: 'Liquidado · Orden Septiembre 2025' },
  { nombre: 'Rollo 1000 metros',                                      precio_compra: 4800,  precio_venta: 4800,  stock: 0, stock_minimo: 1, descripcion: 'Pendiente Parcial · Orden Septiembre 2025' },
  { nombre: 'TABLET QLINK SCEPTER (16GB, 8", 2GB RAM, +COVER)',       precio_compra: 1800,  precio_venta: 3500,  stock: 1, stock_minimo: 1, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'SPARK GO 1 2025 (128GB, 6.67" 120HZ, 8GB RAM 4+4)',      precio_compra: 4800,  precio_venta: 6700,  stock: 1, stock_minimo: 1, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'MOTO G06 (64GB, 6.88" 120HZ, 12GB RAM 4+8, 50MP)',       precio_compra: 4299,  precio_venta: 7800,  stock: 0, stock_minimo: 1, descripcion: 'Liquidado · Rodeo · Orden Enero 2026' },
  { nombre: 'REDMI BUDS 6 PLAY',                                       precio_compra: 800,   precio_venta: 1500,  stock: 2, stock_minimo: 1, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'REDMI A5 (64GB, 6.88" 120HZ, 6GB RAM 3+3)',              precio_compra: 4800,  precio_venta: 6800,  stock: 0, stock_minimo: 1, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'NANO',                                                   precio_compra: 1500,  precio_venta: 2500,  stock: 2, stock_minimo: 1, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'LiteBeam',                                               precio_compra: 1800,  precio_venta: 3000,  stock: 3, stock_minimo: 1, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'Microtik',                                               precio_compra: 5100,  precio_venta: 7500,  stock: 1, stock_minimo: 1, descripcion: 'Romana · Orden Enero 2026' },
  { nombre: 'CARGADOR TECNO',                                         precio_compra: 300,   precio_venta: 500,   stock: 5, stock_minimo: 2, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'CABEZAS DOBLES',                                         precio_compra: 200,   precio_venta: 350,   stock: 6, stock_minimo: 2, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'CABLES USBC',                                            precio_compra: 100,   precio_venta: 180,   stock: 6, stock_minimo: 2, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'ROUTER USADOS',                                          precio_compra: 800,   precio_venta: 1500,  stock: 5, stock_minimo: 2, descripcion: 'Rodeo · Orden Enero 2026' },
  { nombre: 'ROUTER NEW',                                             precio_compra: 1500,  precio_venta: 2500,  stock: 2, stock_minimo: 1, descripcion: 'Rodeo · Orden Enero 2026' },
];

// ============================================================
// RUNNER
// ============================================================

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function importClientes() {
  console.log(`\n👥 Importando ${CLIENTES.length} clientes...`);
  let creados = 0, existentes = 0, errores = 0;
  const idMap = {}; // "nombre|apellido" → uuid

  for (const c of CLIENTES) {
    const key = `${c.nombre}|${c.apellido ?? ''}`;
    try {
      // Verificar existencia
      const filterApe = c.apellido === null ? 'apellido=is.null' : `apellido=eq.${encodeURIComponent(c.apellido)}`;
      const existing = await get('clientes', `select=id&nombre=eq.${encodeURIComponent(c.nombre)}&${filterApe}&limit=1`);
      if (existing.length > 0) {
        idMap[key] = existing[0].id;
        existentes++;
        continue;
      }
      // Insertar
      const inserted = await post('clientes', {
        nombre: c.nombre,
        apellido: c.apellido,
        localidad: c.localidad,
        monto_mensual: c.monto_mensual,
        estado: c.estado,
        beca: c.beca,
        notas: c.notas,
        fecha_inicio: c.fecha_inicio,
        direccion: c.direccion,
      });
      idMap[key] = inserted[0].id;
      creados++;
      process.stdout.write('.');
    } catch (e) {
      errores++;
      console.error(`\n  ❌ ${key}: ${e.message}`);
    }
    await sleep(20);
  }
  console.log(`\n   ✅ ${creados} creados · ${existentes} ya existían · ${errores} errores`);
  return idMap;
}

async function importCobros(idMap) {
  console.log(`\n💵 Importando ${COBROS.length} cobros...`);
  let creados = 0, existentes = 0, errores = 0, sinCliente = 0;

  for (const [nombre, apellido, mes, anio, monto, estado, tipo_pago, recibido_por, notas] of COBROS) {
    const key = `${nombre}|${apellido ?? ''}`;
    const cliente_id = idMap[key];
    if (!cliente_id) {
      sinCliente++;
      console.error(`\n  ⚠ Sin cliente: ${key}`);
      continue;
    }
    try {
      // Verificar existencia
      const existing = await get('cobros', `select=id&cliente_id=eq.${cliente_id}&mes=eq.${mes}&anio=eq.${anio}&limit=1`);
      if (existing.length > 0) {
        existentes++;
        continue;
      }
      const fecha_pago = (estado === 'pagado' || estado === 'parcial')
        ? `${anio}-${String(mes).padStart(2, '0')}-05`
        : null;

      await post('cobros', {
        cliente_id, mes, anio, monto, estado, tipo_pago, recibido_por, fecha_pago, notas,
      });
      creados++;
      process.stdout.write('.');
    } catch (e) {
      errores++;
      console.error(`\n  ❌ ${key} ${mes}/${anio}: ${e.message}`);
    }
    await sleep(20);
  }
  console.log(`\n   ✅ ${creados} creados · ${existentes} ya existían · ${errores} errores · ${sinCliente} sin cliente`);
}

async function importMercancia() {
  console.log(`\n📦 Importando ${MERCANCIA.length} productos...`);
  let creados = 0, existentes = 0, errores = 0;

  for (const m of MERCANCIA) {
    try {
      const existing = await get('mercancia', `select=id&nombre=eq.${encodeURIComponent(m.nombre)}&limit=1`);
      if (existing.length > 0) {
        existentes++;
        continue;
      }
      await post('mercancia', { ...m, activo: true });
      creados++;
      process.stdout.write('.');
    } catch (e) {
      errores++;
      console.error(`\n  ❌ ${m.nombre}: ${e.message}`);
    }
    await sleep(20);
  }
  console.log(`\n   ✅ ${creados} creados · ${existentes} ya existían · ${errores} errores`);
}

// ============================================================
// MAIN
// ============================================================

console.log('🚀 Seed inicial v1.3.0 — Importación desde Google Sheets\n');
console.log(`   Proyecto: ${URL_BASE}`);
console.log(`   Clientes: ${CLIENTES.length}`);
console.log(`   Cobros:   ${COBROS.length}`);
console.log(`   Productos: ${MERCANCIA.length}`);

try {
  const idMap = await importClientes();
  await importCobros(idMap);
  await importMercancia();

  // Resumen final
  console.log('\n📊 Verificando totales finales...');
  const [{ count: totalClientes }, { count: totalCobros }, { count: totalMercancia }] = await Promise.all([
    fetch(`${URL_BASE}/rest/v1/clientes?select=count`, { headers: { ...headers, 'Prefer': 'count=exact' } }).then(r => r.json().then(d => ({ count: d.length ?? 0 }))).catch(() => ({ count: '?' })),
    fetch(`${URL_BASE}/rest/v1/cobros?select=count`,   { headers: { ...headers, 'Prefer': 'count=exact' } }).then(r => r.json().then(d => ({ count: d.length ?? 0 }))).catch(() => ({ count: '?' })),
    fetch(`${URL_BASE}/rest/v1/mercancia?select=count`,{ headers: { ...headers, 'Prefer': 'count=exact' } }).then(r => r.json().then(d => ({ count: d.length ?? 0 }))).catch(() => ({ count: '?' })),
  ]);

  // Mejor: pedir el header Content-Range
  async function countOf(table) {
    const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, {
      method: 'HEAD',
      headers: { ...headers, 'Prefer': 'count=exact' },
    });
    const range = res.headers.get('content-range');
    return range ? range.split('/')[1] : '?';
  }
  const [tc, tco, tm] = await Promise.all([countOf('clientes'), countOf('cobros'), countOf('mercancia')]);
  console.log(`\n======================================`);
  console.log(`📋 ESTADO FINAL DE LA BD`);
  console.log(`======================================`);
  console.log(`  Clientes:   ${tc}`);
  console.log(`  Cobros:     ${tco}`);
  console.log(`  Mercancía:  ${tm}`);
  console.log(`======================================`);
  console.log('\n✅ Importación completada\n');
  console.log('🔒 RECUERDA: borra SUPABASE_SERVICE_ROLE_KEY de tu .env.local si ya no la necesitas.');
} catch (e) {
  console.error('\n❌ Error fatal:', e);
  process.exit(1);
}
