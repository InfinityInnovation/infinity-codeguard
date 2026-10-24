import { describe, expect, it } from 'vitest';
import { assertSafeRepositoryUrl, parseSemgrepOutput } from './semgrep.js';

describe('Semgrep adapter', () => {
  it('parses findings without retaining source code', () => {
    const findings = parseSemgrepOutput(JSON.stringify({ results: [{
      check_id: 'javascript.lang.security.audit.xss', path: '/tmp/checkout/src/app.ts',
      start: { line: 4 }, end: { line: 6 },
      extra: { message: 'Unsafe output', severity: 'ERROR', metadata: { impact: 'HIGH' } },
    }] }), '/tmp/checkout');
    expect(findings[0]).toMatchObject({ severity: 'HIGH', filePath: 'src/app.ts', startLine: 4 });
    expect(findings[0]).not.toHaveProperty('source');
  });

  it('rejects credentials, internal hosts, ports and non-HTTPS URLs', () => {
    expect(() => assertSafeRepositoryUrl('https://github.com/org/repo.git')).not.toThrow();
    expect(() => assertSafeRepositoryUrl('https://user:token@github.com/org/repo.git')).toThrow();
    expect(() => assertSafeRepositoryUrl('https://postgres/repo.git')).toThrow();
    expect(() => assertSafeRepositoryUrl('https://github.com:8443/org/repo.git')).toThrow();
    expect(() => assertSafeRepositoryUrl('http://github.com/org/repo.git')).toThrow();
  });
});
