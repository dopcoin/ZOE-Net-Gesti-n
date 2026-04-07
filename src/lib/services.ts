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

// ==================== CLIENTES ====================
export async function createCliente(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('clientes').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateCliente(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('clientes').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteCliente(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) return { error: handleError(error) };
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
    } else {
      const { id: _, ...insertData } = data;
      const { error } = await supabase.from('cobros').insert(insertData);
      if (error) return { error: handleError(error) };
    }
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== TAREAS ====================
export async function createTarea(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('tareas').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateTarea(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('tareas').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteTarea(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('tareas').delete().eq('id', id);
    if (error) return { error: handleError(error) };
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
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== INVENTARIO / MERCANCIA ====================
export async function createMercancia(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('mercancia').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateMercancia(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('mercancia').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteMercancia(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('mercancia').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== VENTAS ====================
export async function createVenta(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('ventas').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateVenta(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('ventas').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteVenta(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('ventas').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== INSTALACIONES ====================
export async function createInstalacion(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('instalaciones').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateInstalacion(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('instalaciones').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteInstalacion(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('instalaciones').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== FACTURAS ====================
export async function createFactura(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('facturas').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateFactura(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('facturas').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteFactura(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('facturas').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== LIBRO DIARIO ====================
export async function createRegistroDiario(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('libro_diario').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateRegistroDiario(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('libro_diario').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteRegistroDiario(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('libro_diario').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== CONCILIACION ====================
export async function createConciliacion(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('conciliacion').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== REVENDEDORES ====================
export async function createRevendedor(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('revendedores').insert(data);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function updateRevendedor(id: string, data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('revendedores').update(data).eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

export async function deleteRevendedor(id: string): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('revendedores').delete().eq('id', id);
    if (error) return { error: handleError(error) };
    return {};
  } catch (e) { return { error: handleError(e) }; }
}

// ==================== GANANCIAS REVENDEDORES ====================
export async function createGananciaManual(data: Record<string, unknown>): Promise<ServiceResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('ganancias_revendedores').insert(data);
    if (error) return { error: handleError(error) };
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
