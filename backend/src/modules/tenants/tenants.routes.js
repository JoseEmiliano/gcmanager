const { Router } = require('express');
const { listTenants, getCurrentTenant } = require('./tenants.controller');

const router = Router();

router.get('/', listTenants);
router.get('/current', getCurrentTenant);

module.exports = router;
