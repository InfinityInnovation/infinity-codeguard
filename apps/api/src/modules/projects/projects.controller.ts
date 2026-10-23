import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser, CreateProjectInput, ProjectSummary } from '@codeguard/contracts';
import { createProjectSchema, identifierSchema } from '@codeguard/contracts';
import { CurrentUser } from '../../common/current-user.decorator';
import { correlationId } from '../../common/request-context';
import { SessionGuard } from '../../common/session.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProjectsService } from './projects.service';

@Controller({ path: 'organizations/:organizationId/projects', version: '1' })
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  async list(
    @Param('organizationId') rawOrganizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectSummary[]> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    await this.organizations.assertMembership(user.id, organizationId);
    return this.projects.list(organizationId);
  }

  @Post()
  async create(
    @Param('organizationId') rawOrganizationId: string,
    @Body() raw: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ProjectSummary> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const input: CreateProjectInput = createProjectSchema.parse(raw);
    await this.organizations.assertRole(user.id, organizationId, 'ADMIN');
    return this.projects.create(organizationId, user.id, input, correlationId(request));
  }
}
