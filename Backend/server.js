require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { errorHandler } = require('./src/middleware/errorHandler');
const { initDb } = require('./src/db/initDb');

const healthRoutes = require('./src/routes/health');
const authRoutes = require('./src/routes/auth');
const transformRoutes = require('./src/routes/transform');

const app = express();

// Ensure uploads/ and outputs/ exist
['uploads', 'outputs'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
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

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/api/transform', transformRoutes);

// Error handler
app.use(errorHandler);

// DB init
initDb();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
