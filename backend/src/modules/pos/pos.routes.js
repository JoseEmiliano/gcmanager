const { Router } = require('express');
const { registrarVenta, getVentasHoy } = require('./pos.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.post('/venta', registrarVenta);
router.get('/ventas-hoy', getVentasHoy);

module.exports = router;
