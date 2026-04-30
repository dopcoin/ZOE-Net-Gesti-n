import { createClient } from '@/lib/supabase/client';

// Centralized error type
export interface ServiceError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface ServiceResult<T = void> {
  data?: T;
  error?: ServiceError;
}

function handleError(error: unknown): ServiceError {
  if (error && typeof error === 'object' && 'message' in error) {
    const e = error as { message: string; code?: string; details?: string; hint?: string };
    return { message: e.message, code: e.code, details: e.details, hint: e.hint };
  }
  return { message: String(error) };
}

// ==================== ACTIVITY LOG ====================
/**
 * Registra una acción del usuario en activity_log. Falla silenciosa.
 */
export async function logActivity(params: {
  accion: string;
  entidad?: string | null;
  entidad_id?: string | null;
  detalle?: string | null;
  detalles?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single();
    const usuario_nombre = profile ? `${profile.nombre} ${profile.apellido}` : null;

    const payload: Record<string, unknown> = {
      usuario_id: user.id,
      usuario_nombre,
      accion: params.accion,
      entidad: params.entidad ?? null,
      entidad_id: params.entidad_id ?? null,
      detalle: params.detalle ?? null,
      detalles: params.detalles ?? null,
    };
    await supabase.from('activity_log').insert(payload);
  } catch (e) {
    console.warn('[activity_log] error:', e);
  }
}

// Helper: extrae nombre legible de un payload de cliente/cobro/etc para audit
function getDetalle(data: Record<string, unknown>, fallback = ''): string {
  const nombre = (data.nombre as string) || '';
  const apellido = (data.apellido as string) || '';
  const desc = (data.descripcion as string) || '';
  const numero = (data.numero as string) || '';
  if (nombre || apellido) return `${nombre} ${apellido}`.trim();
  if (numero) return numero;
  if (desc) return desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
  return fallback;
}

// ==================== CLIENTES ====================
export async function createCliente(data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { data: result, error } = await supabase.from('clientes').insert(data).select('id').single();
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Cliente creado', entidad: 'clientes', entidad_id: result.id, detalle: getDetalle(data) });
    return { data: result };
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateCliente(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('clientes').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Cliente actualizado', entidad: 'clientes', entidad_id: id, detalle: getDetalle(data) });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteCliente(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Cliente eliminado', entidad: 'clientes', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== COBROS ====================
export async function upsertCobro(data: {
  id?: string; cliente_id: string; mes: number; anio: number;
  monto: number; estado: string; tipo_pago?: string; fecha_pago?: string; notas?: string;
}): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    if (data.id) {
      const { error } = await supabase.from('cobros').update(data).eq('id', data.id);
      if (error) return { error: handleError(error) };
      void logActivity({
        accion: `Cobro actualizado · ${data.estado}`,
        entidad: 'cobros',
        entidad_id: data.id,
        detalle: `${data.mes}/${data.anio} · RD$${data.monto}`,
      });
    } else {
      const { id: _, ...insertData } = data;
      const { data: result, error } = await supabase.from('cobros').insert(insertData).select('id').single();
      if (error) return { error: handleError(error) };
      void logActivity({
        accion: `Cobro registrado · ${data.estado}`,
        entidad: 'cobros',
        entidad_id: result.id,
        detalle: `${data.mes}/${data.anio} · RD$${data.monto}`,
      });
    }
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== TAREAS ====================
export async function createTarea(data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { data: result, error } = await supabase.from('tareas').insert(data).select('id').single();
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Tarea creada', entidad: 'tareas', entidad_id: result.id, detalle: (data.titulo as string) || '' });
    return { data: result };
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateTarea(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('tareas').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Tarea actualizada', entidad: 'tareas', entidad_id: id, detalle: (data.titulo as string) || '' });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteTarea(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('tareas').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Tarea eliminada', entidad: 'tareas', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function toggleTarea(id: string, completada: boolean): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const updates: Record<string, unknown> = {
      completada,
      estado: completada ? 'completada' : 'pendiente',
      completada_en: completada ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('tareas').update(updates).eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({
      accion: completada ? 'Tarea completada' : 'Tarea reabierta',
      entidad: 'tareas',
      entidad_id: id,
    });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== INVENTARIO / MERCANCIA ====================
export async function createMercancia(data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { data: result, error } = await supabase.from('mercancia').insert(data).select('id').single();
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Producto creado', entidad: 'mercancia', entidad_id: result.id, detalle: getDetalle(data) });
    return { data: result };
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateMercancia(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('mercancia').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    // Detectar liquidación específicamente
    const isLiquidate = data.activo === false && data.stock === 0;
    void logActivity({
      accion: isLiquidate ? 'Producto liquidado' : 'Producto actualizado',
      entidad: 'mercancia',
      entidad_id: id,
      detalle: getDetalle(data),
    });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteMercancia(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('mercancia').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Producto eliminado', entidad: 'mercancia', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== VENTAS ====================
export async function createVenta(data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { data: result, error } = await supabase.from('ventas').insert(data).select('id').single();
    if (error) return { error: handleError(error) };
    void logActivity({
      accion: 'Venta registrada',
      entidad: 'ventas',
      entidad_id: result.id,
      detalle: `Cantidad: ${data.cantidad} · RD$${data.precio_unitario}`,
    });
    return { data: result };
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateVenta(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('ventas').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Venta actualizada', entidad: 'ventas', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteVenta(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('ventas').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Venta eliminada', entidad: 'ventas', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== INSTALACIONES ====================
export async function createInstalacion(data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { data: result, error } = await supabase.from('instalaciones').insert(data).select('id').single();
    if (error) return { error: handleError(error) };
    void logActivity({
      accion: 'Instalación creada',
      entidad: 'instalaciones',
      entidad_id: result.id,
      detalle: `${data.tipo} · ${data.direccion}`,
    });
    return { data: result };
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateInstalacion(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('instalaciones').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Instalación actualizada', entidad: 'instalaciones', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteInstalacion(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('instalaciones').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Instalación eliminada', entidad: 'instalaciones', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== FACTURAS ====================
export async function createFactura(data: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const { data: result, error } = await supabase.from('facturas').insert(data).select('id').single();
    if (error) return { error: handleError(error) };
    void logActivity({
      accion: 'Factura creada',
      entidad: 'facturas',
      entidad_id: result.id,
      detalle: getDetalle(data),
    });
    return { data: result };
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateFactura(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('facturas').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Factura actualizada', entidad: 'facturas', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteFactura(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('facturas').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Factura eliminada', entidad: 'facturas', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== LIBRO DIARIO ====================
export async function deleteLibroDiarioByOrigen(origenId: string, origenTipo: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('libro_diario')
      .delete()
      .eq('origen_id', origenId)
      .eq('origen_tipo', origenTipo);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function createRegistroDiario(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { data: result, error } = await supabase.from('libro_diario').insert(data).select('id').single();
    if (error) return { error: handleError(error) };
    void logActivity({
      accion: `${data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`,
      entidad: 'libro_diario',
      entidad_id: result.id,
      detalle: `${data.categoria} · RD$${data.monto}`,
    });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateRegistroDiario(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('libro_diario').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Registro libro diario actualizado', entidad: 'libro_diario', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteRegistroDiario(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('libro_diario').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Registro libro diario eliminado', entidad: 'libro_diario', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== CONCILIACION ====================
export async function createConciliacion(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('conciliacion').insert(data);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Conciliación registrada', entidad: 'conciliacion' });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== REVENDEDORES ====================
export async function createRevendedor(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('revendedores').insert(data);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Revendedor creado', entidad: 'revendedores', detalle: getDetalle(data) });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateRevendedor(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('revendedores').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Revendedor actualizado', entidad: 'revendedores', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteRevendedor(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('revendedores').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Revendedor eliminado', entidad: 'revendedores', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== GANANCIAS REVENDEDORES ====================
export async function createGananciaManual(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('ganancias_revendedores').insert(data);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Ganancia revendedor creada', entidad: 'ganancias_revendedores' });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function marcarGananciaPagada(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('ganancias_revendedores')
      .update({ pagado: true, estado: 'pagado', fecha_pago: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: handleError(error) };
    void logActivity({ accion: 'Ganancia revendedor pagada', entidad: 'ganancias_revendedores', entidad_id: id });
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== HELPER: Show error toast ====================
export function getErrorMessage(error: ServiceError): string {
  let msg = error.message;
  if (error.details) msg += ` | ${error.details}`;
  if (error.hint) msg += ` | Hint: ${error.hint}`;
  if (error.code) msg += ` (${error.code})`;
  return msg;
}
