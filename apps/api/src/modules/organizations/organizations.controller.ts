import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser, OrganizationSummary } from '@codeguard/contracts';
import { CurrentUser } from '../../common/current-user.decorator';
import { SessionGuard } from '../../common/session.guard';
import { OrganizationsService } from './organizations.service';

@Controller({ path: 'organizations', version: '1' })
@UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<OrganizationSummary[]> {
    return this.organizations.listForUser(user.id);
  }
}
