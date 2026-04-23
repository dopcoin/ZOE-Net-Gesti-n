'use client';

import { useMemo, useState } from 'react';
import { formatCurrency, meses } from '@/lib/utils';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, PieChart, Pie, Cell, ComposedChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Percent, Users, AlertTriangle,
  PiggyBank, Activity, Wallet, Target, ShoppingCart, Download, Crown,
} from 'lucide-react';

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

interface CobroEntry {
  id: string;
  cliente_id: string;
  monto: number;
  estado: string;
  mes: number;
  anio: number;
  fecha_pago: string | null;
  clientes: { id: string; nombre: string; apellido: string } | null;
}

interface ClienteEntry {
  id: string;
  nombre: string;
  apellido: string;
  plan_mensual: number | null;
  estado: string;
  beca: boolean | null;
}

interface VentaEntry {
  id: string;
  total: number;
  ganancia: number;
  tipo: string;
  estado: string;
  created_at: string;
  mercancia: { nombre: string; categoria_id: string | null } | null;
}

interface FacturaEntry {
  id: string;
  total: number;
  estado: string;
  created_at: string;
}

interface GananciaRevEntry {
  id: string;
  monto: number;
  pagado: boolean | null;
  revendedor_id: string;
  revendedores: { nombre: string; apellido: string } | null;
}

interface Props {
  libroDiario: LibroEntry[];
  cobros: CobroEntry[];
  clientes: ClienteEntry[];
  ventas: VentaEntry[];
  facturas: FacturaEntry[];
  gananciasRevendedores: GananciaRevEntry[];
  currentMonth: number;
  currentYear: number;
}

const COLORS = {
  income: '#10B981',
  expense: '#EF4444',
  balance: '#3B82F6',
  accent: '#8B5CF6',
  warn: '#F59E0B',
  orange: '#F97316',
};

function formatShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return Math.round(v).toLocaleString('es-DO');
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map(r => r.map(c => {
      const s = String(c ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinanzasClient({
  libroDiario, cobros, clientes, ventas, gananciasRevendedores, currentMonth, currentYear,
}: Props) {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'anio'>('mes');

  // === Rango de fechas según período ===
  const { rangeStart, rangeLabel } = useMemo(() => {
    if (periodo === 'mes') {
      const start = new Date(currentYear, currentMonth - 1, 1);
      return { rangeStart: start, rangeLabel: `${meses[currentMonth - 1]} ${currentYear}` };
    }
    if (periodo === 'trimestre') {
      const q = Math.floor((currentMonth - 1) / 3);
      const start = new Date(currentYear, q * 3, 1);
      return { rangeStart: start, rangeLabel: `Q${q + 1} ${currentYear}` };
    }
    return { rangeStart: new Date(currentYear, 0, 1), rangeLabel: `Año ${currentYear}` };
  }, [periodo, currentMonth, currentYear]);

  // === KPIs financieros del período ===
  const financiero = useMemo(() => {
    const entriesPeriodo = libroDiario.filter(r => {
      if (!r.fecha) return false;
      return new Date(r.fecha + 'T00:00:00') >= rangeStart;
    });
    const ingresos = entriesPeriodo.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0);
    const egresos = entriesPeriodo.filter(r => r.tipo === 'egreso').reduce((s, r) => s + r.monto, 0);
    const utilidad = ingresos - egresos;
    const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;

    // Histórico total (todo lo que hay)
    const totalIngresos = libroDiario.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0);
    const totalEgresos = libroDiario.filter(r => r.tipo === 'egreso').reduce((s, r) => s + r.monto, 0);

    return {
      ingresos, egresos, utilidad, margen,
      balanceTotal: totalIngresos - totalEgresos,
      totalIngresosHist: totalIngresos,
      totalEgresosHist: totalEgresos,
    };
  }, [libroDiario, rangeStart]);

  // === MRR + ARPU ===
  const mrr = useMemo(() => {
    const activos = clientes.filter(c => c.estado === 'activo' && !c.beca);
    const totalMensual = activos.reduce((s, c) => s + (c.plan_mensual || 0), 0);
    const arpu = activos.length > 0 ? totalMensual / activos.length : 0;
    return { mrr: totalMensual, arpu, activos: activos.length };
  }, [clientes]);

  // === Serie mensual últimos 12 meses ===
  const serieMensual = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(currentYear, currentMonth - 1 - (11 - i), 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const entries = libroDiario.filter(r => {
        if (!r.fecha) return false;
        const rd = new Date(r.fecha + 'T00:00:00');
        return rd.getMonth() === m && rd.getFullYear() === y;
      });
      const ingresos = entries.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0);
      const egresos = entries.filter(r => r.tipo === 'egreso').reduce((s, r) => s + r.monto, 0);
      return {
        label: `${meses[m].substring(0, 3)} ${String(y).slice(2)}`,
        mes: m + 1,
        anio: y,
        ingresos,
        egresos,
        utilidad: ingresos - egresos,
      };
    });
  }, [libroDiario, currentMonth, currentYear]);

  // === Aging cuentas por cobrar ===
  const aging = useMemo(() => {
    const pendientes = cobros.filter(c => c.estado === 'pendiente' || c.estado === 'mora' || c.estado === 'parcial');
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
    const clientesMap: Record<string, { nombre: string; total: number; meses: number }> = {};

    pendientes.forEach(c => {
      const diff = (currentYear - c.anio) * 12 + (currentMonth - c.mes);
      const monto = c.monto || 0;
      if (diff <= 0) buckets.current += monto;
      else if (diff === 1) buckets.d30 += monto;
      else if (diff === 2) buckets.d60 += monto;
      else buckets.d90 += monto;

      if (c.clientes) {
        const key = c.cliente_id;
        if (!clientesMap[key]) {
          clientesMap[key] = {
            nombre: `${c.clientes.nombre} ${c.clientes.apellido}`,
            total: 0,
            meses: 0,
          };
        }
        clientesMap[key].total += monto;
        clientesMap[key].meses += 1;
      }
    });

    const topDeudores = Object.values(clientesMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return { buckets, total: buckets.current + buckets.d30 + buckets.d60 + buckets.d90, topDeudores };
  }, [cobros, currentMonth, currentYear]);

  // === Top clientes por facturación pagada ===
  const topClientes = useMemo(() => {
    const map: Record<string, { nombre: string; total: number; pagos: number }> = {};
    cobros.filter(c => c.estado === 'pagado').forEach(c => {
      if (!c.clientes) return;
      const key = c.cliente_id;
      if (!map[key]) map[key] = { nombre: `${c.clientes.nombre} ${c.clientes.apellido}`, total: 0, pagos: 0 };
      map[key].total += c.monto || 0;
      map[key].pagos += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [cobros]);

  // === Ingresos por categoría ===
  const ingresosCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    libroDiario.filter(r => r.tipo === 'ingreso' && r.fecha && new Date(r.fecha + 'T00:00:00') >= rangeStart)
      .forEach(r => { map[r.categoria] = (map[r.categoria] || 0) + r.monto; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [libroDiario, rangeStart]);

  // === Egresos por categoría ===
  const egresosCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    libroDiario.filter(r => r.tipo === 'egreso' && r.fecha && new Date(r.fecha + 'T00:00:00') >= rangeStart)
      .forEach(r => { map[r.categoria] = (map[r.categoria] || 0) + r.monto; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [libroDiario, rangeStart]);

  // === Ventas: margen por ventas del año ===
  const ventasStats = useMemo(() => {
    const total = ventas.reduce((s, v) => s + v.total, 0);
    const ganancia = ventas.reduce((s, v) => s + v.ganancia, 0);
    const margen = total > 0 ? (ganancia / total) * 100 : 0;
    const directas = ventas.filter(v => v.tipo === 'directa').reduce((s, v) => s + v.total, 0);
    const revendedor = ventas.filter(v => v.tipo === 'revendedor').reduce((s, v) => s + v.total, 0);
    return { total, ganancia, margen, directas, revendedor };
  }, [ventas]);

  // === Comisiones a pagar revendedores ===
  const comisionesPendientes = useMemo(() => {
    const pend = gananciasRevendedores.filter(g => !g.pagado);
    const total = pend.reduce((s, g) => s + g.monto, 0);
    const map: Record<string, { nombre: string; total: number; count: number }> = {};
    pend.forEach(g => {
      if (!g.revendedores) return;
      const key = g.revendedor_id;
      if (!map[key]) map[key] = { nombre: `${g.revendedores.nombre} ${g.revendedores.apellido}`, total: 0, count: 0 };
      map[key].total += g.monto;
      map[key].count += 1;
    });
    return { total, count: pend.length, porRevendedor: Object.values(map).sort((a, b) => b.total - a.total) };
  }, [gananciasRevendedores]);

  // === Export CSV ===
  function exportPyG() {
    const rows: (string | number)[][] = [
      ['Estado de Resultados', rangeLabel],
      [],
      ['INGRESOS'],
      ['Categoría', 'Monto'],
      ...ingresosCategoria.map(i => [i.name, i.value]),
      ['Total Ingresos', financiero.ingresos],
      [],
      ['EGRESOS'],
      ['Categoría', 'Monto'],
      ...egresosCategoria.map(e => [e.name, e.value]),
      ['Total Egresos', financiero.egresos],
      [],
      ['Utilidad Neta', financiero.utilidad],
      ['Margen Neto %', financiero.margen.toFixed(2)],
    ];
    downloadCSV(`estado_resultados_${rangeLabel.replace(' ', '_')}.csv`, rows);
  }

  const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#EC4899'];

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="hidden sm:block">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <PiggyBank className="text-blue-400" size={26} />
            Análisis Financiero
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Estado de resultados · Flujo de caja · KPIs ejecutivos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Periodo selector */}
          <div className="flex flex-1 sm:flex-initial rounded-lg bg-[#1C2333] border border-[#1F2937] p-1">
            {(['mes', 'trimestre', 'anio'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
                  periodo === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {p === 'mes' ? 'Mes' : p === 'trimestre' ? 'Trim.' : 'Año'}
              </button>
            ))}
          </div>
          <button onClick={exportPyG} className="btn-secondary flex items-center justify-center gap-2">
            <Download size={14} />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Período: <span className="text-gray-300 font-semibold">{rangeLabel}</span>
      </div>

      {/* ============ KPIs PRINCIPALES ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="kpi-card kpi-card-income">
          <div className="flex items-center justify-between">
            <span className="kpi-label">Ingresos</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="kpi-value text-emerald-400 truncate">
            <span className="sm:hidden">{formatShort(financiero.ingresos)}</span>
            <span className="hidden sm:inline">{formatCurrency(financiero.ingresos)}</span>
          </div>
          <div className="kpi-sub">{ingresosCategoria.length} categorías</div>
        </div>

        <div className="kpi-card kpi-card-expense">
          <div className="flex items-center justify-between">
            <span className="kpi-label">Egresos</span>
            <TrendingDown size={16} className="text-red-400" />
          </div>
          <div className="kpi-value text-red-400 truncate">
            <span className="sm:hidden">{formatShort(financiero.egresos)}</span>
            <span className="hidden sm:inline">{formatCurrency(financiero.egresos)}</span>
          </div>
          <div className="kpi-sub">{egresosCategoria.length} categorías</div>
        </div>

        <div className="kpi-card kpi-card-balance">
          <div className="flex items-center justify-between">
            <span className="kpi-label">Utilidad Neta</span>
            <Wallet size={16} className="text-blue-400" />
          </div>
          <div className={`kpi-value truncate ${financiero.utilidad >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            <span className="sm:hidden">{formatShort(financiero.utilidad)}</span>
            <span className="hidden sm:inline">{formatCurrency(financiero.utilidad)}</span>
          </div>
          <div className="kpi-sub">
            {financiero.utilidad >= 0 ? (
              <span className="text-emerald-400">↑ Rentable</span>
            ) : (
              <span className="text-red-400">↓ Pérdida</span>
            )}
          </div>
        </div>

        <div className="kpi-card kpi-card-margin">
          <div className="flex items-center justify-between">
            <span className="kpi-label">Margen Neto</span>
            <Percent size={16} className="text-purple-400" />
          </div>
          <div className={`kpi-value ${financiero.margen >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
            {financiero.margen.toFixed(1)}%
          </div>
          <div className="progress-track mt-2">
            <div
              className={`progress-fill ${financiero.margen >= 0 ? 'bg-purple-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, Math.abs(financiero.margen))}%` }}
            />
          </div>
        </div>
      </div>

      {/* ============ KPIs SECUNDARIOS ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} className="text-cyan-400" />
            <span className="kpi-label">MRR</span>
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400 tabular">{formatCurrency(mrr.mrr)}</div>
          <div className="kpi-sub">{mrr.activos} clientes activos</div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-blue-400" />
            <span className="kpi-label">ARPU</span>
          </div>
          <div className="text-xl font-bold font-mono text-blue-400 tabular">{formatCurrency(mrr.arpu)}</div>
          <div className="kpi-sub">Por cliente/mes</div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-yellow-400" />
            <span className="kpi-label">Por Cobrar</span>
          </div>
          <div className="text-xl font-bold font-mono text-yellow-400 tabular">{formatCurrency(aging.total)}</div>
          <div className="kpi-sub">
            <span className={aging.buckets.d90 > 0 ? 'text-red-400' : 'text-gray-500'}>
              {formatCurrency(aging.buckets.d90)} 90+d
            </span>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={14} className="text-purple-400" />
            <span className="kpi-label">Comisiones Pend.</span>
          </div>
          <div className="text-xl font-bold font-mono text-purple-400 tabular">{formatCurrency(comisionesPendientes.total)}</div>
          <div className="kpi-sub">{comisionesPendientes.count} pendientes</div>
        </div>
      </div>

      {/* ============ FLUJO DE CAJA 12 MESES ============ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Activity size={16} className="text-blue-400" />
              Flujo de Caja — 12 Meses
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Evolución mensual de ingresos, egresos y utilidad</p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Ingresos</span>
            <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Egresos</span>
            <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Utilidad</span>
          </div>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serieMensual} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis dataKey="label" stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={formatShort} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1C2333', border: '1px solid #1F2937', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="ingresos" fill={COLORS.income} radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="egresos" fill={COLORS.expense} radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Line type="monotone" dataKey="utilidad" stroke={COLORS.balance} strokeWidth={2.5} dot={{ fill: COLORS.balance, r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ============ INGRESOS vs EGRESOS POR CATEGORIA ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingresos */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" />
            Ingresos por Categoría
          </h3>
          {ingresosCategoria.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-gray-600 text-sm">Sin ingresos en el período</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-[200px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ingresosCategoria} dataKey="value" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {ingresosCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1C2333', border: '1px solid #1F2937', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-[160px] sm:max-h-[240px]">
                {ingresosCategoria.map((c, i) => {
                  const pct = (c.value / financiero.ingresos) * 100;
                  return (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-gray-300 truncate">{c.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-gray-200 font-mono tabular">{formatShort(c.value)}</span>
                        <span className="text-gray-500 ml-1">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Egresos */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown size={16} className="text-red-400" />
            Egresos por Categoría
          </h3>
          {egresosCategoria.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-gray-600 text-sm">Sin egresos en el período</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-[200px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={egresosCategoria} dataKey="value" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {egresosCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1C2333', border: '1px solid #1F2937', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-[160px] sm:max-h-[240px]">
                {egresosCategoria.map((c, i) => {
                  const pct = (c.value / financiero.egresos) * 100;
                  return (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-gray-300 truncate">{c.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-gray-200 font-mono tabular">{formatShort(c.value)}</span>
                        <span className="text-gray-500 ml-1">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ CUENTAS POR COBRAR — AGING + DEUDORES ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-400" />
            Antigüedad de Saldos
          </h3>
          <p className="text-xs text-gray-500 mb-4">Distribución de cuentas por cobrar según días vencidos</p>

          <div className="space-y-2">
            {[
              { label: 'Corriente (mes actual)', value: aging.buckets.current, cls: 'aging-current' },
              { label: '1-30 días vencido', value: aging.buckets.d30, cls: 'aging-30' },
              { label: '31-60 días vencido', value: aging.buckets.d60, cls: 'aging-60' },
              { label: '90+ días vencido', value: aging.buckets.d90, cls: 'aging-90' },
            ].map((b, i) => {
              const pct = aging.total > 0 ? (b.value / aging.total) * 100 : 0;
              return (
                <div key={i} className={`aging-bucket ${b.cls}`}>
                  <div className="flex-1">
                    <div className="text-xs font-semibold">{b.label}</div>
                    <div className="progress-track mt-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="progress-fill bg-current opacity-80" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-bold font-mono tabular">{formatCurrency(b.value)}</div>
                    <div className="text-[10px] opacity-70">{pct.toFixed(0)}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-[#1F2937] flex items-center justify-between">
            <span className="text-sm text-gray-400">Total Por Cobrar</span>
            <span className="text-xl font-bold font-mono text-white tabular">{formatCurrency(aging.total)}</span>
          </div>
        </div>

        {/* Top deudores */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <Users size={16} className="text-red-400" />
            Top Deudores
          </h3>
          <p className="text-xs text-gray-500 mb-4">Clientes con mayor saldo pendiente</p>

          {aging.topDeudores.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-gray-600 text-sm">
              Sin cuentas por cobrar
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {aging.topDeudores.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#1C2333]/50 border border-[#1F2937] hover:bg-[#1C2333] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-400 flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-200 truncate">{d.nombre}</div>
                      <div className="text-[11px] text-gray-500">{d.meses} mes{d.meses !== 1 ? 'es' : ''} pendiente{d.meses !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono text-red-400 tabular flex-shrink-0 ml-2">
                    {formatCurrency(d.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ TOP CLIENTES + COMISIONES ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top clientes */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <Crown size={16} className="text-yellow-400" />
            Top Clientes por Facturación
          </h3>
          <p className="text-xs text-gray-500 mb-4">Clientes que más han pagado (histórico)</p>

          {topClientes.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-gray-600 text-sm">Sin pagos registrados</div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {topClientes.map((c, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                return (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#1C2333]/50 border border-[#1F2937]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {medal}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-200 truncate">{c.nombre}</div>
                        <div className="text-[11px] text-gray-500">{c.pagos} pago{c.pagos !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold font-mono text-emerald-400 tabular flex-shrink-0 ml-2">
                      {formatCurrency(c.total)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Comisiones revendedores */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <ShoppingCart size={16} className="text-purple-400" />
            Comisiones por Pagar
          </h3>
          <p className="text-xs text-gray-500 mb-4">Revendedores con comisiones pendientes</p>

          {comisionesPendientes.porRevendedor.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-gray-600 text-sm">Sin comisiones pendientes</div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {comisionesPendientes.porRevendedor.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-200 truncate">{r.nombre}</div>
                      <div className="text-[11px] text-gray-500">{r.count} venta{r.count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono text-purple-400 tabular flex-shrink-0 ml-2">
                    {formatCurrency(r.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ VENTAS SUMMARY ============ */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShoppingCart size={16} className="text-cyan-400" />
              Resumen de Ventas — Año {currentYear}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Rentabilidad y distribución</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-[#0F1725] border border-[#1F2937]">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Ventas</div>
            <div className="text-lg font-bold font-mono text-cyan-400 tabular mt-1">{formatCurrency(ventasStats.total)}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#0F1725] border border-[#1F2937]">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Ganancia Bruta</div>
            <div className="text-lg font-bold font-mono text-emerald-400 tabular mt-1">{formatCurrency(ventasStats.ganancia)}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#0F1725] border border-[#1F2937]">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Margen</div>
            <div className="text-lg font-bold font-mono text-purple-400 tabular mt-1">{ventasStats.margen.toFixed(1)}%</div>
          </div>
          <div className="p-3 rounded-lg bg-[#0F1725] border border-[#1F2937]">
            <div className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">Directa / Revendedor</div>
            <div className="text-sm font-bold font-mono mt-1">
              <span className="text-blue-400 tabular">{formatShort(ventasStats.directas)}</span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-purple-400 tabular">{formatShort(ventasStats.revendedor)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
