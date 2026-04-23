const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { logEvent } = require('../services/logService');
const { sanitizeFilename, uniqueFilename } = require('../utils/fileUtils');

const allowedExt = ['.cpp', '.cc', '.cxx', '.rs'];

const transform = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!allowedExt.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }
    // Sanitize and ensure unique filenames
    const safeInput = uniqueFilename('uploads', sanitizeFilename(req.file.originalname));
    const inputPath = path.join('uploads', safeInput);
    fs.renameSync(req.file.path, inputPath);

    // Output placeholder
    const outputName = uniqueFilename('outputs', safeInput.replace(ext, '.out'));
    const outputPath = path.join('outputs', outputName);
    fs.writeFileSync(outputPath, '// Transformation output placeholder\n');

    // Insert job
    const stmt = db.prepare('INSERT INTO jobs (user_id, input_file_path, output_file_path, job_status, created_at) VALUES (?, ?, ?, ?, datetime("now"))');
    const info = stmt.run(req.user.id, inputPath, outputPath, 'completed_placeholder');
    logEvent(req.user.id, 'upload', `Uploaded file: ${inputPath}`);
    logEvent(req.user.id, 'transform', `Transformation placeholder created: ${outputPath}`);

    res.status(201).json({
      job_id: info.lastInsertRowid,
      input_file: inputPath,
      output_file: outputPath,
      status: 'completed_placeholder'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { transform };
