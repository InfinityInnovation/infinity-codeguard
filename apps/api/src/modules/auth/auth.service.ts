import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createSessionToken,
  digestSessionToken,
  hashPassword,
  verifyPassword,
} from '@codeguard/auth';
import { database } from '@codeguard/database';
import type { LoginInput, RegisterInput, SessionView } from '@codeguard/contracts';

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  async register(input: RegisterInput): Promise<{ session: SessionView; token: string }> {
    const passwordHash = await hashPassword(input.password);
    const { token, digest } = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    try {
      const user = await database.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email: input.email, displayName: input.displayName, passwordHash },
        });
        const organization = await tx.organization.create({
          data: { name: input.organizationName, slug: input.organizationSlug },
        });
        await tx.membership.create({
          data: { userId: created.id, organizationId: organization.id, role: 'OWNER' },
        });
        await tx.session.create({ data: { userId: created.id, digest, expiresAt } });
        return created;
      });
      return {
        token,
        session: {
          user: { id: user.id, email: user.email, displayName: user.displayName },
          expiresAt: expiresAt.toISOString(),
        },
      };
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')
        throw new ConflictException('Email or organization slug already exists');
      throw error;
    }
  }

  async login(input: LoginInput): Promise<{ session: SessionView; token: string }> {
    const user = await database.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(user.passwordHash, input.password)))
      throw new UnauthorizedException('Invalid credentials');
    const { token, digest } = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await database.session.create({ data: { userId: user.id, digest, expiresAt } });
    return {
      token,
      session: {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await database.session.updateMany({
      where: { digest: digestSessionToken(token), state: 'ACTIVE' },
      data: { state: 'REVOKED', revokedAt: new Date() },
    });
  }
}
