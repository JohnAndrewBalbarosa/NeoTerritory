import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { logEvent } from '../services/logService';
import { mirrorRow } from '../services/supabaseLogger';
import { sanitizeFilename, uniqueFilename } from '../utils/fileUtils';

const allowedExt = ['.cpp', '.cc', '.cxx', '.rs'];
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const outputsDir = path.join(__dirname, '..', '..', 'outputs');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

export const transform = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!allowedExt.includes(ext)) {
      res.status(400).json({ error: 'Invalid file type' });
      return;
    }
    // Sanitize and ensure unique filenames
    const safeInput = uniqueFilename(uploadsDir, sanitizeFilename(req.file.originalname));
    const inputPath = path.join(uploadsDir, safeInput);
    fs.renameSync(req.file.path, inputPath);

    // Output placeholder
    const outputName = uniqueFilename(outputsDir, safeInput.replace(ext, '.out'));
    const outputPath = path.join(outputsDir, outputName);
    fs.writeFileSync(outputPath, '// Transformation output placeholder\n');

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Insert job
    const stmt = db.prepare("INSERT INTO jobs (user_id, input_file_path, output_file_path, job_status, created_at) VALUES (?, ?, ?, ?, datetime('now'))");
    const info = stmt.run(req.user.id, inputPath, outputPath, 'completed_placeholder');
    const jobId = Number(info.lastInsertRowid);
    logEvent(req.user.id, 'upload', `Uploaded file: ${inputPath}`);
    logEvent(req.user.id, 'transform', `Transformation placeholder created: ${outputPath}`);
    mirrorRow('jobs', {
      id: jobId, user_id: req.user.id,
      input_file_path: inputPath, output_file_path: outputPath,
      job_status: 'completed_placeholder',
      created_at: new Date().toISOString(),
    });

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
