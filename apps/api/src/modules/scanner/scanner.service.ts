import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { database } from '@codeguard/database';
import type { ScanSummary, SubmitAnalysisInput } from '@codeguard/contracts';
import { sanitizeSubmittedPreview } from '../scans/source';

@Injectable()
export class ScannerService {
  async listTokens(organizationId: string, projectId: string) {
    const project = await database.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    const tokens = await database.analysisToken.findMany({
      where: { organizationId, projectId },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return tokens.map((token) => ({
      ...token,
      createdAt: token.createdAt.toISOString(),
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      revokedAt: token.revokedAt?.toISOString() ?? null,
    }));
  }

  async revokeToken(
    organizationId: string,
    projectId: string,
    tokenId: string,
    actorId: string,
  ): Promise<void> {
    await database.$transaction(async (tx) => {
      const updated = await tx.analysisToken.updateMany({
        where: { id: tokenId, organizationId, projectId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (updated.count !== 1) throw new NotFoundException('Active analysis token not found');
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorId,
          action: 'analysis-token.revoked',
          targetType: 'AnalysisToken',
          targetId: tokenId,
          correlationId: randomUUID(),
          metadata: { projectId },
        },
      });
    });
  }

  async createToken(
    organizationId: string,
    projectId: string,
    name: string,
    expiresInDays: number,
  ) {
    const project = await database.project.findFirst({ where: { id: projectId, organizationId } });
    if (!project) throw new NotFoundException('Project not found');
    const token = `cg_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
    const created = await database.analysisToken.create({
      data: {
        organizationId,
        projectId,
        name,
        prefix: token.slice(0, 12),
        digest: digestToken(token),
        expiresAt,
      },
    });
    return {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async submit(rawToken: string | undefined, input: SubmitAnalysisInput): Promise<ScanSummary> {
    if (!rawToken?.startsWith('cg_')) throw new UnauthorizedException('Analysis token required');
    const token = await database.analysisToken.findUnique({
      where: { digest: digestToken(rawToken) },
      include: { project: true },
    });
    if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= new Date())) {
      throw new UnauthorizedException('Analysis token is invalid or expired');
    }
    const repository = await resolveScanRepository(token, input);
    const findings = normalizeSubmittedFindings(input.findings);
    const counts = findings.reduce(
      (result, finding) => ({ ...result, [finding.severity]: result[finding.severity] + 1 }),
      { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
    );
    const now = new Date();
    const scan = await database.$transaction(async (tx) => {
      const created = await tx.scan.create({
        data: {
          organizationId: token.organizationId,
          projectId: token.projectId,
          repositoryId: repository.id,
          status: 'SUCCEEDED',
          scanner: `semgrep-cli/${input.scannerVersion}`.slice(0, 40),
          profile: input.profile,
          branch: input.branch,
          commitSha: input.commitSha.toLowerCase(),
          findingCount: findings.length,
          criticalCount: counts.CRITICAL,
          highCount: counts.HIGH,
          mediumCount: counts.MEDIUM,
          lowCount: counts.LOW,
          infoCount: counts.INFO,
          qualityGate: counts.CRITICAL || counts.HIGH ? 'FAILED' : 'PASSED',
          startedAt: now,
          completedAt: now,
        },
      });
      if (findings.length) {
        await tx.finding.createMany({
          data: findings.map((finding) => ({
            ...finding,
            organizationId: token.organizationId,
            projectId: token.projectId,
            scanId: created.id,
          })),
          skipDuplicates: true,
        });
      }
      await tx.analysisToken.update({ where: { id: token.id }, data: { lastUsedAt: now } });
      await tx.auditEvent.create({
        data: {
          organizationId: token.organizationId,
          action: 'scan.submitted',
          targetType: 'Scan',
          targetId: created.id,
          correlationId: randomUUID(),
          metadata: {
            projectId: token.projectId,
            repositoryId: repository.id,
            branch: input.branch,
          },
        },
      });
      return created;
    });
    return {
      ...scan,
      repositoryName: repository.name,
      queuedAt: scan.queuedAt.toISOString(),
      startedAt: scan.startedAt?.toISOString() ?? null,
      completedAt: scan.completedAt?.toISOString() ?? null,
    };
  }
}

export async function resolveScanRepository(
  token: { organizationId: string; projectId: string; project: { name: string; slug: string } },
  input: Pick<SubmitAnalysisInput, 'repositoryId' | 'branch'>,
): Promise<{ id: string; name: string }> {
  if (input.repositoryId && input.repositoryId !== token.project.slug) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        input.repositoryId,
      )
    ) {
      throw new BadRequestException('La clé du projet ne correspond pas au jeton d’analyse.');
    }
    const repository = await database.repository.findFirst({
      where: {
        id: input.repositoryId,
        projectId: token.projectId,
        organizationId: token.organizationId,
      },
      select: { id: true, name: true },
    });
    if (!repository) throw new NotFoundException('Repository not found for this analysis token');
    return repository;
  }
  const remoteUrl = `codeguard-local://${token.projectId}`;
  return database.repository.upsert({
    where: { organizationId_remoteUrl: { organizationId: token.organizationId, remoteUrl } },
    create: {
      organizationId: token.organizationId,
      projectId: token.projectId,
      name: token.project.name,
      remoteUrl,
      defaultBranch: input.branch,
      provider: 'OTHER',
    },
    update: {},
    select: { id: true, name: true },
  });
}

function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeSubmittedFindings(findings: SubmitAnalysisInput['findings']) {
  return [
    ...new Map(
      findings.map((finding) => {
        const fingerprint = createHash('sha256')
          .update(
            `${finding.ruleId}\0${finding.filePath}\0${finding.startLine}\0${finding.message}`,
          )
          .digest('hex');
        return [
          fingerprint,
          {
            ...finding,
            sourcePreview: sanitizeSubmittedPreview(finding.sourcePreview),
            fingerprint,
          },
        ] as const;
      }),
    ).values(),
  ];
}
