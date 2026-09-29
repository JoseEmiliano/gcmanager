const db = require('../../config/db');

async function getClientes(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { search, con_deuda } = req.query;

    let queryText = `SELECT * FROM clientes WHERE tenant_id = $1 AND activo = true`;
    const params = [tenantId];

    if (search) {
      params.push(`%${search.trim()}%`);
      queryText += ` AND (nombre ILIKE $${params.length} OR documento ILIKE $${params.length} OR telefono ILIKE $${params.length})`;
    }

    if (con_deuda === 'true') {
      queryText += ` AND saldo_actual > 0`;
    }

    queryText += ` ORDER BY nombre ASC`;

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function createCliente(req, res) {
  try {
    const tenantId = req.tenant.id;
    const {
      nombre,
      tipo_documento = 'DNI',
      documento,
      condicion_iva = 'Consumidor Final',
      telefono,
      direccion,
      limite_credito = 20000.0,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'El nombre es obligatorio.' });
    }

    const result = await db.query(
      `INSERT INTO clientes (
        tenant_id, nombre, tipo_documento, documento, condicion_iva, telefono, direccion, limite_credito
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [tenantId, nombre.trim(), tipo_documento, documento || null, condicion_iva, telefono || null, direccion || null, limite_credito]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function updateCliente(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { nombre, tipo_documento, documento, condicion_iva, telefono, direccion, limite_credito } = req.body;

    const result = await db.query(
      `UPDATE clientes SET
        nombre = COALESCE($1, nombre),
        tipo_documento = COALESCE($2, tipo_documento),
        documento = COALESCE($3, documento),
        condicion_iva = COALESCE($4, condicion_iva),
        telefono = COALESCE($5, telefono),
        direccion = COALESCE($6, direccion),
        limite_credito = COALESCE($7, limite_credito)
       WHERE id = $8 AND tenant_id = $9
       RETURNING *`,
      [nombre, tipo_documento, documento, condicion_iva, telefono, direccion, limite_credito, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Cliente no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function registrarPagoFiado(req, res) {
  const client = await db.pool.connect();
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params; // cliente_id
    const { monto, metodo_pago = 'EFECTIVO', descripcion } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Monto de pago inválido.' });
    }

    await client.query('BEGIN');

    const cliRes = await client.query(
      `SELECT * FROM clientes WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [id, tenantId]
    );

    if (cliRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Cliente no encontrado.' });
    }

    const cliente = cliRes.rows[0];
    const saldoActual = parseFloat(cliente.saldo_actual || 0);
    const montoPago = parseFloat(monto);
    const nuevoSaldo = Math.max(0, saldoActual - montoPago);

    // Registrar movimiento de cobro de fiado
    await client.query(
      `INSERT INTO cliente_movimientos_cuenta (
        tenant_id, cliente_id, tipo, monto, saldo_resultante, descripcion
      ) VALUES ($1, $2, 'PAGO', $3, $4, $5)`,
      [
        tenantId,
        id,
        montoPago,
        nuevoSaldo,
        descripcion || `Cobro de fiado en ${metodo_pago}`,
      ]
    );

    // Actualizar saldo del cliente
    const updatedCli = await client.query(
      `UPDATE clientes SET saldo_actual = $1 WHERE id = $2 RETURNING *`,
      [nuevoSaldo, id]
    );

    // Si pagó en efectivo y hay turno abierto, ingresa dinero a caja
    if (metodo_pago === 'EFECTIVO') {
      await client.query(
        `UPDATE turnos_caja 
         SET total_ingresos = total_ingresos + $1 
         WHERE tenant_id = $2 AND estado = 'abierto'`,
        [montoPago, tenantId]
      );
    }

    await client.query('COMMIT');

    res.json({
      cliente: updatedCli.rows[0],
      montoAbonado: montoPago,
      saldoAnterior: saldoActual,
      nuevoSaldo,
      mensaje: 'Cobro de fiado asentado correctamente.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  } finally {
    client.release();
  }
}

async function getMovimientosCliente(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM cliente_movimientos_cuenta 
       WHERE cliente_id = $1 AND tenant_id = $2 
       ORDER BY created_at DESC LIMIT 50`,
      [id, tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

module.exports = {
  getClientes,
  createCliente,
  updateCliente,
  registrarPagoFiado,
  getMovimientosCliente,
};
