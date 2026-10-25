import type { FindingSummary, ScanSummary } from '@codeguard/contracts';

type ReportFinding = FindingSummary;

function sarifLevel(severity: ReportFinding['severity']): 'error' | 'warning' | 'note' {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'error';
  if (severity === 'MEDIUM' || severity === 'LOW') return 'warning';
  return 'note';
}

export function buildSarifReport(scan: ScanSummary, findings: ReportFinding[]) {
  const rules = [...new Map(findings.map((finding) => [finding.ruleId, finding])).values()];
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Infinity CodeGuard',
            informationUri: 'https://semgrep.dev',
            semanticVersion: '0.1.0',
            rules: rules.map((finding) => ({
              id: finding.ruleId,
              shortDescription: { text: finding.message.slice(0, 200) },
              properties: { securitySeverity: finding.severity },
            })),
          },
        },
        automationDetails: { id: `${scan.repositoryName}/${scan.id}` },
        versionControlProvenance: scan.commitSha
          ? [{ revisionId: scan.commitSha }]
          : [],
        results: findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel(finding.severity),
          message: { text: finding.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.filePath, uriBaseId: '%SRCROOT%' },
                region: { startLine: finding.startLine, endLine: finding.endLine },
              },
            },
          ],
          properties: { severity: finding.severity, status: finding.status },
        })),
      },
    ],
  };
}

export function buildJsonReport(scan: ScanSummary, findings: ReportFinding[]) {
  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    scan,
    findings,
  };
}
