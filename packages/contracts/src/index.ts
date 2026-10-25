import { z } from 'zod';

export const identifierSchema = z.string().uuid();
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(2)
  .max(64);

export const roleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
export type Role = z.infer<typeof roleSchema>;

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(100),
  organizationName: z.string().trim().min(2).max(100),
  organizationSlug: slugSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export type LoginInput = z.infer<typeof loginSchema>;

export const authenticatedUserSchema = z.object({
  id: identifierSchema,
  email: emailSchema,
  displayName: z.string(),
});
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const sessionViewSchema = z.object({
  user: authenticatedUserSchema,
  expiresAt: z.string().datetime(),
});
export type SessionView = z.infer<typeof sessionViewSchema>;

export const organizationSummarySchema = z.object({
  id: identifierSchema,
  name: z.string(),
  slug: slugSchema,
  role: roleSchema,
});
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const projectSummarySchema = z.object({
  id: identifierSchema,
  organizationId: identifierSchema,
  name: z.string(),
  slug: slugSchema,
  createdAt: z.string().datetime(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const repositoryProviderSchema = z.enum([
  'GITHUB',
  'GITLAB',
  'BITBUCKET',
  'AZURE_DEVOPS',
  'OTHER',
]);
export const createRepositorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  remoteUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((url) => url.startsWith('https://'), 'HTTPS is required'),
  defaultBranch: z.string().trim().min(1).max(255),
  provider: repositoryProviderSchema,
});
export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;

export const repositorySummarySchema = z.object({
  id: identifierSchema,
  organizationId: identifierSchema,
  projectId: identifierSchema,
  name: z.string(),
  remoteUrl: z.string().url(),
  defaultBranch: z.string(),
  provider: repositoryProviderSchema,
  createdAt: z.string().datetime(),
});
export type RepositorySummary = z.infer<typeof repositorySummarySchema>;

export const scanStatusSchema = z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED']);
export const findingSeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
export const findingStatusSchema = z.enum([
  'OPEN',
  'CONFIRMED',
  'RESOLVED',
  'ACCEPTED_RISK',
  'FALSE_POSITIVE',
]);
export const qualityGateStatusSchema = z.enum(['PENDING', 'PASSED', 'FAILED']);
export const scanSummarySchema = z.object({
  id: identifierSchema,
  organizationId: identifierSchema,
  projectId: identifierSchema,
  repositoryId: identifierSchema,
  repositoryName: z.string(),
  status: scanStatusSchema,
  scanner: z.string(),
  commitSha: z.string().nullable(),
  findingCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  mediumCount: z.number().int().nonnegative(),
  lowCount: z.number().int().nonnegative(),
  infoCount: z.number().int().nonnegative(),
  qualityGate: qualityGateStatusSchema,
  errorMessage: z.string().nullable(),
  queuedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});
export type ScanSummary = z.infer<typeof scanSummarySchema>;

export const findingSummarySchema = z.object({
  id: identifierSchema,
  scanId: identifierSchema,
  ruleId: z.string(),
  severity: findingSeveritySchema,
  status: findingStatusSchema,
  message: z.string(),
  filePath: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
});
export type FindingSummary = z.infer<typeof findingSummarySchema>;
export const updateFindingStatusSchema = z.object({ status: findingStatusSchema });

export const sourceLineSchema = z.object({
  number: z.number().int().positive(),
  content: z.string(),
  highlighted: z.boolean(),
});
export const findingSourceSchema = z.object({
  filePath: z.string(),
  commitSha: z.string(),
  sourceUrl: z.string().url(),
  lines: z.array(sourceLineSchema).max(25),
});
export type FindingSource = z.infer<typeof findingSourceSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlationId: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
}
