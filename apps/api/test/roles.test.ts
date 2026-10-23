import { describe, expect, it } from 'vitest';
import { roleAllows } from '../src/modules/organizations/organizations.service';

describe('organization role ordering', () => {
  it('allows owners and admins to administer projects', () => {
    expect(roleAllows('OWNER', 'ADMIN')).toBe(true);
    expect(roleAllows('ADMIN', 'ADMIN')).toBe(true);
  });

  it('does not allow members or viewers to administer projects', () => {
    expect(roleAllows('MEMBER', 'ADMIN')).toBe(false);
    expect(roleAllows('VIEWER', 'ADMIN')).toBe(false);
  });
});
