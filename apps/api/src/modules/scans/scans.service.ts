import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { database } from '@codeguard/database';
import type { FindingSummary, ScanSummary } from '@codeguard/contracts';

const SCAN_QUEUE = 'scan-orchestration';

@Injectable()
export class ScansService implements OnApplicationShutdown {
  private readonly connection: IORedis;
  private readonly queue: Queue;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL is required');
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(SCAN_QUEUE, { connection: this.connection });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }

  async list(organizationId: string, projectId: string): Promise<ScanSummary[]> {
    const scans = await database.scan.findMany({
      where: { organizationId, projectId },
      include: { repository: { select: { name: true } } },
      orderBy: { queuedAt: 'desc' },
      take: 50,
    });
    return scans.map(toSummary);
  }

  async create(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    actorId: string,
    requestCorrelationId: string,
  ): Promise<ScanSummary> {
    const repository = await database.repository.findFirst({
      where: { id: repositoryId, projectId, organizationId },
      select: { id: true, name: true },
    });
    if (!repository) throw new NotFoundException('Repository not found');
    const scan = await database.$transaction(async (tx) => {
      const created = await tx.scan.create({ data: { organizationId, projectId, repositoryId } });
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorId,
          action: 'scan.queued',
          targetType: 'Scan',
          targetId: created.id,
          correlationId: requestCorrelationId,
          metadata: { projectId, repositoryId, scanner: 'semgrep' },
        },
      });
      return created;
    });
    try {
      await this.queue.add(
        'semgrep-scan',
        { scanId: scan.id, organizationId, projectId, repositoryId },
        { jobId: scan.id, attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
      );
    } catch {
      await database.scan.update({
        where: { id: scan.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Queue unavailable' },
      });
      throw new ServiceUnavailableException('Scan queue unavailable');
    }
    return toSummary({ ...scan, repository });
  }

  async findings(
    organizationId: string,
    projectId: string,
    scanId: string,
  ): Promise<FindingSummary[]> {
    const scan = await database.scan.findFirst({ where: { id: scanId, organizationId, projectId } });
    if (!scan) throw new NotFoundException('Scan not found');
    return database.finding.findMany({
      where: { scanId, organizationId, projectId },
      select: {
        id: true,
        scanId: true,
        ruleId: true,
        severity: true,
        message: true,
        filePath: true,
        startLine: true,
        endLine: true,
      },
      orderBy: [{ severity: 'asc' }, { filePath: 'asc' }, { startLine: 'asc' }],
    });
  }
}

function toSummary(scan: {
  id: string; organizationId: string; projectId: string; repositoryId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'; scanner: string;
  commitSha: string | null; errorMessage: string | null; findingCount: number;
  queuedAt: Date; startedAt: Date | null; completedAt: Date | null;
  repository: { name: string };
}): ScanSummary {
  return {
    ...scan,
    repositoryName: scan.repository.name,
    queuedAt: scan.queuedAt.toISOString(),
    startedAt: scan.startedAt?.toISOString() ?? null,
    completedAt: scan.completedAt?.toISOString() ?? null,
  };
}
