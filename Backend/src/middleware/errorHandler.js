const errorHandler = (err, req, res, next) => {
  if (err instanceof Error && err.message === 'Invalid file type') {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 2MB)' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
};

module.exports = { errorHandler };
