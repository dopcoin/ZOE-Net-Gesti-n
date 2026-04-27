// Datos fiscales del emisor (ZoeNet / DopCoin) que aparecen en facturas y
// otros comprobantes. Se usan también como defaults en el schema de
// `facturas` (rnc_emisor, razon_social_emisor, direccion_emisor,
// telefono_emisor) — ver supabase/migrations/0002_factura_ncf.sql.
//
// Si la empresa cambia algún dato, actualizar aquí y crear una migración
// que cambie el DEFAULT de la columna. Las facturas históricas conservan
// los valores que tenían al momento de emitirse.

export const EMPRESA = {
  razonSocial: 'ZoeNet (DopCoin)',
  rnc: '131718264',
  direccion: 'Dr Ferrys #168, La Romana',
  telefono: '849-340-4919',
} as const;

// Tipos de comprobante DGII (NCF). Lista alineada con el constraint
// facturas_tipo_comprobante_check.
export const TIPOS_COMPROBANTE = [
  { codigo: 'B01', label: 'B01 — Crédito Fiscal', descripcion: 'Para empresas con RNC. Permite deducción de ITBIS.' },
  { codigo: 'B02', label: 'B02 — Consumo', descripcion: 'Para personas físicas / consumidor final.' },
  { codigo: 'B11', label: 'B11 — Proveedor Informal', descripcion: '' },
  { codigo: 'B14', label: 'B14 — Régimen Especial', descripcion: '' },
  { codigo: 'B15', label: 'B15 — Gubernamental', descripcion: '' },
  { codigo: 'B16', label: 'B16 — Exportaciones', descripcion: '' },
  { codigo: 'E31', label: 'E31 — e-CF Crédito Fiscal', descripcion: '' },
  { codigo: 'E32', label: 'E32 — e-CF Consumo', descripcion: '' },
] as const;

export type TipoComprobante = typeof TIPOS_COMPROBANTE[number]['codigo'];

// Regex que coincide con el constraint facturas_ncf_format_check.
// B/E + 2 dígitos (tipo) + 8 a 10 dígitos (secuencia).
export const NCF_REGEX = /^[BE]\d{2}\d{8,10}$/;

export function tipoComprobanteRecomendado(tipoCliente: 'persona' | 'empresa'): TipoComprobante {
  return tipoCliente === 'empresa' ? 'B01' : 'B02';
}
