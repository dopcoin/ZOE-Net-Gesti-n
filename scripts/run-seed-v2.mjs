#!/usr/bin/env node
/**
 * Seed v1.3.0 final — Importa clientes + cobros con matching fuzzy.
 *
 * - Matchea contra clientes existentes ignorando case, acentos, paréntesis
 * - Solo inserta los clientes que NO existen en BD
 * - Usa fecha_instalacion (no fecha_inicio) y campos reales de la tabla
 * - Cobros se vinculan al cliente correcto (existente o recién creado)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function get(p) {
  const r = await fetch(`${URL_BASE}/rest/v1/${p}`, { headers });
  if (!r.ok) throw new Error(`GET ${p}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function post(p, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/${p}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${p}: ${r.status} ${await r.text()}`);
  return r.json();
}

function norm(s) {
  if (!s) return '';
  return s.toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[()/.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mapeo de variantes ortográficas existentes en BD → normalizado del sheet
// Esto resuelve los casos donde la BD tiene una variante (ej. BERNABEL vs Benabel)
const ALIASES = {
  'cristian equipo':                   'cristian equipos',          // BD: CRISTIAN/EQUIPO  | Sheet: Cristian /equipos
  'agustin bernabel severino casa':    'agustin benabel severino casa', // BERNABEL vs Benabel
  'ivelisse':                          'ivelisset',                 // BD: IVELISSE | Sheet: Ivelisset
  'kikila mercedes':                   'kikila pie',                // posible misma persona
};

function fuzzyKey(nombre, apellido) {
  const full = `${nombre || ''} ${apellido || ''}`.trim();
  const n = norm(full);
  return ALIASES[n] || n;
}

// =============================================================
// DATA
// =============================================================
const CLIENTES = [
  { nombre: 'Agustin',    apellido: '(COLMADO)',                localidad: 'Higua Seibo',   monto_mensual: 0,    estado: 'becado',     beca: true,  notas: 'Becado total · Torre Higua',                  fecha_instalacion: null,         direccion: null, tipo_pago: 'cash' },
  { nombre: 'Rosa',       apellido: 'Walki',                    localidad: 'Rodeo Seibo',   monto_mensual: 1000, estado: 'becado',     beca: true,  notas: 'Becado parcial · Media veca 750',             fecha_instalacion: null,         direccion: null, tipo_pago: 'cash' },
  { nombre: 'Francisco',  apellido: 'Paula',                    localidad: 'Rodeo Seibo',   monto_mensual: 0,    estado: 'becado',     beca: true,  notas: 'Becado total · Torre Rodeo',                  fecha_instalacion: null,         direccion: null, tipo_pago: 'cash' },
  { nombre: 'Milagros',   apellido: null,                       localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-07', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Don',        apellido: 'Vicente',                  localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-11', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Tolito',     apellido: 'Colmado',                  localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-01', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Julio',      apellido: 'Diego Berroa',             localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-03', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Cristian',   apellido: '/equipos',                 localidad: 'Rodeo Seibo',   monto_mensual: 0,    estado: 'activo',     beca: false, notas: 'Cliente especial — sin mensualidad',          fecha_instalacion: null,         direccion: null, tipo_pago: 'cash' },
  { nombre: 'Yohana',     apellido: null,                       localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-03', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Yerny',      apellido: '(Caballo)',                localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-02', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Ezequiel',   apellido: '(Pastor)',                 localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-03', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Don',        apellido: 'Cesar',                    localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Paga via Depósito',                           fecha_instalacion: '2025-11-02', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Dolores',    apellido: null,                       localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-02', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Nancy',      apellido: 'Peguero',                  localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-03', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Virginia',   apellido: 'Pie',                      localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-03', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Milady',     apellido: null,                       localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-02', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Wanda',      apellido: '(Kenia)',                  localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-03', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Justina',    apellido: null,                       localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-02', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Evelin',     apellido: '(Tony)',                   localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-03', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Maciel',     apellido: 'Dionis',                   localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Paga via Transferencia',                      fecha_instalacion: '2025-11-02', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Kikila',     apellido: 'Pie',                      localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-15', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Agustin',    apellido: 'Benabel Severino (CASA)',  localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-11-02', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Ivelisset',  apellido: null,                       localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-12-22', direccion: null, tipo_pago: 'cash' },
  { nombre: 'ESCUELA',    apellido: 'BASICA RODEO',             localidad: 'Rodeo Seibo',   monto_mensual: 1770, estado: 'activo',     beca: false, notas: 'Pagan via Cheque',                            fecha_instalacion: '2025-11-11', direccion: null, tipo_pago: 'cash' },
  { nombre: 'ESCUELA',    apellido: 'BASICA HIGUA',             localidad: 'Higua Seibo',   monto_mensual: 1770, estado: 'activo',     beca: false, notas: 'Pagan via Cheque',                            fecha_instalacion: '2025-11-11', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Licenciada', apellido: 'C.',                       localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: null,                                          fecha_instalacion: '2025-12-31', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Francisco',  apellido: 'Polanco',                  localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'suspendido', beca: false, notas: 'Cortado · Debe 3 Meses',                      fecha_instalacion: '2025-11-03', direccion: 'Atras del Play', tipo_pago: 'cash' },
  { nombre: 'Andres',     apellido: '(Papa)',                   localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'inactivo',   beca: false, notas: 'Fuera de Servicio · Cambió a Starlink',       fecha_instalacion: '2025-11-02', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Alondra',    apellido: 'Maria',                    localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Cambiar antena y Modificar',                  fecha_instalacion: '2026-04-01', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Delia',      apellido: 'Maria',                    localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Instalado y funcionando',                     fecha_instalacion: '2025-11-06', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Paula',      apellido: 'Areche',                   localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'becado',     beca: true,  notas: 'Becado · Funcionando',                        fecha_instalacion: '2025-11-06', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Porfirio',   apellido: 'Roman',                    localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'becado',     beca: true,  notas: 'Becado · Atrasado',                           fecha_instalacion: '2025-11-01', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Nicol',      apellido: 'M',                        localidad: 'Villa Real LR', monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Funcionando',                                 fecha_instalacion: '2025-11-06', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Wilmari',    apellido: null,                       localidad: 'Higua Seibo',   monto_mensual: 0,    estado: 'inactivo',   beca: false, notas: 'Fuera de Servicio',                           fecha_instalacion: null,         direccion: null, tipo_pago: 'cash' },
  { nombre: 'Erick',      apellido: 'Gil',                      localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Instalado y probado dia 22 por Kendry · Pago via transferencia · Pendiente pago Kendry', fecha_instalacion: '2026-01-22', direccion: 'Frente a la Torre Higua', tipo_pago: 'transferencia' },
  { nombre: 'Wanda',      apellido: 'Kenia Mercedes',           localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Activo proporcional · Litebeam instalada en el play · Instalación completa RD$6,000 + 80 pies cable RD$800 + regleta RD$300 + tubos y cemento RD$3,500', fecha_instalacion: '2026-02-09', direccion: null, tipo_pago: 'transferencia' },
  { nombre: 'Ada',        apellido: 'Severino (Dulceria)',      localidad: 'Rodeo Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Activo proporcional · Una loco · Falta tubos rígidos (666x3=1800) · Se instalaron tubos 4 y alambre', fecha_instalacion: '2026-02-09', direccion: null, tipo_pago: 'cash' },
  { nombre: 'Cheo',       apellido: 'Moreno',                   localidad: 'Higua Seibo',   monto_mensual: 1500, estado: 'activo',     beca: false, notas: 'Instalado',                                   fecha_instalacion: '2026-03-07', direccion: null, tipo_pago: 'cash' },
];

const COBROS = [
  ['Rosa', 'Walki', 11, 2025, 1000, 'pagado', 'efectivo', 'Rodeo', null],
  ['Rosa', 'Walki', 12, 2025, 1000, 'pagado', 'efectivo', 'Rodeo', null],
  ['Rosa', 'Walki',  1, 2026, 1000, 'pagado', 'efectivo', 'Rodeo', null],
  ['Rosa', 'Walki',  3, 2026, 1000, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Milagros', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milagros', null,  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Don', 'Vicente',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Tolito', 'Colmado',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Julio', 'Diego Berroa',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yohana', null,  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Yohana', null,  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)',  2, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Yerny', '(Caballo)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ezequiel', '(Pastor)',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Don', 'Cesar', 11, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Don', 'Cesar', 12, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Don', 'Cesar',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Don', 'Cesar',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Don', 'Cesar',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Dolores', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Dolores', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Dolores', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Dolores', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Dolores', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Nancy', 'Peguero',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Virginia', 'Pie',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Milady', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Milady', null,  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Wanda', '(Kenia)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null, 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null, 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Justina', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Evelin', '(Tony)',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Maciel', 'Dionis', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Maciel', 'Dionis', 12, 2025,  800, 'parcial', 'transferencia', 'Oscar', 'Pago parcial RD$800 de RD$1,500'],
  ['Maciel', 'Dionis',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Maciel', 'Dionis',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Maciel', 'Dionis',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Maciel', 'Dionis',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Kikila', 'Pie', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie', 12, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie',  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie',  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Kikila', 'Pie',  4, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Agustin', 'Benabel Severino (CASA)', 11, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Agustin', 'Benabel Severino (CASA)', 12, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Agustin', 'Benabel Severino (CASA)',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Agustin', 'Benabel Severino (CASA)',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Agustin', 'Benabel Severino (CASA)',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Ivelisset', null, 11, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Antes de inscripción (22/12/25)'],
  ['Ivelisset', null, 12, 2025,  600, 'parcial', 'efectivo', 'Rodeo', 'Proporcional · Inscrito 22/12/25'],
  ['Ivelisset', null,  1, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ivelisset', null,  2, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Ivelisset', null,  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['ESCUELA', 'BASICA RODEO', 11, 2025, 1770, 'pendiente', 'transferencia', 'DopCoin (Cheque)', null],
  ['ESCUELA', 'BASICA RODEO', 12, 2025, 1770, 'pendiente', 'transferencia', 'DopCoin (Cheque)', null],
  ['ESCUELA', 'BASICA RODEO',  1, 2026, 1770, 'pendiente', 'transferencia', 'DopCoin (Cheque)', null],
  ['ESCUELA', 'BASICA HIGUA', 11, 2025, 1500, 'parcial', 'transferencia', 'DopCoin (Cheque)', 'Pago parcial RD$1,500 de RD$1,770'],
  ['ESCUELA', 'BASICA HIGUA', 12, 2025, 1500, 'parcial', 'transferencia', 'DopCoin (Cheque)', 'Pago parcial RD$1,500 de RD$1,770'],
  ['ESCUELA', 'BASICA HIGUA',  1, 2026, 1770, 'pendiente', 'transferencia', 'DopCoin (Cheque)', null],
  ['Licenciada', 'C.', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', 'Antes de inscripción (31/12/25)'],
  ['Licenciada', 'C.', 12, 2025,  700, 'parcial', 'transferencia', 'Oscar', 'Proporcional · Inscrita 31/12/25'],
  ['Licenciada', 'C.',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Licenciada', 'C.',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Licenciada', 'C.',  3, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Licenciada', 'C.',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Francisco', 'Polanco', 11, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'],
  ['Francisco', 'Polanco', 12, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'],
  ['Francisco', 'Polanco',  1, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cortado · Debe'],
  ['Francisco', 'Polanco',  2, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Francisco', 'Polanco',  3, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', null],
  ['Andres', '(Papa)', 11, 2025, 1500, 'pagado', 'efectivo', 'Rodeo', null],
  ['Andres', '(Papa)', 12, 2025, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cambió a Starlink'],
  ['Andres', '(Papa)',  1, 2026, 1500, 'pendiente', 'efectivo', 'Rodeo', 'Cambió a Starlink'],
  ['Alondra', 'Maria', 11, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria', 12, 2025, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria',  3, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Alondra', 'Maria',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Delia', 'Maria', 11, 2025, 1000, 'parcial', 'transferencia', 'Oscar', 'Pago parcial RD$1,000'],
  ['Delia', 'Maria', 12, 2025, 1000, 'parcial', 'transferencia', 'Oscar', 'Pago parcial RD$1,000'],
  ['Delia', 'Maria',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Delia', 'Maria',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Delia', 'Maria',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Nicol', 'M', 11, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Nicol', 'M', 12, 2025, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Nicol', 'M',  1, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', null],
  ['Nicol', 'M',  2, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Nicol', 'M',  4, 2026, 1500, 'pagado', 'transferencia', 'Oscar', null],
  ['Erick', 'Gil',  1, 2026, 1500, 'pagado', 'transferencia', 'Oscar', 'Recibido RD$6,500 (incluye instalación + mes) por Kendry'],
  ['Erick', 'Gil',  2, 2026, 1500, 'pendiente', 'transferencia', 'Oscar', 'Saldo a favor RD$500 por aplicar'],
  ['Cheo', 'Moreno',  3, 2026, 1500, 'pagado', 'efectivo', 'Rodeo', 'Inscrito 07/03/26'],
];

// =============================================================
// MAIN
// =============================================================

console.log('🚀 Seed v1.3.0 final — matching fuzzy con BD existente\n');

// 1) Cargar clientes existentes
console.log('📥 Cargando clientes existentes...');
const bdClientes = await get('clientes?select=id,nombre,apellido,monto_mensual,estado');
const bdIndex = new Map();
for (const c of bdClientes) {
  bdIndex.set(fuzzyKey(c.nombre, c.apellido), c.id);
}
console.log(`   → ${bdClientes.length} clientes en BD`);

// 2) Procesar clientes del sheet
console.log('\n👥 Procesando 38 clientes del sheet...');
const idMap = new Map();
let creados = 0, existentes = 0, errores = 0;

for (const c of CLIENTES) {
  const key = fuzzyKey(c.nombre, c.apellido);
  if (bdIndex.has(key)) {
    idMap.set(key, bdIndex.get(key));
    existentes++;
    continue;
  }
  try {
    const inserted = await post('clientes', {
      nombre: c.nombre,
      apellido: c.apellido,
      localidad: c.localidad,
      monto_mensual: c.monto_mensual,
      estado: c.estado,
      beca: c.beca,
      notas: c.notas,
      fecha_instalacion: c.fecha_instalacion,
      direccion: c.direccion,
      tipo_pago: c.tipo_pago,
    });
    idMap.set(key, inserted[0].id);
    creados++;
    process.stdout.write('.');
  } catch (e) {
    errores++;
    console.error(`\n   ❌ ${c.nombre} ${c.apellido || ''}: ${e.message}`);
  }
}
console.log(`\n   → ${creados} creados, ${existentes} ya existían, ${errores} errores`);

// 3) Cargar cobros existentes
console.log('\n📥 Cargando cobros existentes...');
const bdCobros = await get('cobros?select=cliente_id,mes,anio');
const cobroSet = new Set(bdCobros.map(c => `${c.cliente_id}|${c.mes}|${c.anio}`));
console.log(`   → ${bdCobros.length} cobros en BD`);

// 4) Procesar cobros
console.log('\n💵 Procesando 146 cobros del sheet...');
let cCreados = 0, cExistentes = 0, cErrores = 0, cSinCliente = 0;

for (const [nombre, apellido, mes, anio, monto, estado, tipo_pago, recibido_por, notas] of COBROS) {
  const key = fuzzyKey(nombre, apellido);
  const cid = idMap.get(key);
  if (!cid) {
    cSinCliente++;
    console.error(`\n   ⚠ Sin cliente: ${nombre} ${apellido || ''} (key=${key})`);
    continue;
  }
  const cobroKey = `${cid}|${mes}|${anio}`;
  if (cobroSet.has(cobroKey)) {
    cExistentes++;
    continue;
  }
  try {
    await post('cobros', {
      cliente_id: cid,
      mes, anio, monto, estado, tipo_pago, recibido_por,
      fecha_pago: (estado === 'pagado' || estado === 'parcial')
        ? `${anio}-${String(mes).padStart(2, '0')}-05`
        : null,
      notas,
    });
    cCreados++;
    process.stdout.write('.');
  } catch (e) {
    cErrores++;
    console.error(`\n   ❌ ${nombre} ${apellido || ''} ${mes}/${anio}: ${e.message}`);
  }
}
console.log(`\n   → ${cCreados} creados, ${cExistentes} ya existían, ${cErrores} errores, ${cSinCliente} sin cliente`);

// 5) Resumen final
console.log('\n📊 Verificando totales finales...');
async function countOf(table) {
  const r = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: { ...headers, Prefer: 'count=exact' },
  });
  return r.headers.get('content-range')?.split('/')[1] ?? '?';
}
const [tc, tco, tm] = await Promise.all([countOf('clientes'), countOf('cobros'), countOf('mercancia')]);

console.log('\n══════════════════════════════════════');
console.log('📋 ESTADO FINAL DE LA BD');
console.log('══════════════════════════════════════');
console.log(`  Clientes:   ${tc}`);
console.log(`  Cobros:     ${tco}`);
console.log(`  Mercancía:  ${tm}`);
console.log('══════════════════════════════════════\n');
console.log('✅ Importación completada');
console.log('🔒 RECUERDA: borra SUPABASE_SERVICE_ROLE_KEY de .env.local cuando termines.\n');
