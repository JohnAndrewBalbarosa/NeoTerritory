const path = require('path');
const fs = require('fs');

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function uniqueFilename(dir, filename) {
  let base = path.basename(filename, path.extname(filename));
  let ext = path.extname(filename);
  let candidate = sanitizeFilename(base) + ext;
  let counter = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${sanitizeFilename(base)}_${counter}${ext}`;
    counter++;
  }
  return candidate;
}

module.exports = { sanitizeFilename, uniqueFilename };
