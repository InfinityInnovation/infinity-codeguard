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
import type { FindingSource, FindingSummary, ScanDelta, ScanSummary } from '@codeguard/contracts';
import type { z } from 'zod';
import { updateFindingStatusSchema } from '@codeguard/contracts';
import { loadFindingSource, sanitizeSubmittedPreview } from './source';
import { buildJsonReport, buildSarifReport } from './report';
import { classifyScanFindings } from './scan-delta';

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

  async delta(organizationId: string, projectId: string, scanId: string): Promise<ScanDelta> {
    const scan = await database.scan.findFirst({
      where: { id: scanId, organizationId, projectId, status: 'SUCCEEDED' },
      select: { id: true, repositoryId: true, branch: true, queuedAt: true },
    });
    if (!scan) throw new NotFoundException('Completed scan not found');
    const previous = await database.scan.findFirst({
      where: {
        organizationId,
        projectId,
        repositoryId: scan.repositoryId,
        branch: scan.branch,
        status: 'SUCCEEDED',
        queuedAt: { lt: scan.queuedAt },
      },
      select: { id: true, queuedAt: true },
      orderBy: { queuedAt: 'desc' },
    });
    const currentFindings = await database.finding.findMany({
      where: { organizationId, projectId, scanId },
      select: { fingerprint: true },
    });
    if (!previous)
      return classifyScanFindings(
        scanId,
        null,
        currentFindings.map((item) => item.fingerprint),
        [],
        [],
      );
    const previousFindings = await database.finding.findMany({
      where: { organizationId, projectId, scanId: previous.id },
      select: { fingerprint: true },
    });
    const previousSet = new Set(previousFindings.map((item) => item.fingerprint));
    const candidates = [...new Set(currentFindings.map((item) => item.fingerprint))].filter(
      (fingerprint) => !previousSet.has(fingerprint),
    );
    const historical = candidates.length
      ? await database.finding.findMany({
          where: {
            organizationId,
            projectId,
            fingerprint: { in: candidates },
            scan: {
              repositoryId: scan.repositoryId,
              branch: scan.branch,
              status: 'SUCCEEDED',
              queuedAt: { lt: previous.queuedAt },
            },
          },
          select: { fingerprint: true },
          distinct: ['fingerprint'],
        })
      : [];
    return classifyScanFindings(
      scanId,
      previous.id,
      currentFindings.map((item) => item.fingerprint),
      previousFindings.map((item) => item.fingerprint),
      historical.map((item) => item.fingerprint),
    );
  }

  async create(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    profile: 'COMPREHENSIVE' | 'STANDARD' | 'SECRETS' | 'OWASP_TOP_TEN' | 'INFRASTRUCTURE_AS_CODE',
    branch: string | undefined,
    actorId: string,
    requestCorrelationId: string,
  ): Promise<ScanSummary> {
    const repository = await database.repository.findFirst({
      where: { id: repositoryId, projectId, organizationId },
      select: { id: true, name: true, defaultBranch: true },
    });
    if (!repository) throw new NotFoundException('Repository not found');
    const activeScan = await database.scan.findFirst({
      where: { organizationId, projectId, repositoryId, status: { in: ['QUEUED', 'RUNNING'] } },
      select: { id: true },
    });
    if (activeScan)
      throw new ConflictException('An analysis is already running for this repository');
    const scan = await database.$transaction(async (tx) => {
      const created = await tx.scan.create({
        data: {
          organizationId,
          projectId,
          repositoryId,
          profile,
          branch: branch ?? repository.defaultBranch,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorId,
          action: 'scan.queued',
          targetType: 'Scan',
          targetId: created.id,
          correlationId: requestCorrelationId,
          metadata: {
            projectId,
            repositoryId,
            scanner: 'semgrep',
            profile,
            branch: branch ?? repository.defaultBranch,
          },
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
      body:
        format === 'sarif'
          ? buildSarifReport(summary, findings)
          : buildJsonReport(summary, findings),
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
    if (!finding || !finding.scan.commitSha)
      throw new NotFoundException('Finding source not found');
    const storedLines = sanitizeSubmittedPreview(finding.sourcePreview);
    if (storedLines?.length) {
      return {
        filePath: finding.filePath,
        commitSha: finding.scan.commitSha,
        sourceUrl: `codeguard-local://scan/${scanId}`,
        lines: storedLines,
      };
    }
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
  profile: 'COMPREHENSIVE' | 'STANDARD' | 'SECRETS' | 'OWASP_TOP_TEN' | 'INFRASTRUCTURE_AS_CODE';
  branch: string;
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
