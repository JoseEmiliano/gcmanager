const { Router } = require('express');
const {
  getClientes,
  createCliente,
  updateCliente,
  registrarPagoFiado,
  getMovimientosCliente,
} = require('./clientes.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/', getClientes);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.post('/:id/pago-fiado', registrarPagoFiado);
router.get('/:id/cuenta-corriente', getMovimientosCliente);

module.exports = router;
