const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');

const { errorHandler } = require('./src/middleware/errorHandler');
const { initDb } = require('./src/db/initDb');

const healthRoutes = require('./src/routes/health');
const authRoutes = require('./src/routes/auth');
const transformRoutes = require('./src/routes/transform');
const analysisRoutes = require('./src/routes/analysis');

const app = express();
const frontendDir = path.join(__dirname, '..', 'Frontend');
const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');

// Ensure uploads/ and outputs/ exist
[
  uploadsDir,
  outputsDir
].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));

// Static frontend
app.use(express.static(frontendDir));

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/api/transform', transformRoutes);
app.use('/api', analysisRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    service: 'NeoTerritory analysis backend',
    status: 'ok',
    frontend: '/',
    endpoints: [
      '/api/health',
      '/api/analyze',
      '/api/runs',
      '/api/runs/:id',
      '/api/runs/:id/export'
    ]
  });
});

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Error handler
app.use(errorHandler);

// DB init
initDb();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
