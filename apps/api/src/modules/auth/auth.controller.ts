import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type {
  AuthenticatedUser,
  LoginInput,
  RegisterInput,
  SessionView,
} from '@codeguard/contracts';
import { loginSchema, registerSchema } from '@codeguard/contracts';
import { AuthService } from './auth.service';
import { correlationId, readCookie, SESSION_COOKIE } from '../../common/request-context';
import { SessionGuard } from '../../common/session.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthRateLimitGuard } from '../../common/auth-rate-limit.guard';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  async register(
    @Body() raw: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionView> {
    const input: RegisterInput = registerSchema.parse(raw);
    const result = await this.auth.register(input, correlationId(request));
    this.setCookie(response, result.token);
    return result.session;
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  async login(
    @Body() raw: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionView> {
    const input: LoginInput = loginSchema.parse(raw);
    const result = await this.auth.login(input, correlationId(request));
    this.setCookie(response, result.token);
    return result.session;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = readCookie(request, SESSION_COOKIE);
    await this.auth.logout(token, correlationId(request));
    response.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('session')
  @UseGuards(SessionGuard)
  session(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private setCookie(response: Response, token: string): void {
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
  }
}
