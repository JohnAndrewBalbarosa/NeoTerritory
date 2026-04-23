const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sanitizeFilename } = require('../utils/fileUtils');

const allowedExt = ['.cpp', '.cc', '.cxx', '.rs'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const safe = sanitizeFilename(file.originalname);
    cb(null, Date.now() + '-' + safe);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.includes(ext)) {
    return cb(new Error('Invalid file type'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});

module.exports = { upload };
