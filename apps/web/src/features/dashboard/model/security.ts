export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

export const SEVERITY_COUNT_FIELDS = {
  CRITICAL: 'criticalCount',
  HIGH: 'highCount',
  MEDIUM: 'mediumCount',
  LOW: 'lowCount',
  INFO: 'infoCount',
} as const;
