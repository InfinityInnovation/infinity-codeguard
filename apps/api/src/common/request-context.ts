import type { Request } from 'express';
import type { AuthenticatedUser } from '@codeguard/contracts';

export const SESSION_COOKIE = 'cg_session';

export interface AuthenticatedRequest extends Request {
  authenticatedUser: AuthenticatedUser;
  sessionId: string;
}

export function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' ? value : undefined;
}

export function correlationId(request: Request): string {
  const value = request.headers['x-correlation-id'];
  return typeof value === 'string' && value.length <= 100 ? value : crypto.randomUUID();
}
