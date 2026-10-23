import { ForbiddenException, Injectable } from '@nestjs/common';
import { database } from '@codeguard/database';

@Injectable()
export class OrganizationsService {
  async assertMembership(userId: string, organizationId: string): Promise<void> {
    const membership = await database.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Organization access denied');
  }
}
