import { database } from '@codeguard/database';
import type { ScanJob } from './jobs.js';
import { runSemgrepScan } from './semgrep.js';

export function countSeverities(
  findings: readonly { severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' }[],
) {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

export async function processScanJob(payload: ScanJob): Promise<number> {
  const scan = await database.scan.findFirst({
    where: {
      id: payload.scanId,
      organizationId: payload.organizationId,
      projectId: payload.projectId,
      repositoryId: payload.repositoryId,
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    include: { repository: true },
  });
  if (!scan) throw new Error('Tenant-bound queued scan not found');
  await database.scan.update({
    where: { id: scan.id },
    data: { status: 'RUNNING', startedAt: new Date(), errorMessage: null },
  });
  try {
    const result = await runSemgrepScan(
      scan.repository.remoteUrl,
      scan.branch,
      scan.profile,
      scan.organizationId,
    );
    const severityCounts = countSeverities(result.findings);
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
          criticalCount: severityCounts.CRITICAL,
          highCount: severityCounts.HIGH,
          mediumCount: severityCounts.MEDIUM,
          lowCount: severityCounts.LOW,
          infoCount: severityCounts.INFO,
          qualityGate: severityCounts.CRITICAL > 0 || severityCounts.HIGH > 0 ? 'FAILED' : 'PASSED',
          completedAt: new Date(),
        },
      });
    });
    return result.findings.length;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Scan failed';
    await database.scan.update({
      where: { id: scan.id },
      data: { status: 'FAILED', errorMessage: message, completedAt: new Date() },
    });
    throw error;
  }
}

export async function recoverStaleScans(): Promise<number> {
  const staleBefore = new Date(Date.now() - 15 * 60_000);
  const recovered = await database.scan.updateMany({
    where: {
      status: { in: ['QUEUED', 'RUNNING'] },
      queuedAt: { lt: staleBefore },
    },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: 'Analysis interrupted before completion; start a new analysis.',
    },
  });
  return recovered.count;
}
