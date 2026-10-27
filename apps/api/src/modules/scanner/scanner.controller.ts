import { Body, Controller, Delete, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import {
  createAnalysisTokenSchema,
  identifierSchema,
  submitAnalysisSchema,
} from '@codeguard/contracts';
import type { AuthenticatedUser, ScanSummary } from '@codeguard/contracts';
import { CurrentUser } from '../../common/current-user.decorator';
import { SessionGuard } from '../../common/session.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { ScannerService } from './scanner.service';

@Controller({ path: 'scanner', version: '1' })
export class ScannerController {
  constructor(
    private readonly scanner: ScannerService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Post('organizations/:organizationId/projects/:projectId/tokens')
  @UseGuards(SessionGuard)
  async createToken(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Body() raw: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const input = createAnalysisTokenSchema.parse(raw);
    await this.organizations.assertRole(user.id, organizationId, 'ADMIN');
    return this.scanner.createToken(organizationId, projectId, input.name, input.expiresInDays);
  }

  @Get('organizations/:organizationId/projects/:projectId/tokens')
  @UseGuards(SessionGuard)
  async listTokens(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    await this.organizations.assertRole(user.id, organizationId, 'ADMIN');
    return this.scanner.listTokens(organizationId, projectId);
  }

  @Delete('organizations/:organizationId/projects/:projectId/tokens/:tokenId')
  @UseGuards(SessionGuard)
  async revokeToken(
    @Param('organizationId') rawOrganizationId: string,
    @Param('projectId') rawProjectId: string,
    @Param('tokenId') rawTokenId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ revoked: true }> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    const projectId = identifierSchema.parse(rawProjectId);
    const tokenId = identifierSchema.parse(rawTokenId);
    await this.organizations.assertRole(user.id, organizationId, 'ADMIN');
    await this.scanner.revokeToken(organizationId, projectId, tokenId, user.id);
    return { revoked: true };
  }

  @Post('analyses')
  async submit(
    @Headers('authorization') authorization: string | undefined,
    @Body() raw: unknown,
  ): Promise<ScanSummary> {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    return this.scanner.submit(token, submitAnalysisSchema.parse(raw));
  }
}
