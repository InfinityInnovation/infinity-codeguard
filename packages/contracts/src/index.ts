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

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
}

export interface SessionView {
  user: AuthenticatedUser;
  expiresAt: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; correlationId: string; details?: unknown };
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
}
