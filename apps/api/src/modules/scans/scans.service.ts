import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { database } from '@codeguard/database';
import type {
  FindingSource,
  FindingSummary,
  ScanSummary,
} from '@codeguard/contracts';
import type { z } from 'zod';
import { updateFindingStatusSchema } from '@codeguard/contracts';
import { loadFindingSource } from './source';
import { buildJsonReport, buildSarifReport } from './report';

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
    profile: 'STANDARD' | 'SECRETS' | 'OWASP_TOP_TEN' | 'INFRASTRUCTURE_AS_CODE',
    actorId: string,
    requestCorrelationId: string,
  ): Promise<ScanSummary> {
    const repository = await database.repository.findFirst({
      where: { id: repositoryId, projectId, organizationId },
      select: { id: true, name: true },
    });
    if (!repository) throw new NotFoundException('Repository not found');
    const activeScan = await database.scan.findFirst({
      where: { organizationId, projectId, repositoryId, status: { in: ['QUEUED', 'RUNNING'] } },
      select: { id: true },
    });
    if (activeScan) throw new ConflictException('An analysis is already running for this repository');
    const scan = await database.$transaction(async (tx) => {
      const created = await tx.scan.create({
        data: { organizationId, projectId, repositoryId, profile },
      });
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorId,
          action: 'scan.queued',
          targetType: 'Scan',
          targetId: created.id,
          correlationId: requestCorrelationId,
          metadata: { projectId, repositoryId, scanner: 'semgrep', profile },
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
    const scan = await database.scan.findFirst({
      where: { id: scanId, organizationId, projectId },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    return database.finding.findMany({
      where: { scanId, organizationId, projectId },
      select: {
        id: true,
        scanId: true,
        ruleId: true,
        severity: true,
        status: true,
        message: true,
        filePath: true,
        startLine: true,
        endLine: true,
      },
      orderBy: [{ severity: 'asc' }, { filePath: 'asc' }, { startLine: 'asc' }],
    });
  }

  async updateFindingStatus(
    organizationId: string,
    projectId: string,
    scanId: string,
    findingId: string,
    input: z.infer<typeof updateFindingStatusSchema>,
    actorId: string,
    requestCorrelationId: string,
  ): Promise<FindingSummary> {
    const existing = await database.finding.findFirst({
      where: { id: findingId, scanId, organizationId, projectId },
    });
    if (!existing) throw new NotFoundException('Finding not found');
    const updated = await database.$transaction(async (tx) => {
      const finding = await tx.finding.update({
        where: { id: findingId },
        data: { status: input.status },
      });
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorId,
          action: 'finding.status.updated',
          targetType: 'Finding',
          targetId: findingId,
          correlationId: requestCorrelationId,
          metadata: { projectId, scanId, previousStatus: existing.status, status: input.status },
        },
      });
      return finding;
    });
    return updated;
  }

  async report(
    organizationId: string,
    projectId: string,
    scanId: string,
    format: 'sarif' | 'json',
  ): Promise<{ body: unknown; filename: string }> {
    const scan = await database.scan.findFirst({
      where: { id: scanId, organizationId, projectId },
      include: { repository: { select: { name: true } } },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    const summary = toSummary(scan);
    const findings = await this.findings(organizationId, projectId, scanId);
    return {
      body: format === 'sarif' ? buildSarifReport(summary, findings) : buildJsonReport(summary, findings),
      filename: `${scan.repository.name}-${scan.id}.${format === 'sarif' ? 'sarif' : 'json'}`,
    };
  }

  async findingSource(
    organizationId: string,
    projectId: string,
    scanId: string,
    findingId: string,
  ): Promise<FindingSource> {
    const finding = await database.finding.findFirst({
      where: { id: findingId, scanId, organizationId, projectId },
      include: { scan: { include: { repository: true } } },
    });
    if (!finding || !finding.scan.commitSha) throw new NotFoundException('Finding source not found');
    return loadFindingSource({
      remoteUrl: finding.scan.repository.remoteUrl,
      commitSha: finding.scan.commitSha,
      filePath: finding.filePath,
      startLine: finding.startLine,
      endLine: finding.endLine,
    });
  }
}

function toSummary(scan: {
  id: string;
  organizationId: string;
  projectId: string;
  repositoryId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  scanner: string;
  profile: 'STANDARD' | 'SECRETS' | 'OWASP_TOP_TEN' | 'INFRASTRUCTURE_AS_CODE';
  commitSha: string | null;
  errorMessage: string | null;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  qualityGate: 'PENDING' | 'PASSED' | 'FAILED';
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
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
