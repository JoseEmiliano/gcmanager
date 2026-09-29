const { Router } = require('express');
const {
  getTurnoActivo,
  abrirTurno,
  cerrarTurno,
  registrarMovimiento,
} = require('./caja.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/turno-activo', getTurnoActivo);
router.post('/abrir', abrirTurno);
router.post('/cerrar', cerrarTurno);
router.post('/movimiento', registrarMovimiento);

module.exports = router;
