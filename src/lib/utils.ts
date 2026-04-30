import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { EstadoCliente, EstadoCobro, EstadoInstalacion, EstadoFactura, Prioridad, Rol, Equipo } from '@/types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd MMM yyyy', { locale: es });
  } catch {
    return date;
  }
}

export function formatDateTime(date: string | null): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd MMM yyyy HH:mm', { locale: es });
  } catch {
    return date;
  }
}

export function estadoClienteColor(estado: EstadoCliente): string {
  const map: Record<EstadoCliente, string> = {
    activo: 'bg-emerald-500/20 text-emerald-400',
    inactivo: 'bg-gray-500/20 text-gray-400',
    nuevo: 'bg-blue-500/20 text-blue-400',
    becado: 'bg-purple-500/20 text-purple-400',
    suspendido: 'bg-red-500/20 text-red-400',
  };
  return map[estado] || 'bg-gray-500/20 text-gray-400';
}

export function estadoCobroColor(estado: EstadoCobro): string {
  const map: Record<EstadoCobro, string> = {
    pagado: 'bg-emerald-500/20 text-emerald-400',
    pendiente: 'bg-yellow-500/20 text-yellow-400',
    mora: 'bg-red-500/20 text-red-400',
    exonerado: 'bg-purple-500/20 text-purple-400',
    parcial: 'bg-blue-500/20 text-blue-400',
    condonado: 'bg-cyan-500/20 text-cyan-400',
  };
  return map[estado] || 'bg-gray-500/20 text-gray-400';
}

export function estadoInstalacionColor(estado: EstadoInstalacion): string {
  const map: Record<EstadoInstalacion, string> = {
    pendiente: 'bg-yellow-500/20 text-yellow-400',
    en_progreso: 'bg-blue-500/20 text-blue-400',
    completada: 'bg-emerald-500/20 text-emerald-400',
    cancelada: 'bg-red-500/20 text-red-400',
  };
  return map[estado] || 'bg-gray-500/20 text-gray-400';
}

export function estadoFacturaColor(estado: EstadoFactura): string {
  const map: Record<EstadoFactura, string> = {
    emitida: 'bg-blue-500/20 text-blue-400',
    pendiente: 'bg-yellow-500/20 text-yellow-400',
    pagada: 'bg-emerald-500/20 text-emerald-400',
    vencida: 'bg-red-500/20 text-red-400',
    anulada: 'bg-gray-500/20 text-gray-400',
    cancelada: 'bg-gray-500/20 text-gray-400',
  };
  return map[estado] || 'bg-gray-500/20 text-gray-400';
}

export function prioridadColor(prioridad: Prioridad): string {
  const map: Record<Prioridad, string> = {
    baja: 'bg-gray-500/20 text-gray-400',
    normal: 'bg-blue-500/20 text-blue-400',
    alta: 'bg-yellow-500/20 text-yellow-400',
    urgente: 'bg-red-500/20 text-red-400',
  };
  return map[prioridad] || 'bg-gray-500/20 text-gray-400';
}

export function rolColor(rol: Rol): string {
  const map: Record<Rol, string> = {
    admin: 'bg-purple-500/20 text-purple-400',
    soporte: 'bg-blue-500/20 text-blue-400',
    financiero: 'bg-emerald-500/20 text-emerald-400',
    administrativo: 'bg-yellow-500/20 text-yellow-400',
  };
  return map[rol] || 'bg-gray-500/20 text-gray-400';
}

export function equipoColor(equipo: Equipo | null): string {
  if (!equipo) return 'bg-gray-500/20 text-gray-400';
  const map: Record<Equipo, string> = {
    soporte: 'bg-blue-500/20 text-blue-400',
    financiero: 'bg-emerald-500/20 text-emerald-400',
    administrativo: 'bg-yellow-500/20 text-yellow-400',
  };
  return map[equipo] || 'bg-gray-500/20 text-gray-400';
}

export const meses = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const categoriasIngreso = [
  'Cobros mensuales', 'Ventas equipos', 'Instalaciones', 'Reconexión', 'Otro ingreso',
];

export const categoriasEgreso = [
  'Nómina', 'Compra equipos', 'Combustible', 'Servicios', 'Mantenimiento', 'Otro egreso',
];
