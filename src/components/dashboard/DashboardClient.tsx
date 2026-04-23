'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  Users, CreditCard, Wrench, CheckSquare, ShoppingCart, Plus, UserPlus, Activity,
  TrendingUp, TrendingDown, DollarSign, Wallet, PiggyBank, Percent, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Calendar, FileText, BookOpen, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, ComposedChart,
} from 'recharts';
import type { ActivityLog } from '@/types';

interface MonthData {
  label: string;
  ingresos: number;
  egresos: number;
  balance: number;
}

interface DashboardStats {
  ingresosMes: number;
  egresosMes: number;
  utilidadMes: number;
  margenMes: number;
  balanceTotal: number;
  totalRecaudadoMes: number;
  totalPorCobrarMes: number;
  totalRecaudadoPrev: number;
  ventasTotalMes: number;
  ventasTotalPrev: number;
  gananciaMes: number;
  totalClientes: number;
  clientesActivos: number;
  cobrosPagados: number;
  totalCobros: number;
  tasaCobro: number;
  instalacionesPendientes: number;
  tareasPendientes: number;
  flujoMensual: MonthData[];
  aging: { current: number; d30: number; d60: number; d90: number };
}

interface Props {
  stats: DashboardStats;
  actividad: ActivityLog[];
}

function formatShort(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString('es-DO');
}

function Delta({ current, previous, inverted = false }: { current: number; previous: number; inverted?: boolean }) {
  if (previous === 0 && current === 0) return <span className="delta-flat">—</span>;
  if (previous === 0) return <span className="delta-up">nuevo</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="delta-flat">= 0%</span>;
  const isUp = pct > 0;
  const isGood = inverted ? !isUp : isUp;
  const cls = isGood ? 'delta-up' : 'delta-down';
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cls}>
      <Icon size={12} />
      {isUp ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

export default function DashboardClient({ stats, actividad: initialActividad }: Props) {
  const [actividad, setActividad] = useState(initialActividad);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
        setActividad((prev) => [payload.new as ActivityLog, ...prev].slice(0, 8));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalPorCobrar = stats.aging.current + stats.aging.d30 + stats.aging.d60 + stats.aging.d90;
  const agingBuckets = [
    { label: 'Corriente', key: 'current', value: stats.aging.current, cls: 'aging-current', desc: 'Mes actual' },
    { label: '1-30 días', key: 'd30', value: stats.aging.d30, cls: 'aging-30', desc: '1 mes vencido' },
    { label: '31-60 días', key: 'd60', value: stats.aging.d60, cls: 'aging-60', desc: '2 meses vencido' },
    { label: '90+ días', key: 'd90', value: stats.aging.d90, cls: 'aging-90', desc: '3+ meses vencido' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/finanzas" className="btn-secondary flex items-center gap-2">
            <BarChart3 size={16} />
            Análisis Financiero
          </Link>
          <Link href="/libro-diario" className="btn-primary flex items-center gap-2">
            <BookOpen size={16} />
            Libro Diario
          </Link>
        </div>
      </div>

      {/* ============ SALUD FINANCIERA ============ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-[#1F2937]" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Salud Financiera</span>
          <div className="h-px flex-1 bg-[#1F2937]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ingresos */}
          <div className="kpi-card kpi-card-income">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Ingresos del Mes</span>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp size={16} className="text-emerald-400" />
              </div>
            </div>
            <div className="kpi-value text-emerald-400">{formatCurrency(stats.ingresosMes)}</div>
            <div className="kpi-sub flex items-center gap-2">
              <span>Cobros: {formatCurrency(stats.totalRecaudadoMes)}</span>
              <Delta current={stats.totalRecaudadoMes} previous={stats.totalRecaudadoPrev} />
            </div>
          </div>

          {/* Egresos */}
          <div className="kpi-card kpi-card-expense">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Egresos del Mes</span>
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown size={16} className="text-red-400" />
              </div>
            </div>
            <div className="kpi-value text-red-400">{formatCurrency(stats.egresosMes)}</div>
            <div className="kpi-sub">
              {stats.ingresosMes > 0
                ? `${((stats.egresosMes / stats.ingresosMes) * 100).toFixed(0)}% de ingresos`
                : 'Sin ingresos registrados'}
            </div>
          </div>

          {/* Utilidad */}
          <div className="kpi-card kpi-card-balance">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Utilidad Neta</span>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Wallet size={16} className="text-blue-400" />
              </div>
            </div>
            <div className={`kpi-value ${stats.utilidadMes >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {formatCurrency(stats.utilidadMes)}
            </div>
            <div className="kpi-sub">
              {stats.utilidadMes >= 0 ? 'Balance positivo' : 'Balance negativo'} este mes
            </div>
          </div>

          {/* Margen */}
          <div className="kpi-card kpi-card-margin">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Margen del Mes</span>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Percent size={16} className="text-purple-400" />
              </div>
            </div>
            <div className={`kpi-value ${stats.margenMes >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
              {stats.margenMes.toFixed(1)}%
            </div>
            <div className="kpi-sub">
              Ganancia ventas: {formatCurrency(stats.gananciaMes)}
            </div>
          </div>
        </div>
      </div>

      {/* ============ FLUJO DE CAJA + AGING ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flujo de caja 6 meses */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-400" />
                Flujo de Caja — Últimos 6 meses
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Ingresos vs Egresos registrados en Libro Diario</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Ingresos
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Egresos
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> Balance
              </span>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.flujoMensual} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis dataKey="label" stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={formatShort} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C2333',
                    border: '1px solid #1F2937',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#E5E7EB', textTransform: 'capitalize' }}
                />
                <Bar dataKey="ingresos" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="egresos" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Line type="monotone" dataKey="balance" stroke="#60A5FA" strokeWidth={2} dot={{ fill: '#60A5FA', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cuentas por cobrar — Aging */}
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-400" />
              Cuentas por Cobrar
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Análisis de antigüedad</p>
          </div>

          <div className="mb-4 p-3 rounded-lg bg-[#0F1725] border border-[#1F2937]">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Total Pendiente</span>
            <div className="text-2xl font-bold font-mono text-white mt-0.5 tabular">
              {formatCurrency(totalPorCobrar)}
            </div>
          </div>

          <div className="space-y-2">
            {agingBuckets.map((b) => {
              const pct = totalPorCobrar > 0 ? (b.value / totalPorCobrar) * 100 : 0;
              return (
                <div key={b.key} className={`aging-bucket ${b.cls}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">{b.label}</div>
                    <div className="text-[10px] opacity-70">{b.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono tabular">{formatCurrency(b.value)}</div>
                    <div className="text-[10px] opacity-70">{pct.toFixed(0)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ OPERACIONES ============ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-[#1F2937]" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Operaciones</span>
          <div className="h-px flex-1 bg-[#1F2937]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link href="/clientes" className="kpi-card kpi-card-neutral hover:border-blue-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Clientes</span>
              <Users size={14} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular">{stats.totalClientes}</div>
            <div className="kpi-sub">
              <span className="text-emerald-400">{stats.clientesActivos}</span> activos
            </div>
          </Link>

          <Link href="/cobros" className="kpi-card kpi-card-neutral hover:border-emerald-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Tasa Cobro</span>
              <CreditCard size={14} className="text-gray-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular">{stats.tasaCobro.toFixed(0)}%</div>
            <div className="progress-track mt-2">
              <div
                className="progress-fill bg-emerald-500"
                style={{ width: `${Math.min(100, stats.tasaCobro)}%` }}
              />
            </div>
            <div className="kpi-sub">{stats.cobrosPagados} / {stats.totalCobros} cobros</div>
          </Link>

          <Link href="/ventas" className="kpi-card kpi-card-neutral hover:border-cyan-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Ventas del Mes</span>
              <ShoppingCart size={14} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
            </div>
            <div className="text-xl font-bold text-white font-mono tabular">{formatShort(stats.ventasTotalMes)}</div>
            <div className="kpi-sub flex items-center gap-1">
              <Delta current={stats.ventasTotalMes} previous={stats.ventasTotalPrev} />
              <span>vs mes ant.</span>
            </div>
          </Link>

          <Link href="/instalaciones" className="kpi-card kpi-card-neutral hover:border-yellow-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Instalaciones</span>
              <Wrench size={14} className="text-gray-500 group-hover:text-yellow-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular">{stats.instalacionesPendientes}</div>
            <div className="kpi-sub">pendientes</div>
          </Link>

          <Link href="/tareas" className="kpi-card kpi-card-neutral hover:border-purple-500/40 transition-colors group">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Tareas</span>
              <CheckSquare size={14} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular">{stats.tareasPendientes}</div>
            <div className="kpi-sub">sin completar</div>
          </Link>
        </div>
      </div>

      {/* ============ ACTIVIDAD + QUICK ACTIONS ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-400" />
              <h2 className="font-semibold text-white">Actividad Reciente</h2>
            </div>
            <span className="badge badge-info">En vivo</span>
          </div>
          <div className="space-y-2">
            {actividad.length === 0 ? (
              <div className="py-10 text-center">
                <Activity size={28} className="text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Sin actividad reciente</p>
              </div>
            ) : (
              actividad.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1C2333] transition-colors">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0 animate-pulse-glow" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">{log.accion}</p>
                    {log.detalle && <p className="text-xs text-gray-500 truncate">{log.detalle}</p>}
                  </div>
                  <span className="text-[11px] text-gray-600 flex-shrink-0 tabular">{formatDateTime(log.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Plus size={16} className="text-blue-400" />
            Acciones Rápidas
          </h2>
          <div className="space-y-1.5">
            {[
              { href: '/clientes', icon: UserPlus, label: 'Nuevo Cliente', color: 'blue' },
              { href: '/cobros', icon: CreditCard, label: 'Registrar Cobro', color: 'emerald' },
              { href: '/ventas', icon: ShoppingCart, label: 'Nueva Venta', color: 'cyan' },
              { href: '/facturas', icon: FileText, label: 'Nueva Factura', color: 'purple' },
              { href: '/libro-diario', icon: DollarSign, label: 'Mov. Financiero', color: 'yellow' },
              { href: '/tareas', icon: CheckSquare, label: 'Nueva Tarea', color: 'pink' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#1C2333] transition-colors border border-transparent hover:border-[#2A3142] group"
                >
                  <div className={`p-2 rounded-lg bg-${action.color}-500/10 group-hover:scale-110 transition-transform`}>
                    <Icon size={14} className={`text-${action.color}-400`} />
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
