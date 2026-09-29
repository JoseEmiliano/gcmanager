const db = require('../../config/db');

async function listTenants(req, res) {
  try {
    const result = await db.query(
      `SELECT id, subdomain, nombre_fantasia, razon_social, cuit, condicion_iva, plan, activo 
       FROM tenants 
       ORDER BY nombre_fantasia ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function getCurrentTenant(req, res) {
  res.json(req.tenant);
}

module.exports = {
  listTenants,
  getCurrentTenant,
};
