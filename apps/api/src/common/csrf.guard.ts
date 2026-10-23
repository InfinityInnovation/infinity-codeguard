import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { parseEnvironment } from '@codeguard/config';
import { readCookie, SESSION_COOKIE } from './request-context';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigin = parseEnvironment(process.env).WEB_ORIGIN;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    const origin = request.headers.origin;
    if (origin === this.allowedOrigin) return true;
    const hasSession = readCookie(request, SESSION_COOKIE) !== undefined;
    const isBrowserRequest =
      request.headers['sec-fetch-site'] !== undefined || origin !== undefined;
    if (hasSession || isBrowserRequest) {
      throw new ForbiddenException('Cross-site request rejected');
    }
    return true;
  }
}
