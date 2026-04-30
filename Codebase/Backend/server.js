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
const adminRoutes = require('./src/routes/admin');
const reviewRoutes = require('./src/routes/reviews');
const { router: settingsRouter } = require('./src/routes/settings');
const gdbRoutes = require('./src/routes/gdb');
const { startWatching: startReviewSchemaWatch } = require('./src/reviews/questionLoader');

const app = express();
const frontendDir = path.join(__dirname, '..', 'Frontend');
// Centralized testing tree at repo root: ../../test/
// Per-user folders live directly inside (test/devcon1, test/devcon2, ...).
// _uploads/ holds multer temp files. Override with TEST_RESULTS_DIR.
const testRoot = process.env.TEST_RESULTS_DIR
  || path.join(__dirname, '..', '..', 'test');
const uploadsDir = path.join(testRoot, '_uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

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
app.use('/api/admin', adminRoutes);
app.use('/api/admin/settings', settingsRouter);
app.use('/api/gdb', gdbRoutes);
app.use('/api/reviews', reviewRoutes);
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

// Load review questionnaire and watch for edits
startReviewSchemaWatch();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
