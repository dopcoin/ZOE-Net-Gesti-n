'use client';

import type { Factura, FacturaItem, Cliente } from '@/types';
import { Download, Printer } from 'lucide-react';
import { useState } from 'react';

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

const TIPO_LABEL: Record<string, string> = {
  B01: 'Crédito Fiscal',
  B02: 'Consumo',
  B11: 'Proveedor Informal',
  B14: 'Régimen Especial',
  B15: 'Gubernamental',
  B16: 'Exportaciones',
  E31: 'e-CF Crédito Fiscal',
  E32: 'e-CF Consumo',
};

interface Props {
  factura: Factura & { clientes?: Cliente | null };
}

export default function FacturaViewClient({ factura }: Props) {
  const [downloading, setDownloading] = useState(false);

  const items: FacturaItem[] = Array.isArray(factura.items) && factura.items.length > 0
    ? factura.items
    : [{ descripcion: 'Servicio', cantidad: 1, precio_unitario: factura.total, subtotal: factura.total }];

  const subtotal = factura.subtotal ?? items.reduce((s, i) => s + (i.cantidad * i.precio_unitario), 0);
  const descuento = factura.descuento ?? 0;
  const itbisPct = factura.itbis ?? 18;
  const itbisAmount = (subtotal - descuento) * (itbisPct / 100);
  const total = factura.total ?? (subtotal - descuento + itbisAmount);

  const c = factura.clientes;
  const esEmpresa = c?.tipo_cliente === 'empresa';
  const clienteNombre = esEmpresa && c?.razon_social ? c.razon_social : c ? `${c.nombre} ${c.apellido}` : 'Cliente final';
  const tipoLabel = TIPO_LABEL[factura.tipo_comprobante] || factura.tipo_comprobante;

  async function descargarPDF() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/facturas/${factura.id}/pdf`);
      if (!res.ok) throw new Error('No se pudo generar el PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${factura.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al descargar';
      alert(msg);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 print:bg-white print:p-0">
      {/* Action bar — oculto en print */}
      <div className="max-w-3xl mx-auto mb-4 flex flex-wrap gap-2 justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          <Printer size={16} /> Imprimir
        </button>
        <button
          onClick={descargarPDF}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-60"
        >
          <Download size={16} /> {downloading ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>

      {/* Factura */}
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 print:border-0 print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="px-6 sm:px-10 pt-8 pb-6 border-b-2 border-blue-700 flex flex-col sm:flex-row gap-6 justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-blue-700 rounded-md flex items-center justify-center text-white font-bold text-2xl">
              Z
            </div>
            <div className="text-sm leading-tight">
              <p className="text-lg font-bold text-gray-900">{factura.razon_social_emisor}</p>
              <p className="text-gray-600">RNC: {factura.rnc_emisor}</p>
              <p className="text-gray-600">{factura.direccion_emisor}</p>
              <p className="text-gray-600">Tel: {factura.telefono_emisor}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-bold text-blue-700">FACTURA {factura.numero}</p>
            <p className="text-xs text-gray-500 mt-0.5">{factura.tipo_comprobante} — {tipoLabel}</p>
            {factura.ncf && (
              <div className="mt-2 inline-block px-3 py-1.5 bg-blue-50 border border-blue-700 rounded">
                <p className="text-blue-700 font-mono font-bold text-sm">NCF: {factura.ncf}</p>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">Fecha: {fmtFecha(factura.created_at)}</p>
            <p className="text-xs text-gray-500">Estado: <span className="uppercase font-medium">{factura.estado}</span></p>
          </div>
        </div>

        {/* Cliente + Detalle */}
        <div className="px-6 sm:px-10 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cliente</p>
            <p className="font-bold text-gray-900">{clienteNombre}</p>
            {c?.rnc && <p className="text-sm text-gray-700 mt-1">RNC: {c.rnc}</p>}
            {c?.cedula && !esEmpresa && <p className="text-sm text-gray-700 mt-1">Cédula: {c.cedula}</p>}
            {c?.direccion && <p className="text-sm text-gray-700 mt-1">{c.direccion}</p>}
            {c?.telefono && <p className="text-sm text-gray-700 mt-1">Tel: {c.telefono}</p>}
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Detalles del Comprobante</p>
            <p className="text-sm text-gray-700">Número: <span className="font-bold text-gray-900">{factura.numero}</span></p>
            <p className="text-sm text-gray-700 mt-1">Tipo: {factura.tipo_comprobante} — {tipoLabel}</p>
            {factura.ncf && <p className="text-sm text-gray-700 mt-1">NCF: <span className="font-mono font-bold">{factura.ncf}</span></p>}
            <p className="text-sm text-gray-700 mt-1">Emisión: {fmtFecha(factura.created_at)}</p>
            <p className="text-sm text-gray-700 mt-1">Estado: <span className="capitalize">{factura.estado}</span></p>
          </div>
        </div>

        {/* Items */}
        <div className="px-6 sm:px-10 pb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th className="text-left px-3 py-2 font-medium">Descripción</th>
                <th className="text-right px-3 py-2 font-medium w-16">Cant.</th>
                <th className="text-right px-3 py-2 font-medium w-24">Precio</th>
                <th className="text-right px-3 py-2 font-medium w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="px-3 py-2 text-gray-800">{item.descripcion || '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{item.cantidad}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmtRD(item.precio_unitario)}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtRD(item.cantidad * item.precio_unitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="px-6 sm:px-10 pb-6 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>{fmtRD(subtotal)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Descuento</span>
                <span>- {fmtRD(descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-700">
              <span>ITBIS ({itbisPct}%)</span>
              <span>{fmtRD(itbisAmount)}</span>
            </div>
            <div className="flex justify-between bg-blue-700 text-white font-bold text-base mt-3 px-3 py-2 rounded">
              <span>TOTAL</span>
              <span>{fmtRD(total)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        {factura.notas && (
          <div className="mx-6 sm:mx-10 mb-6 p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-900 text-sm rounded">
            <p className="font-bold mb-1">Notas:</p>
            <p>{factura.notas}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 sm:px-10 py-4 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>{factura.razon_social_emisor} · RNC {factura.rnc_emisor} · {factura.direccion_emisor} · Tel {factura.telefono_emisor}</p>
          <p className="mt-1">Gracias por su preferencia.</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
