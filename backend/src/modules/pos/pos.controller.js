const db = require('../../config/db');
const arcaService = require('../arca/arca.service');
const { formatTicketText } = require('../../utils/ticketPrinter');

async function registrarVenta(req, res) {
  const client = await db.pool.connect();
  try {
    const tenant = req.tenant;
    const user = req.user;
    const {
      items,              // [{ producto_id, cantidad, precio_unitario, descripcion, alicuota_iva }]
      metodo_pago = 'EFECTIVO', // EFECTIVO, DEBITO, CREDITO, QR_TRANSFERENCIA, FIADO
      tipo_comprobante = 'TICKET_X', // TICKET_X, FACTURA_A, FACTURA_B, FACTURA_C
      cliente_id = null,
      paga_con = 0,
      descuento = 0,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'El carrito no contiene productos.' });
    }

    await client.query('BEGIN');

    // 1. Obtener turno activo
    const turnoRes = await client.query(
      `SELECT id FROM turnos_caja WHERE tenant_id = $1 AND estado = 'abierto' LIMIT 1`,
      [tenant.id]
    );

    let turnoId = null;
    if (turnoRes.rows.length > 0) {
      turnoId = turnoRes.rows[0].id;
    }

    // 2. Calcular montos
    let subtotal = 0;
    let totalIva = 0;
    for (const it of items) {
      const cant = parseFloat(it.cantidad || 1);
      const precio = parseFloat(it.precio_unitario);
      const alic = parseFloat(it.alicuota_iva || 21.0);
      const sub = cant * precio;
      subtotal += sub;
      totalIva += sub * (alic / 100);
    }

    const total = Math.max(0, subtotal - parseFloat(descuento || 0));
    const montoPagaCon = parseFloat(paga_con) || total;
    const vuelto = metodo_pago === 'EFECTIVO' ? Math.max(0, montoPagaCon - total) : 0;

    // 3. Manejo de Fiado / Cuenta Corriente
    let clienteData = null;
    if (cliente_id) {
      const cliRes = await client.query(
        `SELECT * FROM clientes WHERE id = $1 AND tenant_id = $2`,
        [cliente_id, tenant.id]
      );
      if (cliRes.rows.length > 0) {
        clienteData = cliRes.rows[0];
      }
    }

    if (metodo_pago === 'FIADO') {
      if (!clienteData) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'CLIENT_REQUIRED',
          message: 'Debe seleccionar un cliente con cuenta corriente para registrar una venta fiada.',
        });
      }

      const saldoActual = parseFloat(clienteData.saldo_actual || 0);
      const limite = parseFloat(clienteData.limite_credito || 0);
      if (limite > 0 && (saldoActual + total) > limite) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'CREDIT_LIMIT_EXCEEDED',
          message: `El cliente supera su límite de crédito autorizado ($${limite.toFixed(2)}). Deuda actual: $${saldoActual.toFixed(2)}.`,
        });
      }
    }

    // 4. Próximo número de ticket local del kiosco
    const nroTicketRes = await client.query(
      `SELECT COALESCE(MAX(numero_ticket_local), 0) + 1 AS proximo_ticket 
       FROM ventas WHERE tenant_id = $1`,
      [tenant.id]
    );
    const numeroTicketLocal = parseInt(nroTicketRes.rows[0].proximo_ticket, 10);

    // 5. Insertar cabecera de venta
    const ventaRes = await client.query(
      `INSERT INTO ventas (
        tenant_id, turno_caja_id, usuario_id, cliente_id, numero_ticket_local,
        tipo_comprobante, subtotal, descuento, iva, total, metodo_pago, paga_con, vuelto
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        tenant.id,
        turnoId,
        user.id,
        clienteData ? clienteData.id : null,
        numeroTicketLocal,
        tipo_comprobante,
        subtotal,
        descuento,
        totalIva,
        total,
        metodo_pago,
        montoPagaCon,
        vuelto,
      ]
    );
    const venta = ventaRes.rows[0];

    // 6. Insertar items y descontar stock
    for (const it of items) {
      await client.query(
        `INSERT INTO venta_items (
          tenant_id, venta_id, producto_id, codigo_barra, descripcion,
          cantidad, precio_unitario, alicuota_iva, subtotal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tenant.id,
          venta.id,
          it.producto_id,
          it.codigo_barra || null,
          it.descripcion,
          parseFloat(it.cantidad),
          parseFloat(it.precio_unitario),
          parseFloat(it.alicuota_iva || 21.0),
          parseFloat(it.cantidad) * parseFloat(it.precio_unitario),
        ]
      );

      // Descontar stock del producto
      await client.query(
        `UPDATE productos 
         SET stock_actual = stock_actual - $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = $3`,
        [parseFloat(it.cantidad), it.producto_id, tenant.id]
      );
    }

    // 7. Impactar en el turno de caja
    if (turnoId) {
      let columnaMonto = 'total_ventas_efectivo';
      if (metodo_pago === 'DEBITO' || metodo_pago === 'CREDITO') columnaMonto = 'total_ventas_debito';
      else if (metodo_pago === 'QR_TRANSFERENCIA') columnaMonto = 'total_ventas_qr';
      else if (metodo_pago === 'FIADO') columnaMonto = 'total_ventas_fiado';

      await client.query(
        `UPDATE turnos_caja SET ${columnaMonto} = ${columnaMonto} + $1 WHERE id = $2`,
        [total, turnoId]
      );
    }

    // 8. Impactar en la cuenta corriente del cliente (si fue fiado)
    if (metodo_pago === 'FIADO' && clienteData) {
      const nuevoSaldo = parseFloat(clienteData.saldo_actual || 0) + total;
      await client.query(
        `INSERT INTO cliente_movimientos_cuenta (
          tenant_id, cliente_id, tipo, monto, saldo_resultante, descripcion, referencia_id
        ) VALUES ($1, $2, 'CARGO_VENTA', $3, $4, $5, $6)`,
        [
          tenant.id,
          clienteData.id,
          total,
          nuevoSaldo,
          `Compra en mostrador Ticket #${numeroTicketLocal}`,
          venta.id,
        ]
      );

      await client.query(
        `UPDATE clientes SET saldo_actual = $1 WHERE id = $2`,
        [nuevoSaldo, clienteData.id]
      );
      clienteData.saldo_actual = nuevoSaldo;
    }

    await client.query('COMMIT');

    // 9. Facturación Electrónica ARCA (ex-AFIP)
    let arcaInfo = null;
    if (['FACTURA_A', 'FACTURA_B', 'FACTURA_C'].includes(tipo_comprobante)) {
      try {
        arcaInfo = await arcaService.emitirComprobante({
          tenant,
          ventaId: venta.id,
          tipoComprobante: tipo_comprobante,
          cliente: clienteData,
          importeTotal: total,
        });
      } catch (arcaErr) {
        console.error('[ARCA Billing Error]', arcaErr);
        // No se cancela la venta local, se marca para reintento o contingencia
      }
    }

    // 10. Generar texto de Ticket Térmico formateado
    const ticketText = formatTicketText({
      tenant,
      venta,
      items,
      usuario: user,
      cliente: clienteData,
      arcaInfo,
    });

    res.status(201).json({
      venta,
      items,
      arcaInfo,
      ticketText,
      cliente: clienteData,
      mensaje: 'Venta registrada con éxito',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Registrar Venta Error]', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  } finally {
    client.release();
  }
}

async function getVentasHoy(req, res) {
  try {
    const tenantId = req.tenant.id;
    const result = await db.query(
      `SELECT v.*, u.nombre as cajero_nombre, c.nombre as cliente_nombre,
              ca.cae, ca.numero_cbte as nro_arca
       FROM ventas v
       JOIN usuarios u ON v.usuario_id = u.id
       LEFT JOIN clientes c ON v.cliente_id = c.id
       LEFT JOIN comprobantes_arca ca ON ca.venta_id = v.id
       WHERE v.tenant_id = $1 AND v.created_at::date = CURRENT_DATE
       ORDER BY v.created_at DESC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

module.exports = {
  registrarVenta,
  getVentasHoy,
};
