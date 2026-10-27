import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  createMany: vi.fn(),
  transactionScanUpdate: vi.fn(),
  scan: vi.fn(),
}));

vi.mock('@codeguard/database', () => ({
  database: {
    scan: { findFirst: mocks.findFirst, update: mocks.update, updateMany: mocks.updateMany },
    $transaction: (run: (tx: unknown) => Promise<unknown>) =>
      run({
        finding: { createMany: mocks.createMany },
        scan: { update: mocks.transactionScanUpdate },
      }),
  },
}));
vi.mock('./semgrep.js', () => ({ runSemgrepScan: mocks.scan }));

import { countSeverities, processScanJob } from './scan-processor.js';

const payload = {
  scanId: '34dc152b-7de6-4fa5-a16b-6cb6b0d32fc9',
  organizationId: '5931d112-d1e0-462a-bfc3-b954e551926c',
  projectId: '27e18e39-09a4-4a2a-8b96-8eca4820e68e',
  repositoryId: '75a3713b-6a9d-439c-8e8b-4eed86c51c63',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue({
    id: payload.scanId,
    organizationId: payload.organizationId,
    projectId: payload.projectId,
    repository: { remoteUrl: 'https://github.com/example/project.git' },
    branch: 'main',
    profile: 'COMPREHENSIVE',
  });
  mocks.update.mockResolvedValue({});
  mocks.transactionScanUpdate.mockResolvedValue({});
  mocks.createMany.mockResolvedValue({ count: 1 });
});

describe('scan processing', () => {
  it('counts severities and stores findings with the tenant-bound scan', async () => {
    expect(
      countSeverities([{ severity: 'HIGH' }, { severity: 'HIGH' }, { severity: 'LOW' }]),
    ).toMatchObject({ HIGH: 2, LOW: 1 });
    mocks.scan.mockResolvedValue({
      commitSha: 'a'.repeat(40),
      findings: [{ ruleId: 'rule', severity: 'HIGH', fingerprint: 'fingerprint' }],
    });
    await expect(processScanJob(payload)).resolves.toBe(1);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: payload.scanId,
        organizationId: payload.organizationId,
        projectId: payload.projectId,
        repositoryId: payload.repositoryId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      include: { repository: true },
    });
    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            organizationId: payload.organizationId,
            projectId: payload.projectId,
            scanId: payload.scanId,
          }),
        ],
      }),
    );
    expect(mocks.transactionScanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCEEDED', highCount: 1, qualityGate: 'FAILED' }),
      }),
    );
  });

  it('does not run a scanner for an unmatched tenant or repository', async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(processScanJob(payload)).rejects.toThrow('Tenant-bound queued scan not found');
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it('records a failed scan when engine execution fails', async () => {
    mocks.scan.mockRejectedValue(new Error('Engine unavailable'));
    await expect(processScanJob(payload)).rejects.toThrow('Engine unavailable');
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', errorMessage: 'Engine unavailable' }),
      }),
    );
  });
});
