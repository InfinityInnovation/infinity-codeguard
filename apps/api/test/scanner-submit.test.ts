import { database } from '@codeguard/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeSubmittedFindings, resolveScanRepository, ScannerService } from '../src/modules/scanner/scanner.service.js';

afterEach(() => vi.restoreAllMocks());

describe('scanner submission', () => {
  it('deduplicates overlapping comprehensive rules before persistence', () => {
    const finding = {
      ruleId: 'typescript.security.rule',
      severity: 'HIGH' as const,
      message: 'Unsafe operation',
      filePath: 'src/index.ts',
      startLine: 10,
      endLine: 10,
    };
    const normalized = normalizeSubmittedFindings([finding, finding]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('creates a local repository inside the token project without GitHub', async () => {
    const token = {
      organizationId: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      project: { name: 'Gbp', slug: 'gbp-5b7b88' },
    };
    const id = crypto.randomUUID();
    const upsert = vi.spyOn(database.repository, 'upsert').mockResolvedValue({ id, name: 'Gbp' } as never);
    const repository = await resolveScanRepository(token, { repositoryId: 'gbp-5b7b88', branch: 'standarBank-prod' });
    expect(repository).toEqual({ id, name: 'Gbp' });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_remoteUrl: {
        organizationId: token.organizationId,
        remoteUrl: `codeguard-local://${token.projectId}`,
      } },
      create: expect.objectContaining({
        organizationId: token.organizationId,
        projectId: token.projectId,
        provider: 'OTHER',
      }),
    }));
  });

  it('rejects a repository reference outside the token project', async () => {
    const token = {
      organizationId: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      project: { name: 'Gbp', slug: 'gbp-5b7b88' },
    };
    const findFirst = vi.spyOn(database.repository, 'findFirst').mockResolvedValue(null);
    await expect(resolveScanRepository(token, { repositoryId: crypto.randomUUID(), branch: 'main' })).rejects.toThrow('Repository not found');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: token.organizationId, projectId: token.projectId }),
    }));
  });

  it('revokes only a token in the selected organization and project', async () => {
    const organizationId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const actorId = crypto.randomUUID();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(database, '$transaction').mockImplementation(async (callback) =>
      callback({
        analysisToken: { updateMany },
        auditEvent: { create: auditCreate },
      } as never),
    );
    await new ScannerService().revokeToken(organizationId, projectId, tokenId, actorId);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: tokenId, organizationId, projectId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId, actorId, action: 'analysis-token.revoked' }),
    }));
  });

  it('cannot revoke an already revoked or foreign token', async () => {
    const auditCreate = vi.fn();
    vi.spyOn(database, '$transaction').mockImplementation(async (callback) =>
      callback({
        analysisToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        auditEvent: { create: auditCreate },
      } as never),
    );
    await expect(new ScannerService().revokeToken(crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID())).rejects.toThrow('Active analysis token not found');
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
