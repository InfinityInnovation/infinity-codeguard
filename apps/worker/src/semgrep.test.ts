import { describe, expect, it } from 'vitest';
import {
  assertSafeRepositoryUrl,
  configsForProfile,
  normalizeCloneError,
  parseSemgrepOutput,
} from './semgrep.js';

describe('Semgrep adapter', () => {
  it('parses findings without retaining source code', () => {
    const findings = parseSemgrepOutput(
      JSON.stringify({
        results: [
          {
            check_id: 'javascript.lang.security.audit.xss',
            path: '/tmp/checkout/src/app.ts',
            start: { line: 4 },
            end: { line: 6 },
            extra: { message: 'Unsafe output', severity: 'ERROR', metadata: { impact: 'HIGH' } },
          },
        ],
      }),
      '/tmp/checkout',
    );
    expect(findings[0]).toMatchObject({ severity: 'HIGH', filePath: 'src/app.ts', startLine: 4 });
    expect(findings[0]).not.toHaveProperty('source');
  });

  it('accepts and normalizes current Semgrep policy severity levels', () => {
    const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const findings = parseSemgrepOutput(
      JSON.stringify({
        results: severities.map((severity, index) => ({
          check_id: `rule-${severity}`,
          path: `/tmp/checkout/src/file-${index}.ts`,
          start: { line: index + 1 },
          end: { line: index + 1 },
          extra: { message: severity, severity },
        })),
      }),
      '/tmp/checkout',
    );
    expect(findings.map((finding) => finding.severity)).toEqual(severities);
  });

  it('rejects credentials, internal hosts, ports and non-HTTPS URLs', () => {
    expect(() => assertSafeRepositoryUrl('https://github.com/org/repo.git')).not.toThrow();
    expect(() => assertSafeRepositoryUrl('https://user:token@github.com/org/repo.git')).toThrow();
    expect(() => assertSafeRepositoryUrl('https://postgres/repo.git')).toThrow();
    expect(() => assertSafeRepositoryUrl('https://github.com:8443/org/repo.git')).toThrow();
    expect(() => assertSafeRepositoryUrl('http://github.com/org/repo.git')).toThrow();
  });

  it('maps every analysis profile to validated Semgrep registry configurations', () => {
    expect(configsForProfile('COMPREHENSIVE')).toEqual([
      'p/default', 'p/secrets', 'p/owasp-top-ten', 'p/terraform', 'p/dockerfile',
    ]);
    expect(configsForProfile('STANDARD')).toEqual(['p/default']);
    expect(configsForProfile('SECRETS')).toEqual(['p/secrets']);
    expect(configsForProfile('OWASP_TOP_TEN')).toEqual(['p/owasp-top-ten']);
    expect(configsForProfile('INFRASTRUCTURE_AS_CODE')).toEqual(['p/terraform', 'p/dockerfile']);
  });

  it('returns a safe actionable message when a private repository cannot be cloned', () => {
    const error = normalizeCloneError(new Error("fatal: could not read Username for 'https://github.com'"));
    expect(error.message).toContain('Dépôt inaccessible');
    expect(error.message).not.toContain('/tmp/');
  });
});
