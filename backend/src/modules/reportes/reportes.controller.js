const db = require('../../config/db');

async function getDashboardSummary(req, res) {
  try {
    const tenantId = req.tenant.id;

    // 1. Métricas de Ventas de Hoy
    const ventasHoyRes = await db.query(
      `SELECT 
        COUNT(id) as total_operaciones,
        COALESCE(SUM(total), 0) as facturacion_total,
        COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total ELSE 0 END), 0) as efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago IN ('DEBITO', 'CREDITO') THEN total ELSE 0 END), 0) as tarjetas,
        COALESCE(SUM(CASE WHEN metodo_pago = 'QR_TRANSFERENCIA' THEN total ELSE 0 END), 0) as qr_transferencia,
        COALESCE(SUM(CASE WHEN metodo_pago = 'FIADO' THEN total ELSE 0 END), 0) as fiados
       FROM ventas 
       WHERE tenant_id = $1 AND created_at::date = CURRENT_DATE AND estado = 'COMPLETADA'`,
      [tenantId]
    );

    // 2. Total Deuda de Clientes (Fiados)
    const fiadosRes = await db.query(
      `SELECT COALESCE(SUM(saldo_actual), 0) as total_deuda, COUNT(id) as cant_clientes_deudores 
       FROM clientes WHERE tenant_id = $1 AND saldo_actual > 0 AND activo = true`,
      [tenantId]
    );

    // 3. Productos Bajo Stock Mínimo
    const bajoStockRes = await db.query(
      `SELECT COUNT(id) as total_bajo_stock 
       FROM productos WHERE tenant_id = $1 AND stock_actual <= stock_minimo AND activo = true`,
      [tenantId]
    );

    // 4. Top 5 Productos Más Vendidos
    const topProdRes = await db.query(
      `SELECT vi.descripcion, SUM(vi.cantidad) as total_unidades, SUM(vi.subtotal) as total_recaudado
       FROM venta_items vi
       JOIN ventas v ON vi.venta_id = v.id
       WHERE vi.tenant_id = $1 AND v.estado = 'COMPLETADA'
       GROUP BY vi.descripcion
       ORDER BY total_unidades DESC
       LIMIT 5`,
      [tenantId]
    );

    res.json({
      resumenHoy: ventasHoyRes.rows[0],
      fiados: fiadosRes.rows[0],
      stockAlerta: bajoStockRes.rows[0],
      topProductos: topProdRes.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function getComprobantesArca(req, res) {
  try {
    const tenantId = req.tenant.id;
    const result = await db.query(
      `SELECT ca.*, v.total, v.tipo_comprobante, v.created_at as fecha_venta
       FROM comprobantes_arca ca
       JOIN ventas v ON ca.venta_id = v.id
       WHERE ca.tenant_id = $1
       ORDER BY ca.created_at DESC LIMIT 100`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

module.exports = {
  getDashboardSummary,
  getComprobantesArca,
};
