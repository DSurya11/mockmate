import http from 'http';
import client from 'prom-client';
import logger from '../config/logger';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const workerMetrics = {
  activeJobs: new client.Gauge({
    name: 'worker_active_jobs',
    help: 'Active jobs per queue',
    labelNames: ['queue'],
    registers: [register],
  }),
  completedJobs: new client.Counter({
    name: 'worker_jobs_completed_total',
    help: 'Completed jobs per queue',
    labelNames: ['queue'],
    registers: [register],
  }),
  failedJobs: new client.Counter({
    name: 'worker_jobs_failed_total',
    help: 'Failed jobs per queue',
    labelNames: ['queue'],
    registers: [register],
  }),
};

export function startWorkerMetricsServer() {
  const port = parseInt(process.env.WORKER_METRICS_PORT || '9101', 10);
  const server = http.createServer(async (req, res) => {
    if (req.url !== '/metrics') {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Worker metrics server started');
  });
}
