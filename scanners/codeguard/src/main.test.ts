import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMPREHENSIVE_CONFIGS,
  deduplicateFindings,
  normalizeSeverity,
  parseProperties,
  readSourcePreview,
  sourcePreviewWindow,
  validateRepositoryId,
} from './scanner.js';

describe('CodeGuard comprehensive scanner', () => {
  it('runs every security family in one Semgrep execution', () => {
    expect(COMPREHENSIVE_CONFIGS).toEqual([
      'p/default',
      'p/secrets',
      'p/owasp-top-ten',
      'p/terraform',
      'p/dockerfile',
    ]);
  });

  it('parses project properties and ignores comments', () => {
    expect(
      parseProperties(
        '# CodeGuard\ncodeguard.host.url=http://localhost:3000\ncodeguard.repository.id = repo-id',
      ),
    ).toEqual({
      'codeguard.host.url': 'http://localhost:3000',
      'codeguard.repository.id': 'repo-id',
    });
  });

  it('normalizes severity and removes duplicate findings', () => {
    const finding = {
      ruleId: 'rule',
      severity: normalizeSeverity('ERROR'),
      message: 'issue',
      filePath: 'src/a.ts',
      startLine: 2,
      endLine: 2,
    };
    expect(normalizeSeverity('WARNING')).toBe('MEDIUM');
    expect(deduplicateFindings([finding, finding])).toEqual([finding]);
  });

  it('accepts a project key for local scans and rejects invalid references', () => {
    expect(validateRepositoryId('gbp-5b7b88')).toBe('gbp-5b7b88');
    expect(validateRepositoryId(undefined)).toBeUndefined();
    expect(() => validateRepositoryId('https://example.com/repo')).toThrow('clé du projet');
    expect(validateRepositoryId('159b9a8d-45ff-4dde-9a3f-4c7ad66127f0')).toBe(
      '159b9a8d-45ff-4dde-9a3f-4c7ad66127f0',
    );
  });

  it('sends bounded source context with likely secrets masked', () => {
    const preview = sourcePreviewWindow(
      ['const ok = true;', 'const token = "super-secret";', 'run();'].join('\n'),
      2,
      2,
    );
    expect(preview).toHaveLength(3);
    expect(preview[1]).toEqual({
      number: 2,
      content: '[contenu masqué : secret possible]',
      highlighted: true,
    });
    expect(sourcePreviewWindow(Array(100).fill('line').join('\n'), 50, 50)).toHaveLength(11);
  });

  it('does not read source outside the scanned checkout, including symlinks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codeguard-preview-'));
    const outside = await mkdtemp(join(tmpdir(), 'codeguard-outside-'));
    try {
      await writeFile(join(root, 'safe.ts'), 'const value = 1;');
      await writeFile(join(outside, 'private.ts'), 'private');
      await symlink(join(outside, 'private.ts'), join(root, 'link.ts'));
      expect(await readSourcePreview(root, 'safe.ts', 1, 1)).toHaveLength(1);
      expect(await readSourcePreview(root, '../private.ts', 1, 1)).toBeUndefined();
      expect(await readSourcePreview(root, 'link.ts', 1, 1)).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
