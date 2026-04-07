'use client';

import { useState, useEffect } from 'react';
import {
  createRevendedor, updateRevendedor, deleteRevendedor,
  createGananciaManual, marcarGananciaPagada, getErrorMessage,
} from '@/lib/services';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus, Search, Edit2, Trash2, X,
  Repeat2, DollarSign, Check,
} from 'lucide-react';
import type { Revendedor, GananciaRevendedor, Venta, TipoComision } from '@/types';

type Tab = 'revendedores' | 'asignacion' | 'ganancias' | 'ventas';

interface MiembroOption {
  id: string;
  nombre: string;
  apellido: string;
  rol: string;
}

interface Props {
  revendedores: (Revendedor & { profiles?: { nombre: string; apellido: string } | null })[];
  ganancias: GananciaRevendedor[];
  ventas: Venta[];
  miembros: MiembroOption[];
}

const emptyRevendedor = {
  nombre: '',
  apellido: '',
  telefono: '',
  email: '',
  tipo_comision: 'porcentaje' as TipoComision,
  porcentaje_comision: 10,
  monto_fijo_comision: 0,
  activo: true,
  notas: '',
  responsable_id: '',
  zona: '',
};

export default function RevendedoresClient({ revendedores: initialRevendedores, ganancias: initialGanancias, ventas: initialVentas, miembros }: Props) {
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('revendedores');
  const [revendedores, setRevendedores] = useState(initialRevendedores);
  const [ganancias, setGanancias] = useState(initialGanancias);
  const [ventas] = useState(initialVentas);
  const [search, setSearch] = useState('');

  // Revendedor CRUD modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyRevendedor);

  // Ganancia manual modal
  const [showGananciaModal, setShowGananciaModal] = useState(false);
  const [gananciaForm, setGananciaForm] = useState({ revendedor_id: '', monto: 0, notas: '' });

  const [loading, setLoading] = useState(false);

  // Escape key handler and body overflow cleanup for main modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showModal]);

  // Escape key handler and body overflow cleanup for ganancia modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGananciaModal(false);
    };
    if (showGananciaModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showGananciaModal]);

  // --- Helpers ---
  const filtered = <T,>(list: T[], keys: string[]) =>
    list.filter((item) =>
      keys.some((k) => {
        const val = (item as any)[k];
        if (typeof val === 'string') return val.toLowerCase().includes(search.toLowerCase());
        if (val && typeof val === 'object' && 'nombre' in (val as Record<string, unknown>)) {
          const nested = val as Record<string, string>;
          return `${nested.nombre} ${nested.apellido}`.toLowerCase().includes(search.toLowerCase());
        }
        return false;
      })
    );

  // --- Stats ---
  const statsRevendedores = {
    total: revendedores.length,
    activos: revendedores.filter((r) => r.activo).length,
    inactivos: revendedores.filter((r) => !r.activo).length,
  };

  const statsGanancias = {
    total: ganancias.length,
    pendientes: ganancias.filter((g) => !g.pagado).length,
    montoPendiente: ganancias.filter((g) => !g.pagado).reduce((s, g) => s + g.monto, 0),
    montoPagado: ganancias.filter((g) => g.pagado).reduce((s, g) => s + g.monto, 0),
  };

  const statsVentas = {
    total: ventas.length,
    montoTotal: ventas.reduce((s, v) => s + v.total, 0),
    gananciaTotal: ventas.reduce((s, v) => s + v.ganancia, 0),
  };

  // --- CRUD Revendedores ---
  function openNew() {
    setEditingId(null);
    setForm(emptyRevendedor);
    setShowModal(true);
  }

  function openEdit(r: Revendedor & { profiles?: { nombre: string; apellido: string } | null; responsable_id?: string; zona?: string }) {
    setEditingId(r.id);
    setForm({
      nombre: r.nombre,
      apellido: r.apellido,
      telefono: r.telefono || '',
      email: r.email || '',
      tipo_comision: r.tipo_comision,
      porcentaje_comision: r.porcentaje_comision ?? 0,
      monto_fijo_comision: r.monto_fijo_comision ?? 0,
      activo: r.activo,
      notas: r.notas || '',
      responsable_id: r.responsable_id || '',
      zona: r.zona || '',
    });
    setShowModal(true);
  }

  async function saveRevendedor() {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      toast.error('Nombre y apellido son requeridos');
      return;
    }
    setLoading(true);
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      tipo_comision: form.tipo_comision,
      porcentaje_comision: form.tipo_comision !== 'fijo' ? form.porcentaje_comision : null,
      monto_fijo_comision: form.tipo_comision !== 'porcentaje' ? form.monto_fijo_comision : null,
      activo: form.activo,
      notas: form.notas.trim() || null,
      responsable_id: form.responsable_id || null,
      zona: form.zona.trim() || null,
    };

    if (editingId) {
      const result = await updateRevendedor(editingId, payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      // Re-fetch the updated record for local state
      const { data } = await supabase.from('revendedores').select().eq('id', editingId).single();
      if (data) setRevendedores((prev) => prev.map((r) => (r.id === editingId ? data : r)));
      toast.success('Revendedor actualizado');
    } else {
      const result = await createRevendedor(payload);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setLoading(false);
        return;
      }
      // Re-fetch the latest record for local state
      const { data } = await supabase.from('revendedores').select().order('created_at', { ascending: false }).limit(1).single();
      if (data) setRevendedores((prev) => [...prev, data]);
      toast.success('Revendedor creado');
    }
    setShowModal(false);
    setLoading(false);
  }

  async function handleDeleteRevendedor(id: string, nombre: string) {
    // Check if revendedor has associated ventas (FK constraint on ventas.revendedor_id)
    const { count } = await supabase
      .from('ventas')
      .select('id', { count: 'exact', head: true })
      .eq('revendedor_id', id);

    if (count && count > 0) {
      const deactivate = confirm(
        `"${nombre}" tiene ${count} venta(s) registrada(s) y no se puede eliminar.\n\n¿Desactivar el revendedor en cambio? Seguirá en el historial pero no aparecerá en nuevas ventas.`
      );
      if (!deactivate) return;
      const result = await updateRevendedor(id, { activo: false });
      if (result.error) { toast.error(getErrorMessage(result.error)); return; }
      setRevendedores((prev) => prev.map((r) => r.id === id ? { ...r, activo: false } : r));
      toast.success(`"${nombre}" desactivado`);
      return;
    }

    if (!confirm(`¿Eliminar a "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const result = await deleteRevendedor(id);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    setRevendedores((prev) => prev.filter((r) => r.id !== id));
    toast.success('Revendedor eliminado');
  }

  async function toggleActivo(r: Revendedor) {
    const result = await updateRevendedor(r.id, { activo: !r.activo });
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    const { data } = await supabase.from('revendedores').select().eq('id', r.id).single();
    if (data) {
      setRevendedores((prev) => prev.map((x) => (x.id === r.id ? data : x)));
      toast.success(data.activo ? 'Revendedor activado' : 'Revendedor desactivado');
    }
  }

  // --- Ganancias ---
  async function handleMarcarPagado(g: GananciaRevendedor) {
    const result = await marcarGananciaPagada(g.id);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    // Re-fetch updated ganancia for local state
    const { data } = await supabase
      .from('ganancias_revendedores')
      .select('*, revendedores(nombre, apellido), ventas(*)')
      .eq('id', g.id)
      .single();
    if (data) setGanancias((prev) => prev.map((x) => (x.id === g.id ? data : x)));
    toast.success('Ganancia marcada como pagada');
  }

  async function saveGananciaManual() {
    if (!gananciaForm.revendedor_id || gananciaForm.monto <= 0) {
      toast.error('Seleccione revendedor y monto > 0');
      return;
    }
    setLoading(true);
    const payload = {
      revendedor_id: gananciaForm.revendedor_id,
      monto: gananciaForm.monto,
      tipo: 'manual',
      pagado: false,
      estado: 'pendiente',
      notas: gananciaForm.notas.trim() || null,
    };
    const result = await createGananciaManual(payload);
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      setLoading(false);
      return;
    }
    // Re-fetch the latest ganancia for local state
    const { data } = await supabase
      .from('ganancias_revendedores')
      .select('*, revendedores(nombre, apellido), ventas(*)')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data) setGanancias((prev) => [data, ...prev]);
    setShowGananciaModal(false);
    setGananciaForm({ revendedor_id: '', monto: 0, notas: '' });
    setLoading(false);
    toast.success('Ganancia manual agregada');
  }

  // --- Asignacion rapida de responsable ---
  async function handleAsignarResponsable(revendedorId: string, responsableId: string) {
    const result = await updateRevendedor(revendedorId, { responsable_id: responsableId || null });
    if (result.error) {
      toast.error(getErrorMessage(result.error));
      return;
    }
    setRevendedores((prev) =>
      prev.map((r) =>
        r.id === revendedorId
          ? { ...r, responsable_id: responsableId || null }
          : r
      )
    );
    toast.success('Responsable asignado');
  }

  // --- Render helpers ---
  const tabs: { key: Tab; label: string }[] = [
    { key: 'revendedores', label: 'Revendedores' },
    { key: 'asignacion', label: 'Asignación' },
    { key: 'ganancias', label: 'Ganancias' },
    { key: 'ventas', label: 'Ventas' },
  ];

  const tipoComisionLabel: Record<TipoComision, string> = {
    porcentaje: 'Porcentaje',
    fijo: 'Fijo',
    mixto: 'Mixto',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Revendedores</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-[#1C2333] text-gray-400 hover:text-gray-200 hover:bg-[#2A3142]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      {tab === 'revendedores' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <span className="stat-label">Total</span>
            <span className="stat-value">{statsRevendedores.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Activos</span>
            <span className="stat-value text-emerald-400">{statsRevendedores.activos}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Inactivos</span>
            <span className="stat-value text-gray-400">{statsRevendedores.inactivos}</span>
          </div>
        </div>
      )}

      {tab === 'ganancias' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="stat-card">
            <span className="stat-label">Total Ganancias</span>
            <span className="stat-value">{statsGanancias.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pendientes</span>
            <span className="stat-value text-yellow-400">{statsGanancias.pendientes}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Monto Pendiente</span>
            <span className="stat-value text-yellow-400">{formatCurrency(statsGanancias.montoPendiente)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Monto Pagado</span>
            <span className="stat-value text-emerald-400">{formatCurrency(statsGanancias.montoPagado)}</span>
          </div>
        </div>
      )}

      {tab === 'ventas' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <span className="stat-label">Total Ventas</span>
            <span className="stat-value">{statsVentas.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Monto Total</span>
            <span className="stat-value">{formatCurrency(statsVentas.montoTotal)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Ganancia Total</span>
            <span className="stat-value text-emerald-400">{formatCurrency(statsVentas.gananciaTotal)}</span>
          </div>
        </div>
      )}

      {/* Search + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        {tab === 'revendedores' && (
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo Revendedor
          </button>
        )}
        {tab === 'ganancias' && (
          <button onClick={() => { setGananciaForm({ revendedor_id: '', monto: 0, notas: '' }); setShowGananciaModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Ganancia Manual
          </button>
        )}
      </div>

      {/* TAB: Revendedores */}
      {tab === 'revendedores' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1F2937]">
                  <th className="table-header">Nombre</th>
                  <th className="table-header">Telefono</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Comision</th>
                  <th className="table-header">Config</th>
                  <th className="table-header">Estado</th>
                  <th className="table-header text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered(revendedores, ['nombre', 'apellido', 'email']).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-cell text-center text-gray-500 py-8">
                      No se encontraron revendedores
                    </td>
                  </tr>
                ) : (
                  filtered(revendedores, ['nombre', 'apellido', 'email']).map((r) => (
                    <tr key={r.id} className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/50 transition-colors">
                      <td className="table-cell font-medium text-white">{r.nombre} {r.apellido}</td>
                      <td className="table-cell">{r.telefono || '—'}</td>
                      <td className="table-cell">{r.email || '—'}</td>
                      <td className="table-cell">
                        <span className="badge bg-blue-500/20 text-blue-400">{tipoComisionLabel[r.tipo_comision]}</span>
                      </td>
                      <td className="table-cell text-xs text-gray-400">
                        {(r.tipo_comision === 'porcentaje' || r.tipo_comision === 'mixto') && (
                          <span>{r.porcentaje_comision}%</span>
                        )}
                        {r.tipo_comision === 'mixto' && ' + '}
                        {(r.tipo_comision === 'fijo' || r.tipo_comision === 'mixto') && (
                          <span>{formatCurrency(r.monto_fijo_comision ?? 0)}</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => toggleActivo(r)}
                          className={`badge cursor-pointer ${r.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}
                        >
                          {r.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-[#2A3142] text-gray-400 hover:text-blue-400 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteRevendedor(r.id, `${r.nombre} ${r.apellido}`)} className="p-1.5 rounded hover:bg-red-600/20 text-gray-400 hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Ganancias */}
      {tab === 'ganancias' && (
        <div className="space-y-3">
          {filtered(ganancias, ['revendedores']).length === 0 ? (
            <div className="card p-8 text-center text-gray-500">No se encontraron ganancias</div>
          ) : (
            (ganancias as GananciaRevendedor[])
              .filter((g) => {
                if (!search) return true;
                const name = g.revendedores ? `${g.revendedores.nombre} ${g.revendedores.apellido}` : '';
                return name.toLowerCase().includes(search.toLowerCase());
              })
              .map((g) => (
                <div key={g.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign size={16} className="text-emerald-400 flex-shrink-0" />
                      <span className="font-medium text-white">
                        {g.revendedores ? `${g.revendedores.nombre} ${g.revendedores.apellido}` : 'Desconocido'}
                      </span>
                      <span className={`badge ${g.tipo === 'auto' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {g.tipo === 'auto' ? 'Auto' : 'Manual'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 flex items-center gap-3">
                      <span>Monto: <span className="text-white font-medium">{formatCurrency(g.monto)}</span></span>
                      <span>{formatDate(g.created_at)}</span>
                      {g.notas && <span className="truncate max-w-xs">- {g.notas}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {g.pagado ? (
                      <span className="badge bg-emerald-500/20 text-emerald-400">
                        <Check size={12} className="mr-1" /> Pagado
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarcarPagado(g)}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        <Check size={14} /> Marcar pagado
                      </button>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* TAB: Asignacion */}
      {tab === 'asignacion' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Asigna un responsable del equipo a cada revendedor. El responsable es el miembro del equipo que gestiona esa cuenta.</p>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1F2937]">
                  <th className="table-header">Revendedor</th>
                  <th className="table-header">Zona</th>
                  <th className="table-header">Responsable Asignado</th>
                  <th className="table-header">Estado</th>
                </tr>
              </thead>
              <tbody>
                {revendedores.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-cell text-center text-gray-500 py-8">
                      No hay revendedores registrados
                    </td>
                  </tr>
                ) : (
                  revendedores.map((r) => {
                    const rev = r as Revendedor & { responsable_id?: string; zona?: string; profiles?: { nombre: string; apellido: string } | null };
                    return (
                      <tr key={r.id} className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/50 transition-colors">
                        <td className="table-cell font-medium text-white">
                          {r.nombre} {r.apellido}
                          {rev.zona && <span className="ml-2 text-xs text-gray-500">({rev.zona})</span>}
                        </td>
                        <td className="table-cell text-gray-400 text-sm">{rev.zona || '—'}</td>
                        <td className="table-cell">
                          <select
                            value={rev.responsable_id || ''}
                            onChange={(e) => handleAsignarResponsable(r.id, e.target.value)}
                            className="input py-1 text-sm"
                          >
                            <option value="">Sin responsable</option>
                            {miembros.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nombre} {m.apellido} ({m.rol})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${r.activo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {r.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Ventas */}
      {tab === 'ventas' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1F2937]">
                  <th className="table-header">Producto</th>
                  <th className="table-header">Revendedor</th>
                  <th className="table-header">Cantidad</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Ganancia</th>
                  <th className="table-header">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ventas
                  .filter((v) => {
                    if (!search) return true;
                    const producto = v.mercancia?.nombre || '';
                    const rev = v.revendedores ? `${v.revendedores.nombre} ${v.revendedores.apellido}` : '';
                    return producto.toLowerCase().includes(search.toLowerCase()) || rev.toLowerCase().includes(search.toLowerCase());
                  })
                  .length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-cell text-center text-gray-500 py-8">
                      No se encontraron ventas de revendedores
                    </td>
                  </tr>
                ) : (
                  ventas
                    .filter((v) => {
                      if (!search) return true;
                      const producto = v.mercancia?.nombre || '';
                      const rev = v.revendedores ? `${v.revendedores.nombre} ${v.revendedores.apellido}` : '';
                      return producto.toLowerCase().includes(search.toLowerCase()) || rev.toLowerCase().includes(search.toLowerCase());
                    })
                    .map((v) => (
                      <tr key={v.id} className="border-b border-[#1F2937]/50 hover:bg-[#1C2333]/50 transition-colors">
                        <td className="table-cell font-medium text-white">{v.mercancia?.nombre || '—'}</td>
                        <td className="table-cell">
                          {v.revendedores ? `${v.revendedores.nombre} ${v.revendedores.apellido}` : '—'}
                        </td>
                        <td className="table-cell">{v.cantidad}</td>
                        <td className="table-cell">{formatCurrency(v.total)}</td>
                        <td className="table-cell text-emerald-400">{formatCurrency(v.ganancia)}</td>
                        <td className="table-cell text-gray-400">{formatDate(v.created_at)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Revendedor CRUD */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white">
                {editingId ? 'Editar Revendedor' : 'Nuevo Revendedor'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-[#2A3142] text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre *</label>
                  <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div>
                  <label className="label">Apellido *</label>
                  <input className="input" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Telefono</label>
                  <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Tipo de Comision</label>
                <select
                  className="input"
                  value={form.tipo_comision}
                  onChange={(e) => setForm({ ...form, tipo_comision: e.target.value as TipoComision })}
                >
                  <option value="porcentaje">Porcentaje</option>
                  <option value="fijo">Monto Fijo</option>
                  <option value="mixto">Mixto (Porcentaje + Fijo)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(form.tipo_comision === 'porcentaje' || form.tipo_comision === 'mixto') && (
                  <div>
                    <label className="label">Porcentaje (%)</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={form.porcentaje_comision}
                      onChange={(e) => setForm({ ...form, porcentaje_comision: Number(e.target.value) })}
                    />
                  </div>
                )}
                {(form.tipo_comision === 'fijo' || form.tipo_comision === 'mixto') && (
                  <div>
                    <label className="label">Monto Fijo (DOP)</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={form.monto_fijo_comision}
                      onChange={(e) => setForm({ ...form, monto_fijo_comision: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Responsable del Equipo</label>
                  <select
                    className="input"
                    value={form.responsable_id}
                    onChange={(e) => setForm({ ...form, responsable_id: e.target.value })}
                  >
                    <option value="">Sin responsable</option>
                    {miembros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} {m.apellido} ({m.rol})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Zona / Sector</label>
                  <input className="input" value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })} placeholder="Ej: Norte, Santiago..." />
                </div>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input min-h-[60px]" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, activo: !form.activo })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.activo ? 'bg-emerald-600' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.activo ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm text-gray-300">{form.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[#1F2937]">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={saveRevendedor} disabled={loading} className="btn-primary">
                {loading ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ganancia Manual */}
      {showGananciaModal && (
        <div className="modal-overlay" onClick={() => setShowGananciaModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
              <h2 className="text-lg font-semibold text-white">Agregar Ganancia Manual</h2>
              <button onClick={() => setShowGananciaModal(false)} className="p-1 rounded hover:bg-[#2A3142] text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Revendedor *</label>
                <select
                  className="input"
                  value={gananciaForm.revendedor_id}
                  onChange={(e) => setGananciaForm({ ...gananciaForm, revendedor_id: e.target.value })}
                >
                  <option value="">Seleccionar revendedor...</option>
                  {revendedores.filter((r) => r.activo).map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre} {r.apellido}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Monto (DOP) *</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={gananciaForm.monto}
                  onChange={(e) => setGananciaForm({ ...gananciaForm, monto: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea
                  className="input min-h-[60px]"
                  value={gananciaForm.notas}
                  onChange={(e) => setGananciaForm({ ...gananciaForm, notas: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[#1F2937]">
              <button onClick={() => setShowGananciaModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={saveGananciaManual} disabled={loading} className="btn-primary">
                {loading ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
