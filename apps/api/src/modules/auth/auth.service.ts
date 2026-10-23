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
  async register(
    input: RegisterInput,
    correlationId: string,
  ): Promise<{ session: SessionView; token: string }> {
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
        await tx.auditEvent.create({
          data: {
            organizationId: organization.id,
            actorId: created.id,
            action: 'auth.registered',
            targetType: 'User',
            targetId: created.id,
            correlationId,
          },
        });
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

  async login(
    input: LoginInput,
    correlationId: string,
  ): Promise<{ session: SessionView; token: string }> {
    const user = await database.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(user.passwordHash, input.password)))
      throw new UnauthorizedException('Invalid credentials');
    const { token, digest } = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await database.$transaction([
      database.session.create({ data: { userId: user.id, digest, expiresAt } }),
      database.auditEvent.create({
        data: {
          actorId: user.id,
          action: 'auth.login.succeeded',
          targetType: 'User',
          targetId: user.id,
          correlationId,
        },
      }),
    ]);
    return {
      token,
      session: {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async authenticate(token: string): Promise<{
    id: string;
    user: { id: string; email: string; displayName: string };
  } | null> {
    const session = await database.session.findFirst({
      where: { digest: digestSessionToken(token), state: 'ACTIVE', expiresAt: { gt: new Date() } },
      select: {
        id: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
    });
    return session;
  }

  async logout(token: string | undefined, correlationId: string): Promise<void> {
    if (!token) return;
    await database.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { digest: digestSessionToken(token) },
        select: { id: true, userId: true, state: true },
      });
      if (!session || session.state !== 'ACTIVE') return;
      await tx.session.update({
        where: { id: session.id },
        data: { state: 'REVOKED', revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          actorId: session.userId,
          action: 'auth.logout',
          targetType: 'Session',
          targetId: session.id,
          correlationId,
        },
      });
    });
  }
}
