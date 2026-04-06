'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  Users, CreditCard, Wrench, CheckSquare,
  ShoppingCart, Plus, UserPlus, Activity,
} from 'lucide-react';
import type { ActivityLog } from '@/types';

interface DashboardStats {
  totalClientes: number;
  clientesActivos: number;
  cobrosPagados: number;
  totalCobros: number;
  totalRecaudado: number;
  instalacionesPendientes: number;
  tareasPendientes: number;
  totalVentas: number;
}

interface Props {
  stats: DashboardStats;
  actividad: ActivityLog[];
}

export default function DashboardClient({ stats, actividad: initialActividad }: Props) {
  const [actividad, setActividad] = useState(initialActividad);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
        setActividad((prev) => [payload.new as ActivityLog, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const kpis = [
    { label: 'Total Clientes', value: stats.totalClientes, sub: `${stats.clientesActivos} activos`, icon: <Users size={20} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Cobros del Mes', value: `${stats.cobrosPagados}/${stats.totalCobros}`, sub: formatCurrency(stats.totalRecaudado), icon: <CreditCard size={20} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Instalaciones Pend.', value: stats.instalacionesPendientes, sub: 'pendientes', icon: <Wrench size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Tareas Pendientes', value: stats.tareasPendientes, sub: 'sin completar', icon: <CheckSquare size={20} />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Ventas del Mes', value: formatCurrency(stats.totalVentas), sub: 'en ventas', icon: <ShoppingCart size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">{kpi.label}</span>
              <div className={`p-2 rounded-lg ${kpi.bg}`}>
                <span className={kpi.color}>{kpi.icon}</span>
              </div>
            </div>
            <div className="stat-value">{kpi.value}</div>
            <div className="text-xs text-gray-500">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-blue-400" />
            <h2 className="font-semibold text-white">Actividad Reciente</h2>
          </div>
          <div className="space-y-3">
            {actividad.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Sin actividad reciente</p>
            ) : (
              actividad.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded hover:bg-[#1C2333]">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">{log.accion}</p>
                    {log.detalle && <p className="text-xs text-gray-500 truncate">{log.detalle}</p>}
                  </div>
                  <span className="text-xs text-gray-600 flex-shrink-0">{formatDateTime(log.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-white mb-4">Acciones Rápidas</h2>
          <div className="space-y-2">
            <Link href="/clientes" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1C2333] transition-colors">
              <div className="p-2 rounded-lg bg-blue-500/10"><UserPlus size={16} className="text-blue-400" /></div>
              <span className="text-sm text-gray-300">Nuevo Cliente</span>
            </Link>
            <Link href="/cobros" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1C2333] transition-colors">
              <div className="p-2 rounded-lg bg-emerald-500/10"><Plus size={16} className="text-emerald-400" /></div>
              <span className="text-sm text-gray-300">Registrar Cobro</span>
            </Link>
            <Link href="/tareas" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1C2333] transition-colors">
              <div className="p-2 rounded-lg bg-purple-500/10"><Plus size={16} className="text-purple-400" /></div>
              <span className="text-sm text-gray-300">Nueva Tarea</span>
            </Link>
            <Link href="/ventas" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1C2333] transition-colors">
              <div className="p-2 rounded-lg bg-cyan-500/10"><ShoppingCart size={16} className="text-cyan-400" /></div>
              <span className="text-sm text-gray-300">Nueva Venta</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
