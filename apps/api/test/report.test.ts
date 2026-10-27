import { describe, expect, it } from 'vitest';
import type { FindingSummary, ScanSummary } from '@codeguard/contracts';
import { buildSarifReport } from '../src/modules/scans/report.js';

const scan: ScanSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  repositoryId: '44444444-4444-4444-8444-444444444444',
  repositoryName: 'service-api',
  status: 'SUCCEEDED',
  scanner: 'semgrep',
  profile: 'COMPREHENSIVE',
  branch: 'main',
  commitSha: 'a'.repeat(40),
  errorMessage: null,
  findingCount: 1,
  criticalCount: 0,
  highCount: 1,
  mediumCount: 0,
  lowCount: 0,
  infoCount: 0,
  qualityGate: 'FAILED',
  queuedAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};
const finding: FindingSummary = {
  id: '55555555-5555-4555-8555-555555555555',
  scanId: scan.id,
  ruleId: 'security.test',
  severity: 'HIGH',
  status: 'OPEN',
  message: 'Unsafe call',
  filePath: 'src/app.ts',
  startLine: 8,
  endLine: 9,
};

describe('SARIF report', () => {
  it('produces SARIF 2.1 with immutable commit and source location', () => {
    const report = buildSarifReport(scan, [finding]);
    expect(report.version).toBe('2.1.0');
    expect(report.runs[0]?.versionControlProvenance[0]?.revisionId).toBe('a'.repeat(40));
    expect(report.runs[0]?.results[0]).toMatchObject({
      ruleId: 'security.test',
      level: 'error',
      locations: [{ physicalLocation: { region: { startLine: 8, endLine: 9 } } }],
    });
  });
});
