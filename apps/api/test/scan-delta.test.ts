import { describe, expect, it } from 'vitest';
import { classifyScanFindings } from '../src/modules/scans/scan-delta.js';

describe('scan finding history', () => {
  it('separates new, fixed, continuing and reopened findings', () => {
    expect(classifyScanFindings(
      'current',
      'previous',
      ['persisting', 'new', 'reopened'],
      ['persisting', 'fixed'],
      ['reopened'],
    )).toEqual({
      scanId: 'current',
      previousScanId: 'previous',
      newCount: 1,
      fixedCount: 1,
      continuingCount: 1,
      reopenedCount: 1,
    });
  });

  it('treats the first successful scan as the baseline', () => {
    expect(classifyScanFindings('first', null, ['a', 'a', 'b'], [], [])).toMatchObject({
      newCount: 2,
      fixedCount: 0,
      continuingCount: 0,
      reopenedCount: 0,
    });
  });
});
