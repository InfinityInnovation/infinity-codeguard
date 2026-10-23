import { apiErrorSchema } from '@codeguard/contracts';
import type { z } from 'zod';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiRequest<T>(path: string, schema: z.ZodType<T>, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('content-type', 'application/json');
  const response = await fetch(`/api/v1${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    const body = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiClientError(
      body.success ? body.data.error.message : `Request failed (${response.status})`,
      response.status,
      body.success ? body.data.error.correlationId : undefined,
    );
  }
  if (response.status === 204) return schema.parse(undefined);
  return schema.parse(await response.json());
}
