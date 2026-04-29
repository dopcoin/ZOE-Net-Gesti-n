'use client';

import { useState, useMemo } from 'react';
import { formatDateTime, formatDate } from '@/lib/utils';
import {
  History, Filter, Search, User, Calendar, Download,
  Plus, Edit2, Trash2, Eye, AlertCircle, CheckCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';

interface LogEntry {
  id: string;
  usuario_id: string | null;
  usuario_nombre: string | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  detalles: Record<string, unknown> | null;
  detalle: string | null;
  created_at: string;
  profiles?: { nombre: string; apellido: string; rol: string } | null;
}

interface ProfileOption {
  id: string;
  nombre: string;
  apellido: string;
  rol: string;
}

interface Props {
  logs: LogEntry[];
  profiles: ProfileOption[];
}

type AccionTipo = 'crear' | 'editar' | 'eliminar' | 'ver' | 'estado' | 'otro';

function classifyAccion(accion: string): { tipo: AccionTipo; icon: LucideIcon; color: string; bg: string } {
  const a = accion.toLowerCase();
  if (a.includes('crea') || a.includes('agreg') || a.includes('insert') || a.includes('nuevo')) {
    return { tipo: 'crear', icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  }
  if (a.includes('elimin') || a.includes('borr') || a.includes('delet')) {
    return { tipo: 'eliminar', icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10' };
  }
  if (a.includes('actualiz') || a.includes('edit') || a.includes('modific') || a.includes('cambi')) {
    return { tipo: 'editar', icon: Edit2, color: 'text-blue-400', bg: 'bg-blue-500/10' };
  }
  if (a.includes('estado') || a.includes('pag') || a.includes('complet')) {
    return { tipo: 'estado', icon: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/10' };
  }
  if (a.includes('ver') || a.includes('login') || a.includes('acces')) {
    return { tipo: 'ver', icon: Eye, color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
  }
  return { tipo: 'otro', icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-500/10' };
}

const ENTIDADES = [
  'todos', 'clientes', 'cobros', 'mercancia', 'ventas', 'instalaciones',
  'facturas', 'libro_diario', 'tareas', 'revendedores', 'profiles', 'conciliacion',
];

export default function HistorialClient({ logs, profiles }: Props) {
  const [search, setSearch] = useState('');
  const [usuarioFilter, setUsuarioFilter] = useState<string>('todos');
  const [entidadFilter, setEntidadFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<AccionTipo | 'todos'>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Filtrado
  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (usuarioFilter !== 'todos' && log.usuario_id !== usuarioFilter) return false;
      if (entidadFilter !== 'todos' && log.entidad !== entidadFilter) return false;
      if (tipoFilter !== 'todos' && classifyAccion(log.accion).tipo !== tipoFilter) return false;
      if (fechaDesde) {
        if (log.created_at.split('T')[0] < fechaDesde) return false;
      }
      if (fechaHasta) {
        if (log.created_at.split('T')[0] > fechaHasta) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const userName = log.profiles ? `${log.profiles.nombre || ''} ${log.profiles.apellido || ''}`.toLowerCase() : (log.usuario_nombre ?? '').toLowerCase();
        return (
          log.accion.toLowerCase().includes(q) ||
          (log.detalle ?? '').toLowerCase().includes(q) ||
          (log.entidad ?? '').toLowerCase().includes(q) ||
          userName.includes(q)
        );
      }
      return true;
    });
  }, [logs, usuarioFilter, entidadFilter, tipoFilter, fechaDesde, fechaHasta, search]);

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const porUsuario: Record<string, { nombre: string; count: number }> = {};
    const porTipo: Record<AccionTipo, number> = { crear: 0, editar: 0, eliminar: 0, ver: 0, estado: 0, otro: 0 };
    filtered.forEach((log) => {
      const tipo = classifyAccion(log.accion).tipo;
      porTipo[tipo]++;
      if (log.usuario_id) {
        const nombre = log.profiles ? `${log.profiles.nombre} ${log.profiles.apellido}` : (log.usuario_nombre ?? 'Sin usuario');
        if (!porUsuario[log.usuario_id]) porUsuario[log.usuario_id] = { nombre, count: 0 };
        porUsuario[log.usuario_id].count++;
      }
    });
    const topUsuarios = Object.values(porUsuario).sort((a, b) => b.count - a.count).slice(0, 5);
    return { total, porTipo, topUsuarios };
  }, [filtered]);

  function exportCSV() {
    const rows: (string | number)[][] = [
      ['Fecha', 'Usuario', 'Rol', 'Acción', 'Entidad', 'ID', 'Detalle'],
    ];
    filtered.forEach((log) => {
      rows.push([
        log.created_at,
        log.profiles ? `${log.profiles.nombre} ${log.profiles.apellido}` : (log.usuario_nombre ?? ''),
        log.profiles?.rol ?? '',
        log.accion,
        log.entidad ?? '',
        log.entidad_id ?? '',
        log.detalle ?? JSON.stringify(log.detalles ?? {}),
      ]);
    });
    const csv = rows
      .map(r => r.map(c => {
        const s = String(c ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
      .join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch('');
    setUsuarioFilter('todos');
    setEntidadFilter('todos');
    setTipoFilter('todos');
    setFechaDesde('');
    setFechaHasta('');
  }

  const tieneFiltros = search || usuarioFilter !== 'todos' || entidadFilter !== 'todos' || tipoFilter !== 'todos' || fechaDesde || fechaHasta;

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Historial de Cambios"
        subtitle="Auditoría de todas las acciones por usuario"
        icon={History}
        iconColor="text-purple-400"
        iconBg="bg-purple-500/10"
        actions={
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
            <Download size={14} />
            <span className="hidden sm:inline">CSV</span>
          </button>
        }
      />

      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4">
          <span className="kpi-label">Total Acciones</span>
          <div className="text-2xl font-bold font-mono tabular text-white">{stats.total}</div>
          <div className="kpi-sub">en el rango filtrado</div>
        </div>
        <div className="card p-4">
          <span className="kpi-label">Creaciones</span>
          <div className="text-2xl font-bold font-mono tabular text-emerald-400">{stats.porTipo.crear}</div>
        </div>
        <div className="card p-4">
          <span className="kpi-label">Ediciones</span>
          <div className="text-2xl font-bold font-mono tabular text-blue-400">{stats.porTipo.editar}</div>
        </div>
        <div className="card p-4">
          <span className="kpi-label">Eliminaciones</span>
          <div className="text-2xl font-bold font-mono tabular text-red-400">{stats.porTipo.eliminar}</div>
        </div>
      </div>

      {/* Top usuarios */}
      {stats.topUsuarios.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <User size={14} className="text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Usuarios más activos
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {stats.topUsuarios.map((u, i) => {
              const max = stats.topUsuarios[0].count;
              const pct = (u.count / max) * 100;
              return (
                <div key={i} className="p-2 rounded-lg bg-[#1C2333]/50 border border-[#1F2937]">
                  <div className="text-xs text-gray-300 truncate">{u.nombre}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 progress-track">
                      <div className="progress-fill bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono tabular text-gray-400">{u.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <Filter size={12} />
            Filtros
          </span>
          {tieneFiltros && (
            <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300">
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label flex items-center gap-1">
              <User size={11} /> Usuario
            </label>
            <select value={usuarioFilter} onChange={(e) => setUsuarioFilter(e.target.value)} className="input">
              <option value="todos">Todos los usuarios</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.apellido} · {p.rol}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Entidad</label>
            <select value={entidadFilter} onChange={(e) => setEntidadFilter(e.target.value)} className="input">
              {ENTIDADES.map((e) => (
                <option key={e} value={e}>{e === 'todos' ? 'Todas las entidades' : e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1">
              <Calendar size={11} /> Desde
            </label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label flex items-center gap-1">
              <Calendar size={11} /> Hasta
            </label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="input" />
          </div>
        </div>

        {/* Tipo de acción */}
        <div className="flex flex-wrap gap-1.5">
          {([
            { k: 'todos' as const, label: 'Todas', count: stats.total },
            { k: 'crear' as const, label: 'Crear', count: stats.porTipo.crear },
            { k: 'editar' as const, label: 'Editar', count: stats.porTipo.editar },
            { k: 'eliminar' as const, label: 'Eliminar', count: stats.porTipo.eliminar },
            { k: 'estado' as const, label: 'Estado', count: stats.porTipo.estado },
            { k: 'ver' as const, label: 'Acceso', count: stats.porTipo.ver },
            { k: 'otro' as const, label: 'Otro', count: stats.porTipo.otro },
          ]).map((t) => (
            <button
              key={t.k}
              onClick={() => setTipoFilter(t.k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tipoFilter === t.k
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1C2333] text-gray-400 hover:text-gray-200 border border-[#1F2937]'
              }`}
            >
              {t.label}
              <span className={`text-[10px] tabular ${tipoFilter === t.k ? 'opacity-90' : 'opacity-60'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar acción, usuario, detalle..."
            className="input w-full pl-10"
          />
        </div>
      </div>

      {/* Lista de logs */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <History size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {tieneFiltros ? 'Sin resultados con los filtros aplicados' : 'No hay registros de actividad'}
          </p>
          {!tieneFiltros && (
            <p className="text-xs text-gray-600 mt-2">
              Las acciones se registrarán automáticamente al usar la plataforma.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const cls = classifyAccion(log.accion);
            const Icon = cls.icon;
            const userName = log.profiles
              ? `${log.profiles.nombre} ${log.profiles.apellido}`
              : log.usuario_nombre ?? 'Sistema';
            const userRol = log.profiles?.rol ?? '';
            return (
              <div key={log.id} className="card p-3 sm:p-4 hover:bg-[#1C2333]/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${cls.bg} flex-shrink-0`}>
                    <Icon size={14} className={cls.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">{log.accion}</div>
                        {log.detalle && (
                          <div className="text-xs text-gray-400 mt-0.5 break-words">{log.detalle}</div>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono tabular flex-shrink-0">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-gray-300">
                        <User size={10} className="text-gray-500" />
                        <span className="font-medium">{userName}</span>
                        {userRol && (
                          <span className="text-gray-500 capitalize">· {userRol}</span>
                        )}
                      </span>
                      {log.entidad && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1C2333] text-gray-400 border border-[#1F2937]">
                          {log.entidad}
                        </span>
                      )}
                      {log.entidad_id && (
                        <span className="text-gray-600 font-mono">
                          ID: {log.entidad_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer info */}
      <div className="text-center text-xs text-gray-600 pb-4">
        Mostrando {filtered.length} de {logs.length} registros · Últimos 90 días
      </div>
    </div>
  );
}
