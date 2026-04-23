const express = require('express');
const router = express.Router();
const { jwtAuth } = require('../middleware/jwtAuth');
const { transform } = require('../controllers/transformController');
const { upload } = require('../middleware/upload');

router.post('/', jwtAuth, upload.single('file'), transform);

module.exports = router;
