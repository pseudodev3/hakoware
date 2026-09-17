const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = Number(process.env.PORT) || 5001;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is required');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is required');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-token']
}));
app.use(express.json({ limit: '1mb' }));

const uploadDir = process.env.UPLOAD_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.locals.uploadDir = uploadDir;

app.use('/api/auth', require('./routes/auth'));
app.use('/api/friendships', require('./routes/friendships'));
app.use('/api/voice-notes', require('./routes/voiceNotes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/aura', require('./routes/aura'));
app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/bankruptcy', require('./routes/bankruptcy'));
app.use('/api/bounties', require('./routes/bounties'));
app.use('/api/users', require('./routes/users'));

app.use('/uploads', express.static(uploadDir));

app.get('/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'healthy' : 'starting',
    database: connected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime())
  });
});

app.get('/', (req, res) => {
  res.json({ service: 'hakoware-api', status: 'ok' });
});

app.use((err, req, res, next) => {
  if (err?.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ msg: 'Origin not allowed' });
  }
  console.error(err);
  return res.status(500).json({ msg: 'Server error' });
});

let server;

async function start() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Hakoware API listening on port ${PORT}`);
    console.log(`📁 Upload storage: ${uploadDir}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  console.error('❌ Failed to start Hakoware API:', error);
  process.exit(1);
});
