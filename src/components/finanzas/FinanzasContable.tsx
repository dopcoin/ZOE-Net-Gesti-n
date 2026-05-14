'use client';

import { useMemo, useState } from 'react';
import { formatCurrency, meses } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Percent, AlertCircle, Download,
  FileBarChart, Layers, Calendar, Activity,
  ArrowUp, ArrowDown, DollarSign, Wallet, Banknote, CreditCard, FileText as FileChequeIcon, Receipt,
} from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================

interface LibroEntry {
  id: string;
  fecha: string | null;
  tipo: string;
  categoria: string;
  descripcion: string;
  monto: number;
  metodo_pago: string | null;
  recibido_en: string | null;
  origen_tipo: string | null;
}

interface VentaEntry {
  id: string;
  total: number;
  ganancia: number;
  tipo: string;
  estado: string;
  created_at: string;
}

interface CobroEntry {
  id: string;
  cliente_id: string;
  monto: number;
  estado: string;
  mes: number;
  anio: number;
}

interface GananciaRev {
  id: string;
  monto: number;
  pagado: boolean | null;
}

interface Props {
  libroDiario: LibroEntry[];
  ventas: VentaEntry[];
  cobros: CobroEntry[];
  gananciasRevendedores: GananciaRev[];
  currentMonth: number;
  currentYear: number;
  rangeStart: string; // YYYY-MM-DD
  rangeEnd: string;   // YYYY-MM-DD
  rangeLabel: string;
}

// ============================================================
// HELPERS
// ============================================================

function formatShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString('es-DO');
}

/**
 * Normaliza método de pago a 6 categorías estándar.
 * Detecta cheques aunque estén marcados como "transferencia" si el receptor menciona "cheque" o "DopCoin".
 */
function normalizeMetodoPago(metodo: string | null, recibido_en: string | null): {
  key: string; label: string; icon: typeof Banknote; color: string; bg: string;
} {
  const m = (metodo ?? '').toLowerCase().trim();
  const r = (recibido_en ?? '').toLowerCase();

  // Detección de cheques por contexto
  if (r.includes('cheque') || r.includes('dopcoin')) {
    return { key: 'cheque', label: 'Cheque', icon: FileChequeIcon, color: 'text-purple-400', bg: 'bg-purple-500/15' };
  }

  if (m === 'efectivo' || m === 'cash' || m === 'efe') {
    return { key: 'efectivo', label: 'Efectivo', icon: Banknote, color: 'text-emerald-400', bg: 'bg-emerald-500/15' };
  }
  if (m === 'transferencia' || m === 'transfer') {
    return { key: 'transferencia', label: 'Transferencia', icon: Wallet, color: 'text-blue-400', bg: 'bg-blue-500/15' };
  }
  if (m === 'cheque') {
    return { key: 'cheque', label: 'Cheque', icon: FileChequeIcon, color: 'text-purple-400', bg: 'bg-purple-500/15' };
  }
  if (m === 'tarjeta' || m === 'card') {
    return { key: 'tarjeta', label: 'Tarjeta', icon: CreditCard, color: 'text-cyan-400', bg: 'bg-cyan-500/15' };
  }
  if (m === 'depósito' || m === 'deposito' || m === 'deposit') {
    return { key: 'deposito', label: 'Depósito', icon: Receipt, color: 'text-yellow-400', bg: 'bg-yellow-500/15' };
  }
  if (m === 'otro' || m === 'other') {
    return { key: 'otro', label: 'Otro', icon: DollarSign, color: 'text-orange-400', bg: 'bg-orange-500/15' };
  }
  // Sin método especificado
  return { key: 'sin_clasificar', label: 'Sin clasificar', icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-500/15' };
}

/**
 * Clasifica una entrada de libro_diario en líneas contables estándar.
 */
function categorizarIngreso(entry: LibroEntry): string {
  const cat = entry.categoria.toLowerCase();
  if (entry.origen_tipo === 'cobro' || cat.includes('cobro')) return 'Cobros (Internet)';
  if (entry.origen_tipo === 'venta' || cat.includes('venta')) return 'Ventas de Equipos';
  if (entry.origen_tipo === 'instalacion' || cat.includes('instalac')) return 'Instalaciones';
  if (entry.origen_tipo === 'factura' || cat.includes('factura')) return 'Facturas';
  return 'Otros Ingresos';
}

function categorizarGasto(entry: LibroEntry): string {
  const cat = entry.categoria;
  // Categorías estándar — el resto cae en "Otros Gastos"
  const standard = ['Nóminas', 'Mantenimientos', 'Viáticos', 'Servicios', 'Equipos', 'Suministros'];
  if (standard.includes(cat)) return cat;
  return 'Otros Gastos';
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PIE_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#F97316', '#6B7280'];

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

type ContableTab = 'pyg' | 'metodos' | 'temporal' | 'metricas';

export default function FinanzasContable({
  libroDiario, ventas, cobros, gananciasRevendedores,
  currentMonth, currentYear, rangeStart, rangeEnd, rangeLabel,
}: Props) {
  const [tab, setTab] = useState<ContableTab>('pyg');

  // Entradas filtradas por rango
  const entriesPeriodo = useMemo(() => {
    return libroDiario.filter((r) => {
      if (!r.fecha) return false;
      return r.fecha >= rangeStart && r.fecha <= rangeEnd;
    });
  }, [libroDiario, rangeStart, rangeEnd]);

  // ============================================================
  // CÁLCULOS PARA P&L (ESTADO DE RESULTADOS)
  // ============================================================
  const pyg = useMemo(() => {
    // INGRESOS — agrupados por línea contable
    const ingresosPorLinea: Record<string, { monto: number; count: number }> = {
      'Cobros (Internet)':  { monto: 0, count: 0 },
      'Ventas de Equipos':  { monto: 0, count: 0 },
      'Instalaciones':      { monto: 0, count: 0 },
      'Facturas':           { monto: 0, count: 0 },
      'Otros Ingresos':     { monto: 0, count: 0 },
    };
    entriesPeriodo.filter(e => e.tipo === 'ingreso').forEach(e => {
      const linea = categorizarIngreso(e);
      ingresosPorLinea[linea].monto += e.monto;
      ingresosPorLinea[linea].count += 1;
    });
    const ingresoBruto = Object.values(ingresosPorLinea).reduce((s, x) => s + x.monto, 0);

    // COGS — Costo de Mercancía Vendida (de ventas completadas en el período)
    const ventasPeriodo = ventas.filter(v => {
      const fecha = v.created_at.split('T')[0];
      return v.estado === 'completada' && fecha >= rangeStart && fecha <= rangeEnd;
    });
    const totalVentas = ventasPeriodo.reduce((s, v) => s + v.total, 0);
    const gananciaBrutaVentas = ventasPeriodo.reduce((s, v) => s + v.ganancia, 0);
    const cogs = totalVentas - gananciaBrutaVentas;

    const utilidadBruta = ingresoBruto - cogs;
    const margenBruto = ingresoBruto > 0 ? (utilidadBruta / ingresoBruto) * 100 : 0;

    // GASTOS OPERATIVOS — agrupados por categoría
    const gastosPorCat: Record<string, { monto: number; count: number }> = {
      'Nóminas':         { monto: 0, count: 0 },
      'Mantenimientos':  { monto: 0, count: 0 },
      'Viáticos':        { monto: 0, count: 0 },
      'Servicios':       { monto: 0, count: 0 },
      'Equipos':         { monto: 0, count: 0 },
      'Suministros':     { monto: 0, count: 0 },
      'Otros Gastos':    { monto: 0, count: 0 },
    };
    entriesPeriodo.filter(e => e.tipo === 'egreso').forEach(e => {
      const cat = categorizarGasto(e);
      gastosPorCat[cat].monto += e.monto;
      gastosPorCat[cat].count += 1;
    });
    const gastosOperativos = Object.values(gastosPorCat).reduce((s, x) => s + x.monto, 0);

    // Comisiones a revendedores pendientes (gasto no operativo)
    const comisionesPendientes = gananciasRevendedores
      .filter(g => !g.pagado)
      .reduce((s, g) => s + g.monto, 0);

    const utilidadOperativa = utilidadBruta - gastosOperativos;
    const margenOperativo = ingresoBruto > 0 ? (utilidadOperativa / ingresoBruto) * 100 : 0;

    const utilidadNeta = utilidadOperativa; // sin impuestos formales aún
    const margenNeto = ingresoBruto > 0 ? (utilidadNeta / ingresoBruto) * 100 : 0;

    return {
      ingresosPorLinea, ingresoBruto,
      cogs, totalVentas, gananciaBrutaVentas,
      utilidadBruta, margenBruto,
      gastosPorCat, gastosOperativos,
      comisionesPendientes,
      utilidadOperativa, margenOperativo,
      utilidadNeta, margenNeto,
    };
  }, [entriesPeriodo, ventas, gananciasRevendedores, rangeStart, rangeEnd]);

  // ============================================================
  // CÁLCULOS POR MÉTODO DE PAGO
  // ============================================================
  const porMetodo = useMemo(() => {
    const map: Record<string, {
      key: string; label: string; icon: typeof Banknote;
      color: string; bg: string;
      ingreso: number; egreso: number; count: number;
    }> = {};

    entriesPeriodo.forEach(e => {
      const m = normalizeMetodoPago(e.metodo_pago, e.recibido_en);
      if (!map[m.key]) {
        map[m.key] = { ...m, ingreso: 0, egreso: 0, count: 0 };
      }
      if (e.tipo === 'ingreso') map[m.key].ingreso += e.monto;
      else map[m.key].egreso += e.monto;
      map[m.key].count += 1;
    });

    const arr = Object.values(map).sort((a, b) => (b.ingreso + b.egreso) - (a.ingreso + a.egreso));
    const totalIngresos = arr.reduce((s, x) => s + x.ingreso, 0);
    const totalEgresos = arr.reduce((s, x) => s + x.egreso, 0);
    return { arr, totalIngresos, totalEgresos };
  }, [entriesPeriodo]);

  // ============================================================
  // ANÁLISIS TEMPORAL — Heatmap mes × método (12 meses)
  // ============================================================
  const temporal = useMemo(() => {
    const data: { mes: string; mesNum: number; anio: number; total: number; porMetodo: Record<string, number> }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = new Date(y, m + 1, 0).toISOString().split('T')[0];

      const monthEntries = libroDiario.filter(e =>
        e.fecha && e.fecha >= start && e.fecha <= end && e.tipo === 'ingreso'
      );

      const porMetodoMes: Record<string, number> = {
        efectivo: 0, transferencia: 0, cheque: 0, tarjeta: 0, deposito: 0, otro: 0, sin_clasificar: 0,
      };
      monthEntries.forEach(e => {
        const nm = normalizeMetodoPago(e.metodo_pago, e.recibido_en);
        porMetodoMes[nm.key] = (porMetodoMes[nm.key] || 0) + e.monto;
      });
      const total = Object.values(porMetodoMes).reduce((s, x) => s + x, 0);
      data.push({
        mes: meses[m].substring(0, 3),
        mesNum: m + 1, anio: y,
        total, porMetodo: porMetodoMes,
      });
    }

    // Encuentra el monto máximo de una celda para escalar colores
    let max = 0;
    data.forEach(d => {
      Object.values(d.porMetodo).forEach(v => { if (v > max) max = v; });
    });
    return { data, maxCell: max };
  }, [libroDiario, currentMonth, currentYear]);

  // ============================================================
  // MÉTRICAS FINANCIERAS
  // ============================================================
  const metricas = useMemo(() => {
    const ingresos = pyg.ingresoBruto;
    const gastos = pyg.gastosOperativos + pyg.cogs;

    // Ratios
    const ratioGastosIngresos = ingresos > 0 ? (gastos / ingresos) * 100 : 0;
    const ratioCostoVentas = pyg.totalVentas > 0 ? (pyg.cogs / pyg.totalVentas) * 100 : 0;

    // Concentración top 5 cobros pagados (por cliente)
    const cobrosPeriodo = cobros.filter(c => c.estado === 'pagado');
    const porCliente: Record<string, number> = {};
    cobrosPeriodo.forEach(c => {
      porCliente[c.cliente_id] = (porCliente[c.cliente_id] || 0) + c.monto;
    });
    const top5 = Object.values(porCliente).sort((a, b) => b - a).slice(0, 5);
    const totalCobros = Object.values(porCliente).reduce((s, x) => s + x, 0);
    const top5Sum = top5.reduce((s, x) => s + x, 0);
    const concentracionTop5 = totalCobros > 0 ? (top5Sum / totalCobros) * 100 : 0;

    // Burn rate (egreso promedio mensual de los últimos 6 meses con egresos)
    const burnSerie: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const m = d.getMonth(); const y = d.getFullYear();
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = new Date(y, m + 1, 0).toISOString().split('T')[0];
      const total = libroDiario
        .filter(e => e.fecha && e.fecha >= start && e.fecha <= end && e.tipo === 'egreso')
        .reduce((s, e) => s + e.monto, 0);
      if (total > 0) burnSerie.push(total);
    }
    const burnRate = burnSerie.length > 0 ? burnSerie.reduce((s, x) => s + x, 0) / burnSerie.length : 0;

    // Runway = (balance actual disponible) / burn rate (en meses) — usando utilidad operativa acumulada
    // No tenemos saldo bancario; aproximamos con la utilidad operativa del rango
    const runway = burnRate > 0 ? pyg.utilidadOperativa / burnRate : 0;

    // Tasa de cobranza
    const cobrosTotales = cobros.filter(c => c.estado !== 'exonerado');
    const cobrados = cobrosTotales.filter(c => c.estado === 'pagado' || c.estado === 'parcial');
    const tasaCobranza = cobrosTotales.length > 0 ? (cobrados.length / cobrosTotales.length) * 100 : 0;

    return {
      ratioGastosIngresos, ratioCostoVentas,
      concentracionTop5, top5Sum, totalCobros,
      burnRate, runway,
      tasaCobranza, cobrados: cobrados.length, cobrosTotales: cobrosTotales.length,
    };
  }, [pyg, cobros, libroDiario, currentMonth, currentYear]);

  // ============================================================
  // EXPORTS
  // ============================================================
  function exportPyG() {
    const rows: (string | number)[][] = [
      ['ESTADO DE RESULTADOS', rangeLabel],
      [],
      ['INGRESOS BRUTOS'],
      ['Línea', 'Monto', 'Transacciones'],
      ...Object.entries(pyg.ingresosPorLinea).map(([k, v]) => [k, v.monto, v.count]),
      ['Total Ingresos Brutos', pyg.ingresoBruto, ''],
      [],
      ['COSTOS DIRECTOS (COGS)'],
      ['Costo de Mercancía Vendida', pyg.cogs, ''],
      [],
      ['UTILIDAD BRUTA', pyg.utilidadBruta, `${pyg.margenBruto.toFixed(1)}%`],
      [],
      ['GASTOS OPERATIVOS'],
      ['Categoría', 'Monto', 'Transacciones'],
      ...Object.entries(pyg.gastosPorCat).map(([k, v]) => [k, v.monto, v.count]),
      ['Total Gastos Operativos', pyg.gastosOperativos, ''],
      [],
      ['UTILIDAD OPERATIVA', pyg.utilidadOperativa, `${pyg.margenOperativo.toFixed(1)}%`],
      ['UTILIDAD NETA', pyg.utilidadNeta, `${pyg.margenNeto.toFixed(1)}%`],
    ];
    downloadCSV(`estado_resultados_${rangeLabel.replace(/\s/g, '_')}.csv`, rows);
  }

  function exportMetodos() {
    const rows: (string | number)[][] = [
      ['Método', 'Ingresos', 'Egresos', '% del Total', 'Transacciones'],
      ...porMetodo.arr.map(m => [
        m.label, m.ingreso, m.egreso,
        porMetodo.totalIngresos > 0 ? `${((m.ingreso / porMetodo.totalIngresos) * 100).toFixed(1)}%` : '0%',
        m.count,
      ]),
    ];
    downloadCSV(`metodos_pago_${rangeLabel.replace(/\s/g, '_')}.csv`, rows);
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#1F2937] -mb-px overflow-x-auto pb-1">
        {([
          { k: 'pyg' as const,      label: 'Estado de Resultados', icon: FileBarChart },
          { k: 'metodos' as const,  label: 'Métodos de Pago',      icon: Layers },
          { k: 'temporal' as const, label: 'Análisis Temporal',    icon: Calendar },
          { k: 'metricas' as const, label: 'Métricas',             icon: Activity },
        ]).map((t) => {
          const Icon = t.icon;
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ============ TAB: Estado de Resultados (P&L) ============ */}
      {tab === 'pyg' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Estado de Resultados (P&amp;L)</h3>
              <p className="text-xs text-gray-500">Período: <span className="text-gray-300 font-semibold">{rangeLabel}</span></p>
            </div>
            <button onClick={exportPyG} className="btn-secondary flex items-center gap-2">
              <Download size={14} />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1F2937] bg-[#0A0F1E]">
                  <th className="table-header text-left">Concepto</th>
                  <th className="table-header text-right">Monto</th>
                  <th className="table-header text-right hidden sm:table-cell w-24">Trans.</th>
                  <th className="table-header text-right w-20">%</th>
                </tr>
              </thead>
              <tbody>
                {/* INGRESOS */}
                <tr className="bg-emerald-500/5 border-b border-[#1F2937]">
                  <td className="px-4 py-2.5 font-bold text-emerald-400 text-sm uppercase tracking-wider">
                    INGRESOS BRUTOS
                  </td>
                  <td colSpan={3}></td>
                </tr>
                {Object.entries(pyg.ingresosPorLinea).map(([linea, v]) => {
                  const pct = pyg.ingresoBruto > 0 ? (v.monto / pyg.ingresoBruto) * 100 : 0;
                  return (
                    <tr key={linea} className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/30">
                      <td className="px-4 py-2 pl-8 text-sm text-gray-300">└ {linea}</td>
                      <td className="px-4 py-2 text-right font-mono tabular text-sm text-gray-200">
                        {formatCurrency(v.monto)}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500 hidden sm:table-cell">{v.count}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-emerald-500/10 border-b-2 border-emerald-500/30">
                  <td className="px-4 py-2.5 font-bold text-emerald-400 text-sm">Total Ingresos Brutos</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular font-bold text-emerald-400">
                    {formatCurrency(pyg.ingresoBruto)}
                  </td>
                  <td colSpan={2} className="px-4 py-2.5 text-right text-xs text-emerald-400">100%</td>
                </tr>

                {/* COGS */}
                <tr className="bg-red-500/5 border-b border-[#1F2937]">
                  <td className="px-4 py-2.5 font-bold text-red-400 text-sm uppercase tracking-wider">
                    COSTOS DIRECTOS (COGS)
                  </td>
                  <td colSpan={3}></td>
                </tr>
                <tr className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/30">
                  <td className="px-4 py-2 pl-8 text-sm text-gray-300">└ Costo de Mercancía Vendida</td>
                  <td className="px-4 py-2 text-right font-mono tabular text-sm text-red-400">
                    ({formatCurrency(pyg.cogs)})
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-gray-500 hidden sm:table-cell">—</td>
                  <td className="px-4 py-2 text-right text-xs text-gray-500">
                    {pyg.ingresoBruto > 0 ? `${((pyg.cogs / pyg.ingresoBruto) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>

                {/* UTILIDAD BRUTA */}
                <tr className="bg-blue-500/10 border-b-2 border-blue-500/30">
                  <td className="px-4 py-3 font-bold text-blue-400 text-sm uppercase tracking-wider">
                    UTILIDAD BRUTA
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular font-bold text-blue-400">
                    {formatCurrency(pyg.utilidadBruta)}
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-right text-xs font-semibold text-blue-400">
                    Margen: {pyg.margenBruto.toFixed(1)}%
                  </td>
                </tr>

                {/* GASTOS OPERATIVOS */}
                <tr className="bg-orange-500/5 border-b border-[#1F2937]">
                  <td className="px-4 py-2.5 font-bold text-orange-400 text-sm uppercase tracking-wider">
                    GASTOS OPERATIVOS
                  </td>
                  <td colSpan={3}></td>
                </tr>
                {Object.entries(pyg.gastosPorCat).map(([cat, v]) => {
                  const pct = pyg.ingresoBruto > 0 ? (v.monto / pyg.ingresoBruto) * 100 : 0;
                  return (
                    <tr key={cat} className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/30">
                      <td className="px-4 py-2 pl-8 text-sm text-gray-300">└ {cat}</td>
                      <td className="px-4 py-2 text-right font-mono tabular text-sm text-orange-400">
                        ({formatCurrency(v.monto)})
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500 hidden sm:table-cell">{v.count}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-500">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-orange-500/10 border-b-2 border-orange-500/30">
                  <td className="px-4 py-2.5 font-bold text-orange-400 text-sm">Total Gastos Operativos</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular font-bold text-orange-400">
                    ({formatCurrency(pyg.gastosOperativos)})
                  </td>
                  <td colSpan={2} className="px-4 py-2.5 text-right text-xs text-orange-400">
                    {pyg.ingresoBruto > 0 ? `${((pyg.gastosOperativos / pyg.ingresoBruto) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>

                {/* UTILIDAD OPERATIVA */}
                <tr className="bg-purple-500/10 border-b-2 border-purple-500/30">
                  <td className="px-4 py-3 font-bold text-purple-400 text-sm uppercase tracking-wider">
                    UTILIDAD OPERATIVA
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular font-bold text-purple-400">
                    {formatCurrency(pyg.utilidadOperativa)}
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-right text-xs font-semibold text-purple-400">
                    Margen: {pyg.margenOperativo.toFixed(1)}%
                  </td>
                </tr>

                {/* UTILIDAD NETA */}
                <tr className={`${pyg.utilidadNeta >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'} border-t-2 border-blue-500`}>
                  <td className="px-4 py-4 font-bold text-base uppercase tracking-wider text-white">
                    UTILIDAD NETA
                  </td>
                  <td className={`px-4 py-4 text-right font-mono tabular font-bold text-xl ${pyg.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(pyg.utilidadNeta)}
                  </td>
                  <td colSpan={2} className={`px-4 py-4 text-right text-sm font-bold ${pyg.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Margen Neto: {pyg.margenNeto.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Aviso de comisiones pendientes */}
          {pyg.comisionesPendientes > 0 && (
            <div className="card p-4 border-l-4 border-yellow-500 bg-yellow-500/5">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-yellow-400">
                    Pasivo no operativo registrado fuera del P&amp;L
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Hay <strong className="text-yellow-400">{formatCurrency(pyg.comisionesPendientes)}</strong> en{' '}
                    comisiones de revendedores por pagar. No se incluyen en el P&amp;L hasta ser efectivamente pagadas
                    (impactarán como egreso en Libro Diario cuando se liquiden).
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ TAB: Métodos de Pago ============ */}
      {tab === 'metodos' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Composición por Método de Pago</h3>
              <p className="text-xs text-gray-500">Cómo entra cada peso · {rangeLabel}</p>
            </div>
            <button onClick={exportMetodos} className="btn-secondary flex items-center gap-2">
              <Download size={14} />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>

          {/* Cards por método */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {porMetodo.arr.map((m) => {
              const Icon = m.icon;
              const pct = porMetodo.totalIngresos > 0 ? (m.ingreso / porMetodo.totalIngresos) * 100 : 0;
              return (
                <div key={m.key} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${m.bg}`}>
                      <Icon size={16} className={m.color} />
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{m.label}</div>
                  <div className={`text-lg sm:text-xl font-bold font-mono tabular truncate ${m.color}`}>
                    {formatCurrency(m.ingreso)}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">{m.count} mov.</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Pie chart */}
            <div className="card p-5">
              <h4 className="text-sm font-semibold text-white mb-3">Distribución de Ingresos</h4>
              {porMetodo.totalIngresos === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-gray-500">
                  Sin ingresos en el período
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={porMetodo.arr.filter(m => m.ingreso > 0).map(m => ({ name: m.label, value: m.ingreso, key: m.key }))}
                        dataKey="value"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {porMetodo.arr.filter(m => m.ingreso > 0).map((m, i) => (
                          <Cell key={m.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1C2333', border: '1px solid #1F2937', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(v: number) => formatCurrency(v)}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Tabla resumen */}
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1F2937] bg-[#0A0F1E]">
                    <th className="table-header text-left">Método</th>
                    <th className="table-header text-right">Ingreso</th>
                    <th className="table-header text-right hidden sm:table-cell">Egreso</th>
                    <th className="table-header text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {porMetodo.arr.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-gray-500 py-8 text-sm">Sin movimientos</td></tr>
                  ) : (
                    porMetodo.arr.map(m => {
                      const Icon = m.icon;
                      const pct = porMetodo.totalIngresos > 0 ? (m.ingreso / porMetodo.totalIngresos) * 100 : 0;
                      return (
                        <tr key={m.key} className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/30">
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <Icon size={12} className={m.color} />
                              <span className="text-sm text-gray-200">{m.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular text-sm text-emerald-400">
                            {m.ingreso > 0 ? formatCurrency(m.ingreso) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular text-sm text-red-400 hidden sm:table-cell">
                            {m.egreso > 0 ? formatCurrency(m.egreso) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-gray-400">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                  <tr className="border-t-2 border-blue-500/30 bg-[#0A0F1E]">
                    <td className="px-4 py-3 font-semibold text-white text-sm">TOTAL</td>
                    <td className="px-4 py-3 text-right font-mono tabular font-bold text-emerald-400">
                      {formatCurrency(porMetodo.totalIngresos)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular font-bold text-red-400 hidden sm:table-cell">
                      {formatCurrency(porMetodo.totalEgresos)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-blue-400">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB: Análisis Temporal ============ */}
      {tab === 'temporal' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Análisis Temporal por Método</h3>
            <p className="text-xs text-gray-500">12 meses · Ingresos por mes y método de pago</p>
          </div>

          {/* Stacked Bar Chart por mes */}
          <div className="card p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Composición Mensual</h4>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={temporal.data.map(d => ({
                  mes: `${d.mes} ${String(d.anio).slice(2)}`,
                  Efectivo: d.porMetodo.efectivo || 0,
                  Transferencia: d.porMetodo.transferencia || 0,
                  Cheque: d.porMetodo.cheque || 0,
                  Tarjeta: d.porMetodo.tarjeta || 0,
                  Depósito: d.porMetodo.deposito || 0,
                  Otro: d.porMetodo.otro || 0,
                  'Sin clasif.': d.porMetodo.sin_clasificar || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="mes" stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={formatShort} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1C2333', border: '1px solid #1F2937', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }} />
                  <Bar dataKey="Efectivo"      stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Transferencia" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="Cheque"        stackId="a" fill="#8B5CF6" />
                  <Bar dataKey="Tarjeta"       stackId="a" fill="#06B6D4" />
                  <Bar dataKey="Depósito"      stackId="a" fill="#F59E0B" />
                  <Bar dataKey="Otro"          stackId="a" fill="#F97316" />
                  <Bar dataKey="Sin clasif."   stackId="a" fill="#6B7280" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Heatmap mes × método */}
          <div className="card p-5 overflow-x-auto">
            <h4 className="text-sm font-semibold text-white mb-3">Heatmap · Intensidad por Mes × Método</h4>
            <div className="min-w-[680px]">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-2 font-semibold text-gray-400 uppercase tracking-wider">Mes</th>
                    <th className="text-right py-2 px-2 font-semibold text-emerald-400">Efectivo</th>
                    <th className="text-right py-2 px-2 font-semibold text-blue-400">Transfer.</th>
                    <th className="text-right py-2 px-2 font-semibold text-purple-400">Cheque</th>
                    <th className="text-right py-2 px-2 font-semibold text-cyan-400">Tarjeta</th>
                    <th className="text-right py-2 px-2 font-semibold text-yellow-400">Depósito</th>
                    <th className="text-right py-2 px-2 font-semibold text-orange-400">Otro</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-500">S/clas.</th>
                    <th className="text-right py-2 px-2 font-bold text-white">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {temporal.data.map(d => {
                    return (
                      <tr key={`${d.anio}-${d.mesNum}`} className="border-t border-[#1F2937]">
                        <td className="py-2 px-2 font-mono text-gray-300 capitalize">{d.mes} {String(d.anio).slice(2)}</td>
                        {(['efectivo', 'transferencia', 'cheque', 'tarjeta', 'deposito', 'otro', 'sin_clasificar'] as const).map(k => {
                          const v = d.porMetodo[k] || 0;
                          const intensity = temporal.maxCell > 0 ? Math.min(1, v / temporal.maxCell) : 0;
                          const color = {
                            efectivo:        `rgba(16, 185, 129, ${intensity * 0.7 + 0.05})`,
                            transferencia:   `rgba(59, 130, 246, ${intensity * 0.7 + 0.05})`,
                            cheque:          `rgba(139, 92, 246, ${intensity * 0.7 + 0.05})`,
                            tarjeta:         `rgba(6, 182, 212, ${intensity * 0.7 + 0.05})`,
                            deposito:        `rgba(245, 158, 11, ${intensity * 0.7 + 0.05})`,
                            otro:            `rgba(249, 115, 22, ${intensity * 0.7 + 0.05})`,
                            sin_clasificar:  `rgba(107, 114, 128, ${intensity * 0.7 + 0.05})`,
                          }[k];
                          return (
                            <td key={k} className="text-right p-1">
                              <div
                                className="px-2 py-1.5 rounded text-right font-mono tabular text-[11px]"
                                style={{
                                  background: v > 0 ? color : 'transparent',
                                  color: v > 0 ? (intensity > 0.5 ? '#fff' : '#e5e7eb') : '#4b5563',
                                  fontWeight: v > 0 ? 600 : 400,
                                }}
                              >
                                {v > 0 ? formatShort(v) : '—'}
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-2 px-2 text-right font-mono tabular font-bold text-white">
                          {d.total > 0 ? formatShort(d.total) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[10px] text-gray-500 italic">
              💡 La intensidad del color indica el monto relativo. Celdas más oscuras = montos más altos en ese mes/método.
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB: Métricas Financieras ============ */}
      {tab === 'metricas' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Indicadores Financieros</h3>
            <p className="text-xs text-gray-500">Ratios y KPIs ejecutivos · {rangeLabel}</p>
          </div>

          {/* Márgenes */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">📊 Márgenes</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="kpi-card kpi-card-balance">
                <div className="kpi-label">Margen Bruto</div>
                <div className={`kpi-value ${pyg.margenBruto >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {pyg.margenBruto.toFixed(1)}%
                </div>
                <div className="kpi-sub">
                  (Ingresos − COGS) / Ingresos
                </div>
                <div className="progress-track mt-2">
                  <div className="progress-fill bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, pyg.margenBruto))}%` }} />
                </div>
              </div>
              <div className="kpi-card kpi-card-margin">
                <div className="kpi-label">Margen Operativo</div>
                <div className={`kpi-value ${pyg.margenOperativo >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                  {pyg.margenOperativo.toFixed(1)}%
                </div>
                <div className="kpi-sub">
                  Utilidad Operativa / Ingresos
                </div>
                <div className="progress-track mt-2">
                  <div className="progress-fill bg-purple-500" style={{ width: `${Math.min(100, Math.max(0, pyg.margenOperativo))}%` }} />
                </div>
              </div>
              <div className="kpi-card kpi-card-income">
                <div className="kpi-label">Margen Neto</div>
                <div className={`kpi-value ${pyg.margenNeto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pyg.margenNeto.toFixed(1)}%
                </div>
                <div className="kpi-sub">
                  Utilidad Neta / Ingresos
                </div>
                <div className="progress-track mt-2">
                  <div className={`progress-fill ${pyg.margenNeto >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.max(0, pyg.margenNeto))}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Ratios operativos */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">📐 Ratios Operativos</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={14} className="text-orange-400" />
                  <span className="kpi-label">Gastos / Ingresos</span>
                </div>
                <div className="text-xl font-bold font-mono tabular text-orange-400">{metricas.ratioGastosIngresos.toFixed(1)}%</div>
                <div className="kpi-sub">
                  {metricas.ratioGastosIngresos < 50 ? '✓ Saludable (&lt;50%)' :
                   metricas.ratioGastosIngresos < 75 ? '⚠ Aceptable (50-75%)' : '🚨 Alto (&gt;75%)'}
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Percent size={14} className="text-yellow-400" />
                  <span className="kpi-label">Costo / Ventas</span>
                </div>
                <div className="text-xl font-bold font-mono tabular text-yellow-400">{metricas.ratioCostoVentas.toFixed(1)}%</div>
                <div className="kpi-sub">COGS / Ventas brutas</div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle size={14} className="text-red-400" />
                  <span className="kpi-label">Concentración Top 5</span>
                </div>
                <div className="text-xl font-bold font-mono tabular text-red-400">{metricas.concentracionTop5.toFixed(1)}%</div>
                <div className="kpi-sub">
                  {metricas.concentracionTop5 > 50 ? '🚨 Alto riesgo' : '✓ Diversificado'}
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="kpi-label">Tasa de Cobranza</span>
                </div>
                <div className="text-xl font-bold font-mono tabular text-emerald-400">{metricas.tasaCobranza.toFixed(1)}%</div>
                <div className="kpi-sub">
                  {metricas.cobrados}/{metricas.cobrosTotales} cobrables
                </div>
              </div>
            </div>
          </div>

          {/* Burn rate y Runway */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">🔥 Salud Financiera</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDown size={14} className="text-red-400" />
                  <span className="kpi-label">Burn Rate Mensual</span>
                </div>
                <div className="text-xl font-bold font-mono tabular text-red-400">{formatCurrency(metricas.burnRate)}</div>
                <div className="kpi-sub">Promedio de egresos de los últimos 6 meses con actividad</div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} className="text-blue-400" />
                  <span className="kpi-label">Cobertura Operativa</span>
                </div>
                <div className={`text-xl font-bold font-mono tabular ${metricas.runway >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {metricas.runway >= 0 ? `${metricas.runway.toFixed(1)} meses` : 'N/A'}
                </div>
                <div className="kpi-sub">Utilidad operativa / burn rate mensual</div>
              </div>
            </div>
          </div>

          {/* Resumen interpretativo */}
          <div className="card p-5 bg-[#0F1725] border-blue-500/30 border-l-4">
            <h4 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
              <FileBarChart size={16} />
              Análisis Ejecutivo del Período
            </h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li>
                • <strong className="text-white">Rentabilidad:</strong>{' '}
                {pyg.margenNeto >= 30
                  ? `Margen neto excelente del ${pyg.margenNeto.toFixed(1)}% — operación altamente rentable.`
                  : pyg.margenNeto >= 15
                  ? `Margen neto saludable del ${pyg.margenNeto.toFixed(1)}% — sólido para el sector ISP.`
                  : pyg.margenNeto >= 0
                  ? `Margen neto bajo del ${pyg.margenNeto.toFixed(1)}% — revisar estructura de costos.`
                  : `⚠ Pérdida operativa de ${pyg.margenNeto.toFixed(1)}% — atención inmediata requerida.`}
              </li>
              <li>
                • <strong className="text-white">Estructura de ingresos:</strong>{' '}
                {(() => {
                  const totalIng = pyg.ingresoBruto;
                  const cobrosPct = totalIng > 0 ? (pyg.ingresosPorLinea['Cobros (Internet)'].monto / totalIng) * 100 : 0;
                  if (cobrosPct >= 60) return `${cobrosPct.toFixed(0)}% proviene de cobros recurrentes (Internet) — base sólida y predecible.`;
                  if (cobrosPct >= 30) return `${cobrosPct.toFixed(0)}% son cobros recurrentes — diversificación adecuada con ventas y otros.`;
                  return `Solo ${cobrosPct.toFixed(0)}% proviene de cobros recurrentes — considerar fortalecer ARPU.`;
                })()}
              </li>
              <li>
                • <strong className="text-white">Concentración de riesgo:</strong>{' '}
                {metricas.concentracionTop5 > 60
                  ? `🚨 Top 5 clientes representan ${metricas.concentracionTop5.toFixed(0)}% — alta dependencia, diversificar urgente.`
                  : metricas.concentracionTop5 > 40
                  ? `Top 5 clientes representan ${metricas.concentracionTop5.toFixed(0)}% — concentración moderada.`
                  : `Top 5 clientes solo ${metricas.concentracionTop5.toFixed(0)}% — cartera bien diversificada.`}
              </li>
              <li>
                • <strong className="text-white">Eficiencia operativa:</strong>{' '}
                {metricas.ratioGastosIngresos < 50
                  ? `Solo ${metricas.ratioGastosIngresos.toFixed(0)}% de los ingresos se va en gastos — operación eficiente.`
                  : metricas.ratioGastosIngresos < 75
                  ? `${metricas.ratioGastosIngresos.toFixed(0)}% de ingresos se consume en gastos — margen ajustado.`
                  : `${metricas.ratioGastosIngresos.toFixed(0)}% de ingresos se consume en gastos — revisar nóminas y servicios.`}
              </li>
              <li>
                • <strong className="text-white">Composición de pagos:</strong>{' '}
                {(() => {
                  const top = porMetodo.arr.filter(m => m.ingreso > 0)[0];
                  if (!top) return 'Sin ingresos registrados con método de pago.';
                  const pct = porMetodo.totalIngresos > 0 ? (top.ingreso / porMetodo.totalIngresos) * 100 : 0;
                  return `${top.label} es el método dominante con ${pct.toFixed(0)}% de los ingresos.`;
                })()}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
