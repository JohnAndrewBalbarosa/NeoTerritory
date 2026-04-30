import path from 'path';
import fs from 'fs';

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function uniqueFilename(dir: string, filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  const ext = path.extname(filename);
  let candidate = sanitizeFilename(base) + ext;
  let counter = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${sanitizeFilename(base)}_${counter}${ext}`;
    counter++;
  }
  return candidate;
}

export { sanitizeFilename, uniqueFilename };
