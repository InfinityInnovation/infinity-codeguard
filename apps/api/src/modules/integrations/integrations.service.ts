import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { database } from '@codeguard/database';
import type { GitHubIntegration } from '@codeguard/contracts';
import {
  createAppJwt,
  createInstallationState,
  githubAppConfiguration,
  verifyInstallationState,
} from './github-app';

type GitHubInstallationResponse = {
  id: number;
  account: { login: string } | null;
  repository_selection: 'all' | 'selected';
  suspended_at: string | null;
};

@Injectable()
export class IntegrationsService {
  async githubStatus(
    organizationId: string,
    userId: string,
  ): Promise<GitHubIntegration> {
    const configuration = githubAppConfiguration();
    const installation = await database.gitHubInstallation.findUnique({ where: { organizationId } });
    return {
      configured: Boolean(configuration),
      connected: Boolean(installation),
      accountLogin: installation?.accountLogin ?? null,
      repositorySelection:
        installation?.repositorySelection === 'all' || installation?.repositorySelection === 'selected'
          ? installation.repositorySelection
          : null,
      suspended: Boolean(installation?.suspendedAt),
      installUrl: configuration
        ? `https://github.com/apps/${encodeURIComponent(configuration.slug)}/installations/new?state=${encodeURIComponent(createInstallationState(organizationId, userId, configuration.stateSecret))}`
        : null,
    };
  }

  async completeGitHubInstallation(rawState: string, rawInstallationId: string) {
    const configuration = githubAppConfiguration();
    if (!configuration) throw new ServiceUnavailableException('GitHub App is not configured');
    let state: ReturnType<typeof verifyInstallationState>;
    try {
      state = verifyInstallationState(rawState, configuration.stateSecret);
    } catch {
      throw new BadRequestException('Invalid or expired GitHub installation request');
    }
    const membership = await database.membership.findUnique({
      where: {
        userId_organizationId: { userId: state.userId, organizationId: state.organizationId },
      },
      select: { role: true },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new BadRequestException('GitHub installation permission denied');
    }
    const installationId = BigInt(rawInstallationId);
    const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${createAppJwt(configuration)}`,
        'x-github-api-version': '2026-03-10',
        'user-agent': 'Infinity-CodeGuard',
      },
    });
    if (!response.ok) throw new BadRequestException('GitHub installation could not be verified');
    const installation = (await response.json()) as GitHubInstallationResponse;
    if (!installation.account?.login) throw new BadRequestException('GitHub installation has no account');
    await database.gitHubInstallation.upsert({
      where: { organizationId: state.organizationId },
      create: {
        organizationId: state.organizationId,
        installationId,
        accountLogin: installation.account.login,
        repositorySelection: installation.repository_selection,
        suspendedAt: installation.suspended_at ? new Date(installation.suspended_at) : null,
      },
      update: {
        installationId,
        accountLogin: installation.account.login,
        repositorySelection: installation.repository_selection,
        suspendedAt: installation.suspended_at ? new Date(installation.suspended_at) : null,
      },
    });
    return state.organizationId;
  }

  async disconnectGitHub(organizationId: string): Promise<void> {
    await database.gitHubInstallation.deleteMany({ where: { organizationId } });
  }
}
