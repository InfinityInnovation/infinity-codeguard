'use client';

import type { GitHubIntegration } from '@codeguard/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { apiRequest } from '../../../lib/api';
import { noContentSchema } from '../model/schemas';
import { workspaceQueryKeys } from '../model/query-keys';

export function IntegrationsView({
  organizationId,
  integration,
  loading,
}: {
  organizationId: string;
  integration?: GitHubIntegration;
  loading: boolean;
}) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const disconnect = useMutation({
    mutationFn: () =>
      apiRequest(
        `/integrations/github?organizationId=${encodeURIComponent(organizationId)}`,
        noContentSchema,
        { method: 'DELETE' },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.githubIntegration(organizationId),
      }),
  });
  if (loading) return <div className="status">{t('loadingIntegration')}</div>;
  return (
    <section className="cg-integrations-panel">
      <header>
        <div>
          <h2>{t('sourceConnections')}</h2>
          <p>{t('sourceConnectionsHelp')}</p>
        </div>
      </header>
      <article className="cg-integration-card">
        <div className="cg-github-mark">GH</div>
        <div className="cg-integration-copy">
          <div>
            <h3>GitHub App</h3>
            <span className={integration?.connected ? 'connected' : 'disconnected'}>
              {integration?.connected ? t('connected') : t('notConnected')}
            </span>
          </div>
          <p>{t('githubIntegrationHelp')}</p>
          {integration?.connected && (
            <dl>
              <div>
                <dt>{t('githubAccount')}</dt>
                <dd>{integration.accountLogin}</dd>
              </div>
              <div>
                <dt>{t('repositoryAccess')}</dt>
                <dd>
                  {integration.repositorySelection === 'all'
                    ? t('allRepositories')
                    : t('selectedRepositories')}
                </dd>
              </div>
            </dl>
          )}
          {!integration?.configured && (
            <div className="cg-config-notice">
              <strong>{t('configurationRequired')}</strong>
              <span>{t('githubConfigurationHelp')}</span>
            </div>
          )}
        </div>
        <div className="cg-integration-actions">
          {integration?.connected ? (
            <button
              className="sq-secondary"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              {t('disconnect')}
            </button>
          ) : integration?.installUrl ? (
            <a className="sq-primary" href={integration.installUrl}>
              {t('connectGithub')}
            </a>
          ) : null}
        </div>
      </article>
      <div className="cg-integration-security">
        <strong>{t('leastPrivilege')}</strong>
        <p>{t('leastPrivilegeHelp')}</p>
      </div>
    </section>
  );
}
