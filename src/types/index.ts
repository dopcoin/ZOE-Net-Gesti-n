export type Rol = 'admin' | 'soporte' | 'financiero' | 'administrativo';

export type EstadoCliente = 'activo' | 'inactivo' | 'nuevo' | 'becado' | 'suspendido';

export type EstadoCobro = 'pagado' | 'pendiente' | 'mora' | 'exonerado' | 'parcial';

export type TipoCobro = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

export type EstadoInstalacion = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';

export type Prioridad = 'baja' | 'normal' | 'alta' | 'urgente';

export type TipoComision = 'porcentaje' | 'fijo' | 'mixto';

export type TipoVenta = 'directa' | 'revendedor';

export type EstadoVenta = 'completada' | 'pendiente' | 'cancelada';

export type TipoMovimiento = 'ingreso' | 'egreso';

export type EstadoFactura = 'emitida' | 'pendiente' | 'pagada' | 'vencida' | 'anulada' | 'cancelada';

export type Equipo = 'soporte' | 'financiero' | 'administrativo';

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  equipo: Equipo | null;
  telefono: string | null;
  avatar_url: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type TipoCliente = 'persona' | 'empresa';

export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  plan: string | null;
  monto_mensual: number;
  estado: EstadoCliente;
  beca: boolean;
  beca_descripcion: string | null;
  fecha_instalacion: string | null;
  nombre_red: string | null;
  password_router: string | null;
  password_antena: string | null;
  ip_asignada: string | null;
  ubicacion_gps: string | null;
  notas: string | null;
  tipo_cliente: TipoCliente;
  rnc: string | null;
  razon_social: string | null;
  created_at: string;
  updated_at: string;
}

export interface Cobro {
  id: string;
  cliente_id: string;
  mes: number;
  anio: number;
  monto: number;
  estado: EstadoCobro;
  tipo_pago: TipoCobro | null;
  fecha_pago: string | null;
  recibido_por: string | null;
  registrado_por: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
  profiles?: { nombre: string; apellido: string } | null;
}

export interface CategoriaMercancia {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
}

export interface Mercancia {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: string | null;
  precio_compra: number;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
  categorias_mercancia?: CategoriaMercancia;
}

export interface Revendedor {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo_comision: TipoComision;
  porcentaje_comision: number | null;
  monto_fijo_comision: number | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
}

export interface Venta {
  id: string;
  mercancia_id: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  ganancia: number;
  tipo: TipoVenta;
  estado: EstadoVenta;
  cliente_id: string | null;
  revendedor_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  mercancia?: Mercancia;
  clientes?: Cliente;
  revendedores?: Revendedor;
}

export interface GananciaRevendedor {
  id: string;
  revendedor_id: string;
  venta_id: string | null;
  monto: number;
  tipo: string;
  pagado: boolean;
  fecha_pago: string | null;
  notas: string | null;
  created_at: string;
  revendedores?: Revendedor;
  ventas?: Venta;
}

export interface Conciliacion {
  id: string;
  mercancia_id: string;
  stock_sistema: number;
  stock_fisico: number;
  diferencia: number;
  revendedor_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  mercancia?: Mercancia;
  revendedores?: Revendedor;
}

export interface FacturaItem {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Factura {
  id: string;
  numero: string;
  cliente_id: string | null;
  items: FacturaItem[];
  subtotal: number;
  descuento: number;
  itbis: number;
  total: number;
  estado: EstadoFactura;
  tipo_comprobante: string;
  ncf: string | null;
  rnc_emisor: string;
  razon_social_emisor: string;
  direccion_emisor: string;
  telefono_emisor: string;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  clientes?: Cliente;
}

export interface LibroDiario {
  id: string;
  fecha: string | null;
  tipo: TipoMovimiento;
  categoria: string;
  descripcion: string;
  monto: number;
  referencia: string | null;
  metodo_pago: string | null;
  recibido_en: string | null;
  registrado_por: string | null;
  origen_id: string | null;
  origen_tipo: string | null;
  created_at: string;
  profiles?: { nombre: string; apellido: string } | null;
}

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  equipo: Equipo;
  asignado_a: string | null;
  cliente_id: string | null;
  prioridad: Prioridad;
  completada: boolean;
  fecha_limite: string | null;
  created_by: string | null;
  creado_por: string | null;
  referencia_id: string | null;
  referencia_tipo: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  clientes?: { nombre: string; apellido: string } | null;
}

export interface ActivityLog {
  id: string;
  usuario_id: string | null;
  usuario_nombre: string | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  detalles: Record<string, unknown> | null;
  detalle: string | null;
  created_at: string;
  profiles?: Profile;
}
