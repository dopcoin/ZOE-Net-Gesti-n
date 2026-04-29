#!/usr/bin/env node
/**
 * DRY-RUN del seed v1.3.0 — analiza sin escribir.
 *
 * Reporta:
 * - Clientes del sheet que ya existen en BD (match fuzzy)
 * - Clientes del sheet que se INSERTARÍAN
 * - Clientes en BD que NO están en el sheet
 * - Cobros que se insertarían (por cliente, contando)
 * - Conflictos potenciales (ej. monto distinto)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
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
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function get(path) {
  const r = await fetch(URL_BASE + '/rest/v1/' + path, { headers });
  return r.json();
}

// Importar las listas de datos del script principal
const seed = await import(path.join(__dirname, 'run-seed.mjs').replace(/\\/g, '/').replace(/^/, 'file:///'));
// no exporta — voy a re-leerlo
const seedSrc = fs.readFileSync(path.join(__dirname, 'run-seed.mjs'), 'utf-8');
const matchClientes = seedSrc.match(/const CLIENTES = \[([\s\S]*?)\n\];/);
const matchCobros   = seedSrc.match(/const COBROS = \[([\s\S]*?)\n\];/);
const matchMerc     = seedSrc.match(/const MERCANCIA = \[([\s\S]*?)\n\];/);

const CLIENTES = eval('[' + matchClientes[1] + ']');
const COBROS   = eval('[' + matchCobros[1] + ']');
const MERCANCIA = eval('[' + matchMerc[1] + ']');

// Normalizador para matching fuzzy
function norm(s) {
  if (!s) return '';
  return s
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .replace(/[()/.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('🔍 Cargando datos actuales de la BD...\n');
const [bdClientes, bdCobros, bdMerc] = await Promise.all([
  get('clientes?select=id,nombre,apellido,localidad,monto_mensual,estado'),
  get('cobros?select=id,cliente_id,mes,anio,monto,estado'),
  get('mercancia?select=id,nombre,precio_compra,precio_venta,stock'),
]);

// Construir índice de clientes por nombre completo normalizado
const bdIndex = new Map();
for (const c of bdClientes) {
  const fullName = `${c.nombre || ''} ${c.apellido || ''}`.trim();
  bdIndex.set(norm(fullName), c);
}

// =============================================================
// CLIENTES
// =============================================================
console.log('═══════════════════════════════════════════════════════');
console.log('👥 ANÁLISIS DE CLIENTES');
console.log('═══════════════════════════════════════════════════════');

const matches = [];   // sheet client matched to existing
const nuevos = [];    // sheet clients NOT in BD
const sheetKeys = new Set();

for (const c of CLIENTES) {
  const fullName = `${c.nombre} ${c.apellido || ''}`.trim();
  const key = norm(fullName);
  sheetKeys.add(key);
  const existing = bdIndex.get(key);
  if (existing) {
    const issues = [];
    if (existing.monto_mensual != c.monto_mensual) {
      issues.push(`monto: BD=${existing.monto_mensual} vs sheet=${c.monto_mensual}`);
    }
    if (existing.estado !== c.estado) {
      issues.push(`estado: BD=${existing.estado} vs sheet=${c.estado}`);
    }
    matches.push({ sheet: c, bd: existing, issues });
  } else {
    nuevos.push(c);
  }
}

const huerfanos = bdClientes.filter(c => {
  const key = norm(`${c.nombre || ''} ${c.apellido || ''}`);
  return !sheetKeys.has(key);
});

console.log(`\n📌 Clientes en sheet:           ${CLIENTES.length}`);
console.log(`✅ Match con BD:                ${matches.length}`);
console.log(`➕ Nuevos a insertar:           ${nuevos.length}`);
console.log(`👤 Solo en BD (no en sheet):    ${huerfanos.length}`);

if (matches.length > 0) {
  console.log('\n--- MATCHES (mantener BD, mismo cliente) ---');
  for (const { sheet, bd, issues } of matches) {
    const sheetName = `${sheet.nombre} ${sheet.apellido || ''}`.trim();
    const bdName = `${bd.nombre || ''} ${bd.apellido || ''}`.trim();
    const flag = issues.length > 0 ? ` ⚠ ${issues.join(' · ')}` : '';
    console.log(`  • "${sheetName}" → BD: "${bdName}"${flag}`);
  }
}

if (nuevos.length > 0) {
  console.log('\n--- NUEVOS (se insertarán) ---');
  for (const c of nuevos) {
    console.log(`  + ${c.nombre} ${c.apellido || ''} (${c.localidad}, ${c.estado}, mensual:${c.monto_mensual})`);
  }
}

if (huerfanos.length > 0) {
  console.log('\n--- HUÉRFANOS (existen en BD pero no en sheet — se mantienen) ---');
  for (const c of huerfanos) {
    console.log(`  · ${c.nombre || ''} ${c.apellido || ''} (${c.localidad}, ${c.estado})`);
  }
}

// =============================================================
// COBROS
// =============================================================
console.log('\n═══════════════════════════════════════════════════════');
console.log('💵 ANÁLISIS DE COBROS');
console.log('═══════════════════════════════════════════════════════');

// Construir mapping nombre normalizado → cliente_id (incluyendo los que se insertarían con ids null)
const fullIndex = new Map();
for (const c of bdClientes) {
  const fullName = `${c.nombre || ''} ${c.apellido || ''}`.trim();
  fullIndex.set(norm(fullName), c.id);
}
// Los nuevos no tienen id, pero los marcamos como "se va a crear"
for (const c of nuevos) {
  const fullName = `${c.nombre} ${c.apellido || ''}`.trim();
  fullIndex.set(norm(fullName), '__NEW__');
}

// Set de cobros existentes
const cobrosExistentes = new Set();
for (const co of bdCobros) {
  cobrosExistentes.add(`${co.cliente_id}|${co.mes}|${co.anio}`);
}

let cobrosNuevos = 0, cobrosExistentesCount = 0, cobrosSinCliente = 0;
const cobrosPorCliente = {};

for (const [nombre, apellido, mes, anio] of COBROS) {
  const fullName = `${nombre} ${apellido || ''}`.trim();
  const key = norm(fullName);
  const cid = fullIndex.get(key);
  if (!cid) {
    cobrosSinCliente++;
    continue;
  }
  const cobroKey = `${cid}|${mes}|${anio}`;
  if (cid !== '__NEW__' && cobrosExistentes.has(cobroKey)) {
    cobrosExistentesCount++;
  } else {
    cobrosNuevos++;
    cobrosPorCliente[fullName] = (cobrosPorCliente[fullName] || 0) + 1;
  }
}

console.log(`\n📌 Cobros en sheet:             ${COBROS.length}`);
console.log(`➕ Nuevos a insertar:           ${cobrosNuevos}`);
console.log(`✅ Ya existen en BD:            ${cobrosExistentesCount}`);
console.log(`⚠ Sin cliente match:           ${cobrosSinCliente}`);

if (Object.keys(cobrosPorCliente).length > 0) {
  console.log('\n--- COBROS NUEVOS POR CLIENTE ---');
  for (const [c, n] of Object.entries(cobrosPorCliente).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${n.toString().padStart(2)} · ${c}`);
  }
}

// =============================================================
// MERCANCIA
// =============================================================
console.log('\n═══════════════════════════════════════════════════════');
console.log('📦 ANÁLISIS DE MERCANCÍA');
console.log('═══════════════════════════════════════════════════════');

const mercIndex = new Map();
for (const m of bdMerc) mercIndex.set(norm(m.nombre), m);

let mercNuevos = 0, mercMatches = 0;
const mercNuevosLista = [];
const mercMatchesLista = [];
for (const m of MERCANCIA) {
  const key = norm(m.nombre);
  if (mercIndex.has(key)) {
    mercMatches++;
    mercMatchesLista.push({ sheet: m, bd: mercIndex.get(key) });
  } else {
    mercNuevos++;
    mercNuevosLista.push(m);
  }
}

console.log(`\n📌 Productos en sheet:          ${MERCANCIA.length}`);
console.log(`✅ Match con BD:                ${mercMatches}`);
console.log(`➕ Nuevos a insertar:           ${mercNuevos}`);

if (mercMatchesLista.length > 0) {
  console.log('\n--- MATCHES (mantener BD) ---');
  for (const { sheet, bd } of mercMatchesLista) {
    console.log(`  • "${sheet.nombre}" → BD: "${bd.nombre}" (BD stock:${bd.stock})`);
  }
}
if (mercNuevosLista.length > 0) {
  console.log('\n--- NUEVOS ---');
  for (const m of mercNuevosLista) {
    console.log(`  + ${m.nombre} (compra:${m.precio_compra}, venta:${m.precio_venta}, stock:${m.stock})`);
  }
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('📋 RESUMEN');
console.log('═══════════════════════════════════════════════════════');
console.log(`   Se insertarán:`);
console.log(`     ${nuevos.length} clientes nuevos`);
console.log(`     ${cobrosNuevos} cobros`);
console.log(`     ${mercNuevos} productos`);
console.log(`\n   Se mantendrán intactos los datos existentes en BD.`);
console.log(`   Algunos discrepancias entre sheet y BD están reportadas con ⚠.`);
