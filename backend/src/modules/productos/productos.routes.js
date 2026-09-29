const { Router } = require('express');
const {
  getProductos,
  getProductoByBarcode,
  createProducto,
  updateProducto,
  deleteProducto,
  adjustStock,
} = require('./productos.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/', getProductos);
router.get('/barcode/:code', getProductoByBarcode);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);
router.post('/:id/stock', adjustStock);

module.exports = router;
