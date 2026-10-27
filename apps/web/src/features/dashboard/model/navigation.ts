export type WorkspaceView =
  | 'dashboard'
  | 'projects'
  | 'project'
  | 'analyses'
  | 'vulnerabilities'
  | 'quality'
  | 'reports'
  | 'integrations';

export type NavigationItem = {
  icon:
    | 'dashboard'
    | 'projects'
    | 'analyses'
    | 'vulnerabilities'
    | 'quality'
    | 'reports'
    | 'integrations';
  labelKey:
    | 'dashboard'
    | 'projects'
    | 'analyses'
    | 'vulnerabilities'
    | 'qualityGates'
    | 'reports'
    | 'integrations';
  view: Exclude<WorkspaceView, 'project'>;
};

export const WORKSPACE_NAVIGATION: NavigationItem[] = [
  { icon: 'dashboard', labelKey: 'dashboard', view: 'dashboard' },
  { icon: 'projects', labelKey: 'projects', view: 'projects' },
];

export const SECURITY_NAVIGATION: NavigationItem[] = [
  { icon: 'analyses', labelKey: 'analyses', view: 'analyses' },
  { icon: 'vulnerabilities', labelKey: 'vulnerabilities', view: 'vulnerabilities' },
  { icon: 'quality', labelKey: 'qualityGates', view: 'quality' },
  { icon: 'reports', labelKey: 'reports', view: 'reports' },
];

export const CONFIGURATION_NAVIGATION: NavigationItem[] = [
  { icon: 'integrations', labelKey: 'integrations', view: 'integrations' },
];
