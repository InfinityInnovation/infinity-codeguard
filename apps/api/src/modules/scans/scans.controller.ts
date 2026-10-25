import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { identifierSchema } from '@codeguard/contracts';
import type {
  AuthenticatedUser,
  FindingSource,
  FindingSummary,
  ScanSummary,
} from '@codeguard/contracts';
import { CurrentUser } from '../../common/current-user.decorator';
import { correlationId } from '../../common/request-context';
import { SessionGuard } from '../../common/session.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { ScansService } from './scans.service';

@Controller({ path: 'organizations/:organizationId/projects/:projectId/scans', version: '1' })
@UseGuards(SessionGuard)
export class ScansController {
  constructor(
    private readonly scans: ScansService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  async list(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ScanSummary[]> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    await this.organizations.assertMembership(user.id, organizationId);
    return this.scans.list(organizationId, projectId);
  }

  @Post()
  async create(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Body() raw: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ScanSummary> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const repositoryId = identifierSchema.parse((raw as { repositoryId?: unknown })?.repositoryId);
    await this.organizations.assertMembership(user.id, organizationId);
    return this.scans.create(
      organizationId,
      projectId,
      repositoryId,
      user.id,
      correlationId(request),
    );
  }

  @Get(':scanId/findings')
  async findings(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Param('scanId') rawScanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FindingSummary[]> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const scanId = identifierSchema.parse(rawScanId);
    await this.organizations.assertMembership(user.id, organizationId);
    return this.scans.findings(organizationId, projectId, scanId);
  }

  @Get(':scanId/findings/:findingId/source')
  async findingSource(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Param('scanId') rawScanId: string,
    @Param('findingId') rawFindingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FindingSource> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const scanId = identifierSchema.parse(rawScanId);
    const findingId = identifierSchema.parse(rawFindingId);
    await this.organizations.assertMembership(user.id, organizationId);
    return this.scans.findingSource(organizationId, projectId, scanId, findingId);
  }
}
