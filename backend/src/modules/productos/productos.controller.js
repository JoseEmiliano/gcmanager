const db = require('../../config/db');

async function getProductos(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { search, categoria_id, low_stock } = req.query;

    let queryText = `
      SELECT p.*, c.nombre AS categoria_nombre 
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.tenant_id = $1 AND p.activo = true
    `;
    const params = [tenantId];

    if (search) {
      params.push(`%${search.trim()}%`);
      queryText += ` AND (p.codigo_barra ILIKE $${params.length} OR p.codigo_interno ILIKE $${params.length} OR p.nombre ILIKE $${params.length})`;
    }

    if (categoria_id) {
      params.push(categoria_id);
      queryText += ` AND p.categoria_id = $${params.length}`;
    }

    if (low_stock === 'true') {
      queryText += ` AND p.stock_actual <= p.stock_minimo`;
    }

    queryText += ` ORDER BY p.nombre ASC`;

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('[Get Productos Error]', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function getProductoByBarcode(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { code } = req.params;

    const result = await db.query(
      `SELECT p.*, c.nombre AS categoria_nombre 
       FROM productos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.tenant_id = $1 AND (p.codigo_barra = $2 OR p.codigo_interno = $2) AND p.activo = true
       LIMIT 1`,
      [tenantId, code.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Producto no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function createProducto(req, res) {
  try {
    const tenantId = req.tenant.id;
    const {
      codigo_barra,
      codigo_interno,
      nombre,
      descripcion,
      costo,
      precio_venta,
      alicuota_iva = 21.0,
      es_cigarrillo = false,
      stock_actual = 0,
      stock_minimo = 5,
      categoria_id = null,
    } = req.body;

    if (!nombre || precio_venta === undefined) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Nombre y precio de venta son obligatorios.' });
    }

    const result = await db.query(
      `INSERT INTO productos (
        tenant_id, categoria_id, codigo_barra, codigo_interno, nombre, descripcion,
        costo, precio_venta, alicuota_iva, es_cigarrillo, stock_actual, stock_minimo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        tenantId,
        categoria_id || null,
        codigo_barra || null,
        codigo_interno || null,
        nombre.trim(),
        descripcion || null,
        costo || 0,
        precio_venta,
        alicuota_iva,
        !!es_cigarrillo,
        stock_actual,
        stock_minimo,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function updateProducto(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const {
      codigo_barra,
      codigo_interno,
      nombre,
      descripcion,
      costo,
      precio_venta,
      alicuota_iva,
      es_cigarrillo,
      stock_actual,
      stock_minimo,
      categoria_id,
    } = req.body;

    const result = await db.query(
      `UPDATE productos SET 
        codigo_barra = COALESCE($1, codigo_barra),
        codigo_interno = COALESCE($2, codigo_interno),
        nombre = COALESCE($3, nombre),
        descripcion = COALESCE($4, descripcion),
        costo = COALESCE($5, costo),
        precio_venta = COALESCE($6, precio_venta),
        alicuota_iva = COALESCE($7, alicuota_iva),
        es_cigarrillo = COALESCE($8, es_cigarrillo),
        stock_actual = COALESCE($9, stock_actual),
        stock_minimo = COALESCE($10, stock_minimo),
        categoria_id = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND tenant_id = $13
      RETURNING *`,
      [
        codigo_barra,
        codigo_interno,
        nombre,
        descripcion,
        costo,
        precio_venta,
        alicuota_iva,
        es_cigarrillo,
        stock_actual,
        stock_minimo,
        categoria_id || null,
        id,
        tenantId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Producto no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function deleteProducto(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const result = await db.query(
      `UPDATE productos SET activo = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Producto no encontrado.' });
    }

    res.json({ message: 'Producto eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function adjustStock(req, res) {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { delta, motivo } = req.body;

    if (delta === undefined) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Se requiere el delta de stock.' });
    }

    const result = await db.query(
      `UPDATE productos 
       SET stock_actual = stock_actual + $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND tenant_id = $3 
       RETURNING *`,
      [parseFloat(delta), id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Producto no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

module.exports = {
  getProductos,
  getProductoByBarcode,
  createProducto,
  updateProducto,
  deleteProducto,
  adjustStock,
};
