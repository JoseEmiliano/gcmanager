const { Router } = require('express');
const { getDashboardSummary, getComprobantesArca } = require('./reportes.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = Router();

router.use(requireAuth);

router.get('/dashboard', getDashboardSummary);
router.get('/comprobantes-arca', getComprobantesArca);

module.exports = router;
