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
  slug: slugSchema,
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
