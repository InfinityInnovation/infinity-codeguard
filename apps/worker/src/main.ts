import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { database } from '@codeguard/database';
import { SCAN_QUEUE, scanJobSchema } from './jobs.js';
import { runSemgrepScan } from './semgrep.js';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL is required');
const logger = pino({ name: 'codeguard-worker', redact: ['*.token', '*.password', '*.secret'] });
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  SCAN_QUEUE,
  async (job) => {
    const payload = scanJobSchema.parse(job.data);
    logger.info(
      { jobId: job.id, scanId: payload.scanId, organizationId: payload.organizationId },
      'Scan job received',
    );
    const scan = await database.scan.findFirst({
      where: {
        id: payload.scanId,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        repositoryId: payload.repositoryId,
        status: 'QUEUED',
      },
      include: { repository: true },
    });
    if (!scan) throw new Error('Tenant-bound queued scan not found');
    await database.scan.update({
      where: { id: scan.id },
      data: { status: 'RUNNING', startedAt: new Date(), errorMessage: null },
    });
    try {
      const result = await runSemgrepScan(scan.repository.remoteUrl, scan.repository.defaultBranch);
      await database.$transaction(async (tx) => {
        if (result.findings.length) {
          await tx.finding.createMany({
            data: result.findings.map((finding) => ({
              ...finding,
              scanId: scan.id,
              organizationId: scan.organizationId,
              projectId: scan.projectId,
            })),
            skipDuplicates: true,
          });
        }
        await tx.scan.update({
          where: { id: scan.id },
          data: {
            status: 'SUCCEEDED',
            commitSha: result.commitSha,
            findingCount: result.findings.length,
            completedAt: new Date(),
          },
        });
      });
      logger.info({ scanId: scan.id, findingCount: result.findings.length }, 'Scan completed');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Scan failed';
      await database.scan.update({
        where: { id: scan.id },
        data: { status: 'FAILED', errorMessage: message, completedAt: new Date() },
      });
      throw error;
    }
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
  await database.$disconnect();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
