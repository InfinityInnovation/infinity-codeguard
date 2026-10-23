import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../modules/auth/auth.service';
import { readCookie, SESSION_COOKIE } from './request-context';
import type { AuthenticatedRequest } from './request-context';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) throw new UnauthorizedException('Authentication required');
    const session = await this.auth.authenticate(token);
    if (!session) throw new UnauthorizedException('Session is invalid or expired');
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.authenticatedUser = session.user;
    authenticatedRequest.sessionId = session.id;
    return true;
  }
}
