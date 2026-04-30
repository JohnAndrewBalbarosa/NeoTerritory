const express = require('express');
const router = express.Router();
const { register, login, claimSeat } = require('../controllers/authController');
const { getJwks } = require('../utils/jwtKeys');
// TEST SEED — REMOVE FOR PRODUCTION
const { listTestAccounts } = require('../db/_testSeed/devconUsers');

router.post('/register', register);
router.post('/login', login);
// TEST SEED — REMOVE FOR PRODUCTION
router.post('/claim', claimSeat);

router.get('/jwks', (req, res) => {
  res.json(getJwks());
});

// TEST SEED — REMOVE FOR PRODUCTION
router.get('/test-accounts', (req, res) => {
  const accounts = listTestAccounts(); // [{ username, claimed }]
  res.json({ accounts, password: accounts.length ? 'devcon' : null });
});

module.exports = router;
