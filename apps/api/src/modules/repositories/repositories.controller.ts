import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { createRepositorySchema, identifierSchema } from '@codeguard/contracts';
import type {
  AuthenticatedUser,
  CreateRepositoryInput,
  RepositorySummary,
} from '@codeguard/contracts';
import { CurrentUser } from '../../common/current-user.decorator';
import { correlationId } from '../../common/request-context';
import { SessionGuard } from '../../common/session.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { RepositoriesService } from './repositories.service';

@Controller({
  path: 'organizations/:organizationId/projects/:projectId/repositories',
  version: '1',
})
@UseGuards(SessionGuard)
export class RepositoriesController {
  constructor(
    private readonly repositories: RepositoriesService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  async list(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RepositorySummary[]> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    await this.organizations.assertMembership(user.id, organizationId);
    return this.repositories.list(organizationId, projectId);
  }

  @Post()
  async create(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Body() raw: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<RepositorySummary> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const input: CreateRepositoryInput = createRepositorySchema.parse(raw);
    await this.organizations.assertRole(user.id, organizationId, 'ADMIN');
    return this.repositories.create(
      organizationId,
      projectId,
      user.id,
      input,
      correlationId(request),
    );
  }
}
