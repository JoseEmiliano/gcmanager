/**
 * Genera el formato de texto y estructura para impresión de tickets térmicos (58mm / 80mm)
 */
function formatTicketText({
  tenant,
  venta,
  items,
  usuario,
  cliente,
  arcaInfo = null,
}) {
  const lineSeparator = '------------------------------------------';
  const width = 42;

  const center = (text) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
  };

  const justify = (left, right) => {
    const space = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };

  let out = [];
  out.push(center(tenant.nombre_fantasia.toUpperCase()));
  out.push(center(tenant.razon_social));
  out.push(center(`CUIT: ${tenant.cuit}`));
  out.push(center(`IVA: ${tenant.condicion_iva}`));
  if (tenant.direccion) out.push(center(tenant.direccion));
  if (tenant.telefono) out.push(center(`Tel: ${tenant.telefono}`));
  out.push(lineSeparator);

  const fechaStr = new Date(venta.created_at || Date.now()).toLocaleString('es-AR');
  out.push(`Fecha: ${fechaStr}`);
  out.push(`Ticket Local Nro: #${String(venta.numero_ticket_local).padStart(6, '0')}`);
  out.push(`Cajero: ${usuario?.nombre || 'Caja'}`);
  
  if (cliente && cliente.nombre && cliente.nombre !== 'Consumidor Final') {
    out.push(`Cliente: ${cliente.nombre}`);
    if (cliente.documento) out.push(`Doc: ${cliente.tipo_documento || 'DNI'} ${cliente.documento}`);
  } else {
    out.push(`A Consumidor Final`);
  }
  out.push(lineSeparator);

  out.push(justify('CANT  DESCRIPCION', 'PRECIO    TOTAL'));
  out.push(lineSeparator);

  items.forEach((item) => {
    const cant = `${parseFloat(item.cantidad)}x`;
    const desc = item.descripcion.length > 20 ? item.descripcion.substring(0, 19) + '.' : item.descripcion;
    const precio = `$${parseFloat(item.precio_unitario).toFixed(2)}`;
    const sub = `$${parseFloat(item.subtotal).toFixed(2)}`;
    out.push(justify(`${cant.padEnd(5)} ${desc}`, `${precio.padStart(8)} ${sub.padStart(9)}`));
  });

  out.push(lineSeparator);
  out.push(justify('TOTAL:', `$${parseFloat(venta.total).toFixed(2)}`));
  out.push(justify('Forma de Pago:', venta.metodo_pago));

  if (venta.metodo_pago === 'EFECTIVO' && parseFloat(venta.paga_con) > 0) {
    out.push(justify('Paga con:', `$${parseFloat(venta.paga_con).toFixed(2)}`));
    out.push(justify('Vuelto:', `$${parseFloat(venta.vuelto).toFixed(2)}`));
  }

  if (venta.metodo_pago === 'FIADO' && cliente) {
    out.push(justify('Saldo Deuda Actual:', `$${parseFloat(cliente.saldo_actual).toFixed(2)}`));
  }

  // Datos Fiscales ARCA si aplica
  if (arcaInfo) {
    out.push(lineSeparator);
    out.push(center('*** COMPROBANTE FISCAL DIGITAL ARCA ***'));
    out.push(center(`${arcaInfo.tipoComprobanteNombre} Nro: ${arcaInfo.puntoVenta}-${arcaInfo.numeroCbte}`));
    out.push(center(`CAE: ${arcaInfo.cae}`));
    out.push(center(`Vto. CAE: ${arcaInfo.fechaVtoCae}`));
    out.push(center('Comprobante Autorizado por ARCA (ex-AFIP)'));
  }

  out.push(lineSeparator);
  out.push(center('¡Muchas gracias por su compra!'));
  out.push(center('GCManager Kiosco POS'));

  return out.join('\n');
}

module.exports = {
  formatTicketText,
};
