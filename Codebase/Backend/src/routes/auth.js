const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
// TEST SEED — REMOVE FOR PRODUCTION
const { listTestAccounts } = require('../db/_testSeed/devconUsers');

router.post('/register', register);
router.post('/login', login);

// TEST SEED — REMOVE FOR PRODUCTION
router.get('/test-accounts', (req, res) => {
  const accounts = listTestAccounts();
  res.json({ accounts, password: accounts.length ? 'devcon' : null });
});

module.exports = router;
