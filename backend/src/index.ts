import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import client from 'prom-client';

import { config } from './config';
import logger from './config/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { setupSocketHandlers } from './socket/handler';

import authRoutes from './routes/auth';
import resumeRoutes from './routes/resume';
import interviewRoutes from './routes/interview';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';
import ttsRoutes from './routes/tts';
import transcriptionRoutes from './routes/transcription';

const app = express();
const server = http.createServer(app);

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const wsConnectionsGauge = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

// Socket.IO setup
const io = new SocketServer(server, {
  cors: {
    origin: config.frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Track WebSocket connections for metrics
io.on('connection', () => wsConnectionsGauge.inc());
io.on('connection', (socket) => {
  socket.on('disconnect', () => wsConnectionsGauge.dec());
});

setupSocketHandlers(io);

// Ensure upload directory exists
const uploadDir = path.resolve(config.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// Global middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Request duration tracking middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    end(labels);
    httpRequestTotal.inc(labels);
  });
  next();
});

// Rate limiting
app.use('/api', apiLimiter);

// Prometheus metrics endpoint (before auth, no rate limit)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/transcribe', transcriptionRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
server.listen(config.port, '0.0.0.0', () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

export { app, server, io };
