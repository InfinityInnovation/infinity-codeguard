import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CsrfGuard } from '../src/common/csrf.guard';
import { SessionGuard } from '../src/common/session.guard';
import { AuthRateLimitGuard } from '../src/common/auth-rate-limit.guard';
import type { AuthService } from '../src/modules/auth/auth.service';

function contextFor(request: Partial<Request>, response: Partial<Response> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters';
    process.env.WEB_ORIGIN = 'https://codeguard.example';
  });

  it('rejects cross-site state changes carrying a session cookie', () => {
    const guard = new CsrfGuard();
    const context = contextFor({
      method: 'POST',
      cookies: { cg_session: 'secret' },
      headers: { origin: 'https://attacker.example' },
    });
    expect(() => guard.canActivate(context)).toThrow('Cross-site request rejected');
  });

  it('accepts state changes from the configured web origin', () => {
    const guard = new CsrfGuard();
    const context = contextFor({
      method: 'POST',
      cookies: { cg_session: 'secret' },
      headers: { origin: 'https://codeguard.example' },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects login CSRF before a session exists', () => {
    const guard = new CsrfGuard();
    const context = contextFor({
      method: 'POST',
      cookies: {},
      headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    });
    expect(() => guard.canActivate(context)).toThrow('Cross-site request rejected');
  });
});

describe('AuthRateLimitGuard', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters';
    process.env.WEB_ORIGIN = 'https://codeguard.example';
  });

  it('rejects attempts above the distributed limit', async () => {
    const redis = { eval: vi.fn().mockResolvedValue([11, 42]) } as unknown as Redis;
    const setHeader = vi.fn();
    const guard = new AuthRateLimitGuard(redis);
    const context = contextFor(
      { ip: '192.0.2.10', socket: { remoteAddress: '192.0.2.10' } as never },
      { setHeader } as unknown as Partial<Response>,
    );
    await expect(guard.canActivate(context)).rejects.toThrow('Too many attempts');
    expect(setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 0);
  });

  it('fails closed when Redis is unavailable', async () => {
    const redis = { eval: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as Redis;
    const guard = new AuthRateLimitGuard(redis);
    await expect(
      guard.canActivate(
        contextFor({ ip: '192.0.2.10', socket: { remoteAddress: '192.0.2.10' } as never }, {
          setHeader: vi.fn(),
        } as unknown as Partial<Response>),
      ),
    ).rejects.toThrow('Authentication protection is unavailable');
  });
});

describe('SessionGuard', () => {
  it('rejects a request without a session cookie', async () => {
    const authenticate = vi.fn();
    const auth = { authenticate } as unknown as AuthService;
    const guard = new SessionGuard(auth);
    await expect(guard.canActivate(contextFor({ cookies: {} }))).rejects.toThrow(
      'Authentication required',
    );
    expect(authenticate).not.toHaveBeenCalled();
  });
});
