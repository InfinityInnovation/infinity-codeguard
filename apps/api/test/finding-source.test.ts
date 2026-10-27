import { describe, expect, it } from 'vitest';
import {
  githubRawUrl,
  sanitizeSubmittedPreview,
  sourceWindow,
} from '../src/modules/scans/source.js';

describe('finding source preview', () => {
  it('builds an immutable GitHub raw URL and rejects traversal', () => {
    expect(githubRawUrl('https://github.com/acme/app.git', 'a'.repeat(40), 'src/app.ts').href).toBe(
      `https://raw.githubusercontent.com/acme/app/${'a'.repeat(40)}/src/app.ts`,
    );
    expect(() =>
      githubRawUrl('https://github.com/acme/app.git', 'a'.repeat(40), '../secret'),
    ).toThrow();
  });

  it('limits context and redacts common secret assignments', () => {
    const preview = sourceWindow(
      ['const ok = true;', 'const token = abc123;', 'run();'].join('\n'),
      'src/app.ts',
      'a'.repeat(40),
      'https://raw.githubusercontent.com/acme/app/commit/src/app.ts',
      2,
      2,
    );
    expect(preview.lines).toHaveLength(3);
    expect(preview.lines[1]).toMatchObject({
      highlighted: true,
      content: 'const token=[REDACTED];',
    });
  });

  it('redacts submitted snippets on the server before storage', () => {
    expect(
      sanitizeSubmittedPreview([
        { number: 1, content: 'const apiKey = secret;', highlighted: true },
      ]),
    ).toEqual([{ number: 1, content: '[contenu masqué : secret possible]', highlighted: true }]);
  });
});
