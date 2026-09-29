const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { JWT_SECRET } = require('../../middleware/auth.middleware');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const tenant = req.tenant;

    if (!email || !password) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email y contraseña requeridos.' });
    }

    // Buscar usuario en el contexto del tenant actual
    const userRes = await db.query(
      `SELECT id, tenant_id, nombre, email, password_hash, rol, activo 
       FROM usuarios 
       WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
      [tenant.id, email.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Credenciales inválidas para este comercio.',
      });
    }

    const user = userRes.rows[0];

    if (!user.activo) {
      return res.status(403).json({ error: 'USER_INACTIVE', message: 'El usuario se encuentra inactivo.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        tenant_id: tenant.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
      tenant: {
        id: tenant.id,
        subdomain: tenant.subdomain,
        nombre_fantasia: tenant.nombre_fantasia,
        cuit: tenant.cuit,
        condicion_iva: tenant.condicion_iva,
      },
    });
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: error.message });
  }
}

async function me(req, res) {
  res.json({
    user: req.user,
    tenant: req.tenant,
  });
}

module.exports = {
  login,
  me,
};
