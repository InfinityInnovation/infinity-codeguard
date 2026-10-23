import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { SCAN_QUEUE, scanJobSchema } from './jobs.js';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL is required');
const logger = pino({ name: 'codeguard-worker', redact: ['*.token', '*.password', '*.secret'] });
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  SCAN_QUEUE,
  (job) => {
    const payload = scanJobSchema.parse(job.data);
    logger.info(
      { jobId: job.id, scanId: payload.scanId, organizationId: payload.organizationId },
      'Scan job received',
    );
    throw new Error('No scanners are enabled; scan execution is intentionally unavailable');
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2), lockDuration: 60_000 },
);

worker.on('failed', (job, error) =>
  logger.error({ jobId: job?.id, error: error.message }, 'Scan job failed'),
);
worker.on('error', (error) => logger.error({ error: error.message }, 'Worker error'));

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Worker shutting down');
  await worker.close();
  await connection.quit();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
