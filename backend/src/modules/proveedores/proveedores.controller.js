const db = require('../../config/db');

async function getProveedores(req, res) {
  try {
    const tenantId = req.tenant.id;
    const result = await db.query(
      `SELECT * FROM proveedores WHERE tenant_id = $1 ORDER BY razon_social ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function createProveedor(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { razon_social, cuit, contacto, telefono, email, direccion } = req.body;

    if (!razon_social) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'La razón social es obligatoria.' });
    }

    const result = await db.query(
      `INSERT INTO proveedores (
        tenant_id, razon_social, cuit, contacto, telefono, email, direccion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [tenantId, razon_social.trim(), cuit || null, contacto || null, telefono || null, email || null, direccion || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function registrarCompra(req, res) {
  const client = await db.pool.connect();
  try {
    const tenantId = req.tenant.id;
    const { proveedor_id, numero_factura, observaciones, items } = req.body;
    // items: [{ producto_id, cantidad, costo_unitario }]

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Se requiere al menos un item para la compra.' });
    }

    await client.query('BEGIN');

    let total = 0;
    for (const it of items) {
      total += parseFloat(it.cantidad) * parseFloat(it.costo_unitario);
    }

    const compraRes = await client.query(
      `INSERT INTO compras (tenant_id, proveedor_id, numero_factura, total, observaciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, proveedor_id || null, numero_factura || null, total, observaciones || null]
    );
    const compra = compraRes.rows[0];

    for (const it of items) {
      const cant = parseFloat(it.cantidad);
      const costo = parseFloat(it.costo_unitario);
      const subtotal = cant * costo;

      await client.query(
        `INSERT INTO compra_items (tenant_id, compra_id, producto_id, cantidad, costo_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, compra.id, it.producto_id, cant, costo, subtotal]
      );

      // Ingreso directo a stock y actualización de costo
      await client.query(
        `UPDATE productos 
         SET stock_actual = stock_actual + $1, costo = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND tenant_id = $4`,
        [cant, costo, it.producto_id, tenantId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ compra, total, mensaje: 'Compra y recepción de stock asentada con éxito.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  } finally {
    client.release();
  }
}

module.exports = {
  getProveedores,
  createProveedor,
  registrarCompra,
};
