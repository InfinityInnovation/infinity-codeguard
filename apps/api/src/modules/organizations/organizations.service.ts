import { ForbiddenException, Injectable } from '@nestjs/common';
import { database } from '@codeguard/database';
import type { OrganizationSummary, Role } from '@codeguard/contracts';

const ROLE_LEVEL: Record<Role, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

export function roleAllows(actual: Role, required: Role): boolean {
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[required];
}

@Injectable()
export class OrganizationsService {
  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await database.membership.findMany({
      where: { userId },
      select: {
        role: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { organization: { name: 'asc' } },
    });
    return memberships.map(({ organization, role }) => ({ ...organization, role }));
  }

  async assertMembership(userId: string, organizationId: string): Promise<void> {
    const membership = await database.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Organization access denied');
  }

  async assertRole(userId: string, organizationId: string, required: Role): Promise<void> {
    const membership = await database.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true },
    });
    if (!membership || !roleAllows(membership.role, required)) {
      throw new ForbiddenException('Organization permission denied');
    }
  }
}
