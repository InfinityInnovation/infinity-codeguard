import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { createHmac } from 'node:crypto';
import { parseEnvironment } from '@codeguard/config';
import { REDIS } from '../infrastructure/redis/redis.constants';

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 10;
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly secret = parseEnvironment(process.env).SESSION_SECRET;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const address = request.ip || request.socket.remoteAddress || 'unknown';
    const digest = createHmac('sha256', this.secret).update(address).digest('hex');
    const key = `rate:auth:${digest}`;
    try {
      const raw = await this.redis.eval(INCREMENT_SCRIPT, 1, key, WINDOW_SECONDS);
      const [count, ttl] = this.parseResult(raw);
      response.setHeader('RateLimit-Limit', MAX_ATTEMPTS);
      response.setHeader('RateLimit-Remaining', Math.max(0, MAX_ATTEMPTS - count));
      response.setHeader('RateLimit-Reset', Math.max(0, ttl));
      if (count > MAX_ATTEMPTS) {
        throw new HttpException('Too many attempts', HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (error: unknown) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        throw error;
      }
      throw new ServiceUnavailableException('Authentication protection is unavailable');
    }
  }

  private parseResult(value: unknown): [number, number] {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      typeof value[0] !== 'number' ||
      typeof value[1] !== 'number'
    ) {
      throw new Error('Unexpected rate limiter response');
    }
    return [value[0], value[1]];
  }
}
