export const workspaceQueryKeys = {
  session: ['session'] as const,
  organizations: ['organizations'] as const,
  githubIntegration: (organizationId?: string) => ['github-integration', organizationId] as const,
  projects: (organizationId?: string) => ['projects', organizationId] as const,
  repositories: (organizationId?: string, projectId?: string) =>
    ['repositories', organizationId, projectId] as const,
  analysisTokens: (organizationId?: string, projectId?: string) =>
    ['analysis-tokens', organizationId, projectId] as const,
  scans: (organizationId?: string, projectId?: string) =>
    ['scans', organizationId, projectId] as const,
  scanDelta: (organizationId?: string, projectId?: string, scanId?: string) =>
    ['scan-delta', organizationId, projectId, scanId] as const,
  findings: (organizationId?: string, projectId?: string, scanId?: string) =>
    ['findings', organizationId, projectId, scanId] as const,
  findingSource: (
    organizationId?: string,
    projectId?: string,
    scanId?: string,
    findingId?: string,
  ) => ['finding-source', organizationId, projectId, scanId, findingId] as const,
};
