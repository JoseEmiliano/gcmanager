const { Router } = require('express');
const {
  getProveedores,
  createProveedor,
  registrarCompra,
} = require('./proveedores.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/', getProveedores);
router.post('/', createProveedor);
router.post('/compras', registrarCompra);

module.exports = router;
