const { Router } = require('express');
const { login, me } = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = Router();

router.post('/login', login);
router.get('/me', requireAuth, me);

module.exports = router;
