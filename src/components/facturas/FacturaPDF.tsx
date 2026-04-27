// PDF de factura — render server-side con @react-pdf/renderer.
// Se usa desde /api/facturas/[id]/pdf y desde la vista pública.

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { Factura, FacturaItem, Cliente } from '@/types';

// Fuente sans-serif (no necesita registrar — Helvetica viene built-in)

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#1E40AF',
  },
  logoBox: {
    width: 48,
    height: 48,
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingTop: 8,
    borderRadius: 6,
    marginRight: 12,
  },
  emisorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emisorInfo: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  emisorNombre: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  comprobanteBlock: {
    alignItems: 'flex-end',
    minWidth: 200,
  },
  comprobanteTitulo: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1E40AF',
    marginBottom: 2,
  },
  comprobanteTipoLabel: {
    fontSize: 8,
    color: '#6B7280',
  },
  ncfBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#1E40AF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    borderRadius: 4,
  },
  ncfText: {
    fontFamily: 'Courier-Bold',
    fontSize: 11,
    color: '#1E40AF',
  },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  cardBlock: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 8,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  cardLine: {
    fontSize: 10,
    marginBottom: 2,
  },
  cardLineBold: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  table: {
    marginTop: 6,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    fontSize: 10,
  },
  colDesc: { flex: 4 },
  colCant: { flex: 1, textAlign: 'right' },
  colPrecio: { flex: 1.2, textAlign: 'right' },
  colSubtotal: { flex: 1.4, textAlign: 'right' },
  totalsBlock: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  totalsTable: {
    width: 240,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    fontSize: 10,
  },
  totalRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    marginTop: 4,
    borderRadius: 4,
  },
  notas: {
    marginTop: 14,
    padding: 8,
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    fontSize: 9,
    color: '#78350F',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 8,
    color: '#9CA3AF',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});

function fmtRD(n: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(n || 0);
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function tipoLabel(tipo: string): string {
  const map: Record<string, string> = {
    B01: 'Crédito Fiscal',
    B02: 'Consumo',
    B11: 'Proveedor Informal',
    B14: 'Régimen Especial',
    B15: 'Gubernamental',
    B16: 'Exportaciones',
    E31: 'e-CF Crédito Fiscal',
    E32: 'e-CF Consumo',
  };
  return map[tipo] || tipo;
}

interface Props {
  factura: Factura & { clientes?: Cliente | { nombre: string; apellido: string; rnc?: string | null; razon_social?: string | null; direccion?: string | null; telefono?: string | null; tipo_cliente?: string | null } };
}

export function FacturaPDF({ factura }: Props) {
  const items: FacturaItem[] = Array.isArray(factura.items) && factura.items.length > 0
    ? factura.items
    : [{ descripcion: 'Servicio', cantidad: 1, precio_unitario: factura.total, subtotal: factura.total }];

  const subtotal = factura.subtotal ?? items.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0);
  const descuento = factura.descuento ?? 0;
  const itbisPct = factura.itbis ?? 18;
  const itbisAmount = (subtotal - descuento) * (itbisPct / 100);
  const total = factura.total ?? (subtotal - descuento + itbisAmount);

  const c = factura.clientes;
  const esEmpresa = c && 'tipo_cliente' in c && c.tipo_cliente === 'empresa';
  const clienteNombre = esEmpresa && c && 'razon_social' in c && c.razon_social
    ? c.razon_social
    : c ? `${c.nombre} ${c.apellido}` : 'Cliente final';
  const clienteRnc = c && 'rnc' in c ? c.rnc : null;
  const clienteDireccion = c && 'direccion' in c ? c.direccion : null;
  const clienteTelefono = c && 'telefono' in c ? c.telefono : null;

  return (
    <Document
      title={`Factura ${factura.numero}`}
      author={factura.razon_social_emisor}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Encabezado: Emisor + Comprobante */}
        <View style={styles.header}>
          <View style={styles.emisorBlock}>
            <Text style={styles.logoBox}>Z</Text>
            <View style={styles.emisorInfo}>
              <Text style={styles.emisorNombre}>{factura.razon_social_emisor}</Text>
              <Text>RNC: {factura.rnc_emisor}</Text>
              <Text>{factura.direccion_emisor}</Text>
              <Text>Tel: {factura.telefono_emisor}</Text>
            </View>
          </View>
          <View style={styles.comprobanteBlock}>
            <Text style={styles.comprobanteTitulo}>FACTURA {factura.numero}</Text>
            <Text style={styles.comprobanteTipoLabel}>
              {factura.tipo_comprobante} — {tipoLabel(factura.tipo_comprobante)}
            </Text>
            {factura.ncf && (
              <View style={styles.ncfBox}>
                <Text style={styles.ncfText}>NCF: {factura.ncf}</Text>
              </View>
            )}
            <Text style={{ fontSize: 9, marginTop: 4, color: '#6B7280' }}>
              Fecha: {fmtFecha(factura.created_at)}
            </Text>
            <Text style={{ fontSize: 9, color: '#6B7280' }}>
              Estado: {factura.estado.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Cliente + Fechas */}
        <View style={styles.twoCol}>
          <View style={styles.cardBlock}>
            <Text style={styles.cardTitle}>Cliente</Text>
            <Text style={styles.cardLineBold}>{clienteNombre}</Text>
            {clienteRnc && <Text style={styles.cardLine}>RNC: {clienteRnc}</Text>}
            {clienteDireccion && <Text style={styles.cardLine}>{clienteDireccion}</Text>}
            {clienteTelefono && <Text style={styles.cardLine}>Tel: {clienteTelefono}</Text>}
            {!esEmpresa && c && 'cedula' in c && c.cedula && (
              <Text style={styles.cardLine}>Cédula: {c.cedula}</Text>
            )}
          </View>
          <View style={styles.cardBlock}>
            <Text style={styles.cardTitle}>Detalles del Comprobante</Text>
            <Text style={styles.cardLine}>Número: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{factura.numero}</Text></Text>
            <Text style={styles.cardLine}>Tipo: {factura.tipo_comprobante} — {tipoLabel(factura.tipo_comprobante)}</Text>
            {factura.ncf && <Text style={styles.cardLine}>NCF: <Text style={{ fontFamily: 'Courier-Bold' }}>{factura.ncf}</Text></Text>}
            <Text style={styles.cardLine}>Emisión: {fmtFecha(factura.created_at)}</Text>
            <Text style={styles.cardLine}>Estado: {factura.estado}</Text>
          </View>
        </View>

        {/* Tabla items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Descripción</Text>
            <Text style={styles.colCant}>Cant.</Text>
            <Text style={styles.colPrecio}>Precio</Text>
            <Text style={styles.colSubtotal}>Subtotal</Text>
          </View>
          {items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.descripcion || '—'}</Text>
              <Text style={styles.colCant}>{item.cantidad}</Text>
              <Text style={styles.colPrecio}>{fmtRD(item.precio_unitario)}</Text>
              <Text style={styles.colSubtotal}>{fmtRD(item.cantidad * item.precio_unitario)}</Text>
            </View>
          ))}
        </View>

        {/* Totales */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{fmtRD(subtotal)}</Text>
            </View>
            {descuento > 0 && (
              <View style={styles.totalRow}>
                <Text>Descuento</Text>
                <Text>- {fmtRD(descuento)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text>ITBIS ({itbisPct}%)</Text>
              <Text>{fmtRD(itbisAmount)}</Text>
            </View>
            <View style={styles.totalRowGrand}>
              <Text>TOTAL</Text>
              <Text>{fmtRD(total)}</Text>
            </View>
          </View>
        </View>

        {/* Notas */}
        {factura.notas && (
          <View style={styles.notas}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Notas:</Text>
            <Text>{factura.notas}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            {factura.razon_social_emisor} · RNC {factura.rnc_emisor} · {factura.direccion_emisor} · Tel {factura.telefono_emisor}
          </Text>
          <Text style={{ marginTop: 2 }}>Gracias por su preferencia.</Text>
        </View>
      </Page>
    </Document>
  );
}
