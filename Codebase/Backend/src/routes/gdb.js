const express = require('express');
const { jwtAuth } = require('../middleware/jwtAuth');
const { enqueue, getJob, getQueueStatus } = require('../services/gdbService');

const router = express.Router();

router.post('/run', jwtAuth, (req, res) => {
  const { code, filename } = req.body || {};
  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'code is required' });
  }
  try {
    const { id, queuePosition } = enqueue({ sourceCode: code, filename: filename || 'prog.cpp' });
    res.status(202).json({ jobId: id, queuePosition });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/job/:id', jwtAuth, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  res.json(job);
});

router.get('/queue', jwtAuth, (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin only' });
  }
  res.json(getQueueStatus());
});

module.exports = router;
