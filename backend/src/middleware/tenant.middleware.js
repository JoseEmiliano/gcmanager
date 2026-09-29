const db = require('../config/db');

// Cache simple en memoria para evitar consultas constantes a DB
const tenantCache = new Map();

async function resolveTenant(req, res, next) {
  try {
    let subdomain = null;

    // 1. Header prioritario (ideal para SPAs y testing de APIs)
    if (req.headers['x-tenant-subdomain']) {
      subdomain = req.headers['x-tenant-subdomain'].toString().trim().toLowerCase();
    }

    // 2. Query param (útil para pruebas en navegador o Postman)
    if (!subdomain && req.query.tenant) {
      subdomain = req.query.tenant.toString().trim().toLowerCase();
    }

    // 3. Extracción de subdominio por Host (ej: "kiosco-central.gcmanager.com" o "kiosco-central.localhost")
    if (!subdomain && req.headers.host) {
      const host = req.headers.host.split(':')[0]; // remueve puerto
      const parts = host.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1] === 'localhost')) {
        const subCandidate = parts[0].toLowerCase();
        if (subCandidate !== 'www' && subCandidate !== 'api' && subCandidate !== 'app') {
          subdomain = subCandidate;
        }
      }
    }

    // 4. Fallback por defecto para entorno local de pruebas
    if (!subdomain) {
      subdomain = process.env.DEFAULT_TENANT || 'kiosco-central';
    }

    // Verificar en caché
    let tenant = tenantCache.get(subdomain);
    if (!tenant) {
      const result = await db.query(
        `SELECT id, subdomain, nombre_fantasia, razon_social, cuit, condicion_iva, direccion, telefono, plan, activo 
         FROM tenants 
         WHERE subdomain = $1 LIMIT 1`,
        [subdomain]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'TENANT_NOT_FOUND',
          message: `El comercio con subdominio '${subdomain}' no está registrado o no existe.`,
        });
      }

      tenant = result.rows[0];
      if (!tenant.activo) {
        return res.status(403).json({
          error: 'TENANT_SUSPENDED',
          message: 'La suscripción del comercio se encuentra suspendida.',
        });
      }

      // Guardar en caché 5 minutos
      tenantCache.set(subdomain, tenant);
      setTimeout(() => tenantCache.delete(subdomain), 5 * 60 * 1000);
    }

    // Adjuntar tenant resuelto a la petición
    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('[Tenant Middleware Error]', error);
    res.status(500).json({ error: 'TENANT_RESOLUTION_ERROR', message: error.message });
  }
}

module.exports = {
  resolveTenant,
};
