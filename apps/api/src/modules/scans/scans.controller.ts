import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { createScanSchema, identifierSchema, updateFindingStatusSchema } from '@codeguard/contracts';
import type {
  AuthenticatedUser,
  FindingSource,
  FindingSummary,
  ScanDelta,
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
    const input = createScanSchema.parse(raw);
    await this.organizations.assertRole(user.id, organizationId, 'MEMBER');
    return this.scans.create(
      organizationId,
      projectId,
      input.repositoryId,
      input.profile,
      input.branch,
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

  @Get(':scanId/delta')
  async delta(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Param('scanId') rawScanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ScanDelta> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const scanId = identifierSchema.parse(rawScanId);
    await this.organizations.assertMembership(user.id, organizationId);
    return this.scans.delta(organizationId, projectId, scanId);
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

  @Patch(':scanId/findings/:findingId')
  async updateFindingStatus(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Param('scanId') rawScanId: string,
    @Param('findingId') rawFindingId: string,
    @Body() raw: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<FindingSummary> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const scanId = identifierSchema.parse(rawScanId);
    const findingId = identifierSchema.parse(rawFindingId);
    const input = updateFindingStatusSchema.parse(raw);
    await this.organizations.assertRole(user.id, organizationId, 'MEMBER');
    return this.scans.updateFindingStatus(
      organizationId,
      projectId,
      scanId,
      findingId,
      input,
      user.id,
      correlationId(request),
    );
  }

  @Get(':scanId/report')
  async report(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Param('scanId') rawScanId: string,
    @Query('format') rawFormat: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const scanId = identifierSchema.parse(rawScanId);
    const format = z.enum(['sarif', 'json']).default('sarif').parse(rawFormat);
    await this.organizations.assertMembership(user.id, organizationId);
    const report = await this.scans.report(organizationId, projectId, scanId, format);
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('content-disposition', `attachment; filename="${report.filename}"`);
    return report.body;
  }
}
