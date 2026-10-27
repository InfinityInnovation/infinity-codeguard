import {
  authenticatedUserSchema,
  findingSourceSchema,
  githubIntegrationSchema,
} from '@codeguard/contracts';
import type { FindingSummary } from '@codeguard/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
import type { WorkspaceView } from '../model/navigation';
import { workspaceQueryKeys } from '../model/query-keys';
import { latestScansByRepository, selectAvailableId } from '../model/selectors';
import {
  findingsSchema,
  organizationsSchema,
  projectsSchema,
  repositoriesSchema,
  scansSchema,
} from '../model/schemas';

type Selection = {
  organizationId?: string;
  projectId?: string;
  scanId?: string;
  findingId?: string;
  severity?: FindingSummary['severity'];
  activeView: WorkspaceView;
};

export function useWorkspaceData(selection: Selection) {
  const session = useQuery({
    queryKey: workspaceQueryKeys.session,
    queryFn: () => apiRequest('/auth/session', authenticatedUserSchema),
    retry: false,
  });
  const organizations = useQuery({
    queryKey: workspaceQueryKeys.organizations,
    queryFn: () => apiRequest('/organizations', organizationsSchema),
    enabled: session.isSuccess,
  });
  const activeId = selectAvailableId(organizations.data, selection.organizationId);
  const activeOrganization = organizations.data?.find(({ id }) => id === activeId);
  const githubIntegration = useQuery({
    queryKey: workspaceQueryKeys.githubIntegration(activeId),
    queryFn: () =>
      apiRequest(
        `/integrations/github?organizationId=${encodeURIComponent(activeId ?? '')}`,
        githubIntegrationSchema,
      ),
    enabled: Boolean(activeId && ['OWNER', 'ADMIN'].includes(activeOrganization?.role ?? '')),
  });
  const projects = useQuery({
    queryKey: workspaceQueryKeys.projects(activeId),
    queryFn: () => apiRequest(`/organizations/${activeId}/projects`, projectsSchema),
    enabled: Boolean(activeId),
  });
  const activeProjectId = selectAvailableId(projects.data, selection.projectId);
  const activeProject = projects.data?.find(({ id }) => id === activeProjectId);
  const repositories = useQuery({
    queryKey: workspaceQueryKeys.repositories(activeId, activeProjectId),
    queryFn: () =>
      apiRequest(
        `/organizations/${activeId}/projects/${activeProjectId}/repositories`,
        repositoriesSchema,
      ),
    enabled: Boolean(activeId && activeProjectId),
  });
  const scans = useQuery({
    queryKey: workspaceQueryKeys.scans(activeId, activeProjectId),
    queryFn: () =>
      apiRequest(`/organizations/${activeId}/projects/${activeProjectId}/scans`, scansSchema),
    enabled: Boolean(activeId && activeProjectId),
    refetchInterval: (query) =>
      query.state.data?.some((scan) => ['QUEUED', 'RUNNING'].includes(scan.status)) ? 2000 : false,
  });
  const latestRepositoryScans = latestScansByRepository(scans.data ?? []);
  const findingCount = latestRepositoryScans.reduce((total, scan) => total + scan.findingCount, 0);
  const selectedScan = scans.data?.find(({ id }) => id === selection.scanId) ?? scans.data?.[0];
  const findings = useQuery({
    queryKey: workspaceQueryKeys.findings(activeId, activeProjectId, selectedScan?.id),
    queryFn: () =>
      apiRequest(
        `/organizations/${activeId}/projects/${activeProjectId}/scans/${selectedScan?.id}/findings`,
        findingsSchema,
      ),
    enabled: Boolean(
      activeId && activeProjectId && selectedScan?.id && selectedScan.status === 'SUCCEEDED',
    ),
  });
  const findingsForSelection = selection.severity
    ? findings.data?.filter((finding) => finding.severity === selection.severity)
    : findings.data;
  const selectedFinding =
    findingsForSelection?.find(({ id }) => id === selection.findingId) ?? findingsForSelection?.[0];
  const findingSource = useQuery({
    queryKey: workspaceQueryKeys.findingSource(
      activeId,
      activeProjectId,
      selectedScan?.id,
      selectedFinding?.id,
    ),
    queryFn: () =>
      apiRequest(
        `/organizations/${activeId}/projects/${activeProjectId}/scans/${selectedScan?.id}/findings/${selectedFinding?.id}/source`,
        findingSourceSchema,
      ),
    enabled: Boolean(
      ['vulnerabilities', 'project'].includes(selection.activeView) &&
        activeId &&
        activeProjectId &&
        selectedScan?.id &&
        selectedFinding?.id,
    ),
  });
  return {
    session,
    organizations,
    activeId,
    activeOrganization,
    githubIntegration,
    projects,
    activeProjectId,
    activeProject,
    repositories,
    scans,
    latestRepositoryScans,
    findingCount,
    selectedScan,
    findings,
    selectedFinding,
    findingSource,
  };
}
