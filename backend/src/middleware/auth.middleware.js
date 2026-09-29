const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gcmanager_super_secret_jwt_key_2026';

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de sesión ausente o inválido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verificación de aislamiento de Tenant
    if (decoded.tenant_id && req.tenant && decoded.tenant_id !== req.tenant.id) {
      return res.status(403).json({
        error: 'TENANT_MISMATCH',
        message: 'No tienes autorización para acceder a los datos de este comercio.',
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Sesión expirada o token inválido.' });
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No posees permisos suficientes para realizar esta acción.',
      });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  JWT_SECRET,
};
