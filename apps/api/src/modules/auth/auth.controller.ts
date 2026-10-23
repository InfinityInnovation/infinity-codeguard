import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { LoginInput, RegisterInput, SessionView } from '@codeguard/contracts';
import { loginSchema, registerSchema } from '@codeguard/contracts';
import { AuthService } from './auth.service';

const COOKIE = 'cg_session';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() raw: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionView> {
    const input: RegisterInput = registerSchema.parse(raw);
    const result = await this.auth.register(input);
    this.setCookie(response, result.token);
    return result.session;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() raw: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionView> {
    const input: LoginInput = loginSchema.parse(raw);
    const result = await this.auth.login(input);
    this.setCookie(response, result.token);
    return result.session;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[COOKIE];
    const token = typeof value === 'string' ? value : undefined;
    await this.auth.logout(token);
    response.clearCookie(COOKIE, { path: '/' });
  }

  private setCookie(response: Response, token: string): void {
    response.cookie(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
  }
}
