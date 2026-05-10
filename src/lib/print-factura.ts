/**
 * Generador de facturas/recibos imprimibles para Instalaciones.
 *
 * Usa window.print() — funciona en todos los navegadores.
 * El usuario puede:
 *  - Imprimir directamente (Ctrl+P)
 *  - Guardar como PDF (destination: "Save as PDF" en el diálogo de impresión)
 *  - Enviar al cliente por WhatsApp/Email
 *
 * Sin dependencias externas.
 */

interface InstalacionPrintData {
  id: string;
  tipo: string;
  direccion: string;
  prioridad: string;
  estado: string;
  fecha_programada: string | null;
  costo?: number;
  estado_cobro?: string;
  descripcion_cobro?: string | null;
  metodo_pago?: string | null;
  recibido_en?: string | null;
  notas?: string | null;
  tecnico_asignado?: string | null;
  created_at?: string;
}

interface ClientePrintData {
  nombre: string;
  apellido: string;
  telefono?: string | null;
  email?: string | null;
  cedula?: string | null;
  direccion?: string | null;
  localidad?: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getEstadoCobroLabel(estado: string | undefined): { label: string; color: string } {
  switch (estado) {
    case 'pagado': return { label: 'PAGADO', color: '#10B981' };
    case 'pendiente': return { label: 'PENDIENTE DE PAGO', color: '#F59E0B' };
    case 'sin_costo': return { label: 'SIN COSTO', color: '#6B7280' };
    default: return { label: estado?.toUpperCase() ?? '—', color: '#6B7280' };
  }
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    nueva: 'Instalación nueva',
    mantenimiento: 'Mantenimiento',
    actualizacion: 'Actualización',
    desconexion: 'Desconexión',
    revision: 'Revisión',
  };
  return labels[tipo] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

function generateNumeroFactura(id: string, fecha?: string): string {
  // Generamos un número legible a partir del UUID + fecha
  const short = id.replace(/-/g, '').substring(0, 6).toUpperCase();
  const year = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear();
  return `INST-${year}-${short}`;
}

export function printInstalacionFactura(params: {
  instalacion: InstalacionPrintData;
  cliente: ClientePrintData;
}): void {
  const { instalacion, cliente } = params;
  const estadoInfo = getEstadoCobroLabel(instalacion.estado_cobro);
  const numero = generateNumeroFactura(instalacion.id, instalacion.created_at);
  const fechaEmision = formatDate(instalacion.created_at ?? new Date().toISOString());
  const fechaServicio = formatDate(instalacion.fecha_programada);
  const costo = instalacion.costo ?? 0;
  const isPagado = instalacion.estado_cobro === 'pagado';
  const isSinCosto = instalacion.estado_cobro === 'sin_costo' || costo === 0;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura ${numero} — ZOE Net Internet</title>
<style>
  @page {
    size: A4;
    margin: 1.5cm;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #111827;
    background: #fff;
    line-height: 1.5;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px;
  }

  /* HEADER con marca ZOE */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 3px solid #3B82F6;
    margin-bottom: 24px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-logo {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 28px;
    font-weight: 800;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  .brand-text {
    line-height: 1.2;
  }
  .brand-name {
    font-size: 22px;
    font-weight: 800;
    color: #1E40AF;
    letter-spacing: -0.5px;
  }
  .brand-tag {
    font-size: 11px;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-top: 2px;
  }
  .doc-meta {
    text-align: right;
  }
  .doc-title {
    font-size: 24px;
    font-weight: 800;
    color: #111827;
    margin-bottom: 4px;
  }
  .doc-numero {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    color: #6B7280;
    font-weight: 600;
  }
  .doc-fecha {
    font-size: 11px;
    color: #9CA3AF;
    margin-top: 4px;
  }

  /* DATOS */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
  .info-block {
    background: #F9FAFB;
    border-left: 3px solid #3B82F6;
    padding: 14px 16px;
    border-radius: 4px;
  }
  .info-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #6B7280;
    margin-bottom: 6px;
  }
  .info-value {
    font-size: 14px;
    color: #111827;
    font-weight: 500;
  }
  .info-value strong {
    font-weight: 700;
  }
  .info-sub {
    font-size: 11px;
    color: #6B7280;
    margin-top: 3px;
  }

  /* TABLA DE SERVICIO */
  .service-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  .service-table thead th {
    background: #1E40AF;
    color: white;
    padding: 12px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .service-table thead th:last-child {
    text-align: right;
  }
  .service-table tbody td {
    padding: 14px;
    border-bottom: 1px solid #E5E7EB;
    font-size: 13px;
  }
  .service-table tbody td:last-child {
    text-align: right;
    font-family: 'Courier New', monospace;
    font-weight: 600;
  }
  .service-desc {
    font-weight: 600;
    color: #111827;
  }
  .service-detail {
    font-size: 11px;
    color: #6B7280;
    margin-top: 4px;
  }

  /* TOTAL */
  .totals {
    margin-left: auto;
    width: 320px;
    margin-bottom: 24px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    font-size: 13px;
  }
  .total-row.grand {
    background: #1E40AF;
    color: white;
    border-radius: 6px;
    padding: 14px;
    margin-top: 8px;
    font-size: 16px;
    font-weight: 800;
  }
  .total-row .label {
    color: #4B5563;
  }
  .total-row .value {
    font-family: 'Courier New', monospace;
    font-weight: 700;
  }
  .total-row.grand .label,
  .total-row.grand .value {
    color: white;
  }

  /* ESTADO BADGE */
  .estado-banner {
    text-align: center;
    padding: 16px;
    border-radius: 8px;
    margin: 20px 0;
    font-weight: 800;
    font-size: 16px;
    letter-spacing: 2px;
    color: white;
    background: ${estadoInfo.color};
  }
  .estado-banner small {
    display: block;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1px;
    margin-top: 4px;
    opacity: 0.95;
  }

  /* PAYMENT INFO */
  .payment-box {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 20px;
  }
  .payment-box h3 {
    color: #92400E;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 8px;
  }
  .payment-box p {
    font-size: 13px;
    color: #78350F;
    line-height: 1.6;
  }
  .payment-box strong {
    font-weight: 700;
  }
  .payment-box .account {
    font-family: 'Courier New', monospace;
    background: white;
    padding: 6px 10px;
    border-radius: 4px;
    display: inline-block;
    margin-top: 4px;
    font-size: 14px;
    letter-spacing: 1px;
  }

  /* NOTAS */
  .notes-block {
    background: #F0F9FF;
    border-left: 3px solid #0EA5E9;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 20px;
  }
  .notes-block .info-label {
    color: #0369A1;
  }
  .notes-block .info-value {
    color: #0C4A6E;
    font-size: 12px;
    line-height: 1.6;
  }

  /* FOOTER */
  .footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid #E5E7EB;
    text-align: center;
    color: #9CA3AF;
    font-size: 11px;
    line-height: 1.6;
  }
  .footer .thanks {
    color: #1E40AF;
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 4px;
  }

  /* BOTONES — solo en pantalla, no en impresión */
  .actions {
    position: fixed;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 100;
  }
  .actions button {
    background: #3B82F6;
    color: white;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 14px;
  }
  .actions button:hover { background: #1D4ED8; }
  .actions button.secondary {
    background: white;
    color: #4B5563;
    border: 1px solid #D1D5DB;
  }
  .actions button.secondary:hover { background: #F9FAFB; }

  @media print {
    .actions { display: none !important; }
    body { background: white; }
    .container { padding: 0; max-width: 100%; }
  }
</style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
    <button class="secondary" onclick="window.close()">Cerrar</button>
  </div>

  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <div class="brand">
        <div class="brand-logo">Z</div>
        <div class="brand-text">
          <div class="brand-name">ZOE NET</div>
          <div class="brand-tag">Internet · República Dominicana</div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">FACTURA</div>
        <div class="doc-numero">${numero}</div>
        <div class="doc-fecha">Emitida: ${fechaEmision}</div>
      </div>
    </div>

    <!-- INFO CLIENTE Y SERVICIO -->
    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Cliente</div>
        <div class="info-value"><strong>${escapeHtml(cliente.nombre)} ${escapeHtml(cliente.apellido)}</strong></div>
        ${cliente.cedula ? `<div class="info-sub">Cédula: ${escapeHtml(cliente.cedula)}</div>` : ''}
        ${cliente.telefono ? `<div class="info-sub">Tel: ${escapeHtml(cliente.telefono)}</div>` : ''}
        ${cliente.email ? `<div class="info-sub">${escapeHtml(cliente.email)}</div>` : ''}
        ${cliente.localidad ? `<div class="info-sub">${escapeHtml(cliente.localidad)}</div>` : ''}
      </div>
      <div class="info-block">
        <div class="info-label">Dirección del servicio</div>
        <div class="info-value">${escapeHtml(instalacion.direccion)}</div>
        ${instalacion.tecnico_asignado ? `<div class="info-sub" style="margin-top:8px"><strong>Técnico:</strong> ${escapeHtml(instalacion.tecnico_asignado)}</div>` : ''}
        ${instalacion.fecha_programada ? `<div class="info-sub"><strong>Fecha programada:</strong> ${fechaServicio}</div>` : ''}
      </div>
    </div>

    <!-- TABLA DE SERVICIO -->
    <table class="service-table">
      <thead>
        <tr>
          <th>Descripción del servicio</th>
          <th style="width: 130px;">Monto</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="service-desc">${getTipoLabel(instalacion.tipo)}</div>
            ${instalacion.descripcion_cobro ? `<div class="service-detail">${escapeHtml(instalacion.descripcion_cobro)}</div>` : ''}
            <div class="service-detail">Prioridad: ${instalacion.prioridad}</div>
          </td>
          <td>${formatCurrency(costo)}</td>
        </tr>
      </tbody>
    </table>

    <!-- TOTALES -->
    <div class="totals">
      <div class="total-row">
        <span class="label">Subtotal</span>
        <span class="value">${formatCurrency(costo)}</span>
      </div>
      <div class="total-row grand">
        <span class="label">TOTAL</span>
        <span class="value">${formatCurrency(costo)}</span>
      </div>
    </div>

    <!-- ESTADO DE PAGO -->
    <div class="estado-banner">
      ${estadoInfo.label}
      ${isPagado && instalacion.metodo_pago ? `<small>Pagado vía ${escapeHtml(instalacion.metodo_pago)}${instalacion.recibido_en ? ` · Recibido por ${escapeHtml(instalacion.recibido_en)}` : ''}</small>` : ''}
      ${!isPagado && !isSinCosto ? `<small>Por favor, realiza el pago para activar el servicio</small>` : ''}
    </div>

    <!-- INFO DE PAGO si pendiente -->
    ${!isPagado && !isSinCosto ? `
    <div class="payment-box">
      <h3>💳 Datos para realizar el pago</h3>
      <p>
        <strong>Banco:</strong> Banreservas<br>
        <strong>Titular:</strong> Oscar Reyes<br>
        <strong>Cuenta de Ahorro:</strong> <span class="account">9601205756</span><br>
        <strong>Cuenta alternativa:</strong> <span class="account">02601381185</span>
      </p>
    </div>
    ` : ''}

    <!-- NOTAS -->
    ${instalacion.notas ? `
    <div class="notes-block">
      <div class="info-label">Notas</div>
      <div class="info-value">${escapeHtml(instalacion.notas).replace(/\n/g, '<br>')}</div>
    </div>
    ` : ''}

    <!-- FOOTER -->
    <div class="footer">
      <div class="thanks">¡Gracias por confiar en ZOE Net Internet!</div>
      <div>Para cualquier consulta, contáctanos al respaldo de esta factura.</div>
      <div style="margin-top: 8px;">Generado el ${new Date().toLocaleString('es-DO')} · ZOE Net Gestión v1.5</div>
    </div>
  </div>

  <script>
    // Auto-trigger print después de un breve delay (estilos cargados)
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    alert('No se pudo abrir la ventana de impresión. Verifica que el navegador permita pop-ups.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
