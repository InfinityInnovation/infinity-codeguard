'use client';

import type {
  OrganizationSummary,
  ProjectSummary,
  RepositorySummary,
  ScanSummary,
} from '@codeguard/contracts';
import { useTranslations } from 'next-intl';
import { ProjectForm, RepositoryForm } from '../components/project-forms';

type ProjectsViewProps = {
  organizations: OrganizationSummary[];
  organizationId?: string;
  activeOrganization?: OrganizationSummary;
  activeProject?: ProjectSummary;
  activeProjectId?: string;
  projects: ProjectSummary[];
  projectsPending: boolean;
  projectsError: boolean;
  repositories: RepositorySummary[];
  repositoriesPending: boolean;
  scans: ScanSummary[];
  search: string;
  locale: string;
  onSearch: (value: string) => void;
  onSelectOrganization: (id: string) => void;
  onSelectProject: (id: string) => void;
};

export function ProjectsView({
  organizations,
  organizationId,
  activeOrganization,
  activeProject,
  activeProjectId,
  projects,
  projectsPending,
  projectsError,
  repositories,
  repositoriesPending,
  scans,
  search,
  locale,
  onSearch,
  onSelectOrganization,
  onSelectProject,
}: ProjectsViewProps) {
  const t = useTranslations('dashboard');
  const common = useTranslations('common');
  const term = search.trim().toLowerCase();
  const filteredProjects = term
    ? projects.filter((project) => `${project.name} ${project.slug}`.toLowerCase().includes(term))
    : projects;
  return (
    <div className="cg-dashboard-grid">
      <section className="cg-panel" id="projects">
        <div className="sq-page-title">
          <div>
            <h1>{t('projects')}</h1>
            <p>{t('projectCount', { count: projects.length })}</p>
          </div>
          {activeOrganization && ['OWNER', 'ADMIN'].includes(activeOrganization.role) && (
            <ProjectForm organizationId={activeOrganization.id} />
          )}
        </div>
        <div className="sq-toolbar">
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t('searchProjects')}
            aria-label={t('searchProjects')}
          />
          <select
            value={organizationId ?? ''}
            onChange={(event) => onSelectOrganization(event.target.value)}
            aria-label={t('organizations')}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name} · {organization.role}
              </option>
            ))}
          </select>
        </div>
        <div className="sq-layout">
          <section className="sq-projects" aria-live="polite">
            <div className="sq-list-head">
              <span>{t('name')}</span>
              <span>{t('created')}</span>
              <span>{t('qualityGate')}</span>
            </div>
            {projectsPending && organizationId ? (
              <p className="sq-empty">{common('loading')}</p>
            ) : projectsError ? (
              <p className="sq-empty error-text">{common('error')}</p>
            ) : filteredProjects.length ? (
              filteredProjects.map((project) => {
                const lastScan = scans.find((scan) => scan.projectId === project.id);
                return (
                  <button
                    className={
                      project.id === activeProjectId
                        ? 'sq-project-row selected-row'
                        : 'sq-project-row'
                    }
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                  >
                    <div className="project-identity">
                      <span className="project-icon">{project.name.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <h3>{project.name}</h3>
                        <code>{project.slug}</code>
                      </div>
                    </div>
                    <time>
                      {new Intl.DateTimeFormat(locale).format(new Date(project.createdAt))}
                    </time>
                    <span className="quality-state">
                      <i className="status-dot neutral" />
                      {lastScan ? t(`status.${lastScan.status}`) : t('notAnalyzed')}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="sq-empty">
                <div className="empty-icon">⌕</div>
                <h3>{search ? t('noSearchResults') : t('emptyProjects')}</h3>
                <p>{t('emptyHelp')}</p>
              </div>
            )}
          </section>
        </div>
      </section>
      <section className="cg-repositories cg-panel" id="repositories">
        <div className="cg-section-head">
          <div>
            <h2>{t('repositories')}</h2>
            <p>
              {activeProject
                ? t('repositoriesFor', { project: activeProject.name })
                : t('selectProject')}
            </p>
          </div>
          {organizationId &&
            activeProjectId &&
            activeOrganization &&
            ['OWNER', 'ADMIN'].includes(activeOrganization.role) && (
              <RepositoryForm organizationId={organizationId} projectId={activeProjectId} />
            )}
        </div>
        {!activeProjectId ? (
          <div className="cg-empty">{t('selectProject')}</div>
        ) : repositoriesPending ? (
          <div className="cg-empty">{common('loading')}</div>
        ) : repositories.length ? (
          <div className="cg-repo-grid">
            {repositories.map((repository) => (
              <article key={repository.id}>
                <span>{repository.provider.replace('_', ' ')}</span>
                <h3>{repository.name}</h3>
                <code>{repository.remoteUrl}</code>
                <small>
                  {t('defaultBranch')}: {repository.defaultBranch}
                </small>
                <small>{t('scanFromCi')}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="cg-empty">
            <strong>{t('emptyRepositories')}</strong>
            <span>{t('emptyRepositoriesHelp')}</span>
          </div>
        )}
      </section>
    </div>
  );
}
