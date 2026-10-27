import { Controller, Delete, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedUser, GitHubIntegration } from '@codeguard/contracts';
import { identifierSchema } from '@codeguard/contracts';
import { CurrentUser } from '../../common/current-user.decorator';
import { SessionGuard } from '../../common/session.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { IntegrationsService } from './integrations.service';

@Controller({ path: 'integrations/github', version: '1' })
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly organizations: OrganizationsService,
  ) {}

  @Get()
  @UseGuards(SessionGuard)
  async status(
    @Query('organizationId') rawOrganizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GitHubIntegration> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    await this.organizations.assertRole(user.id, organizationId, 'ADMIN');
    return this.integrations.githubStatus(organizationId, user.id);
  }

  @Get('callback')
  async callback(
    @Query('state') rawState: string,
    @Query('installation_id') rawInstallationId: string,
    @Res() response: Response,
  ): Promise<void> {
    const state = z.string().min(20).parse(rawState);
    const installationId = z.string().regex(/^\d+$/).parse(rawInstallationId);
    await this.integrations.completeGitHubInstallation(state, installationId);
    response.redirect(`${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/fr/dashboard?view=integrations`);
  }

  @Delete()
  @UseGuards(SessionGuard)
  async disconnect(
    @Query('organizationId') rawOrganizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const organizationId = identifierSchema.parse(rawOrganizationId);
    await this.organizations.assertRole(user.id, organizationId, 'ADMIN');
    await this.integrations.disconnectGitHub(organizationId);
  }
}
