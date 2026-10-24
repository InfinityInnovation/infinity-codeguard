import { ConflictException, Injectable } from '@nestjs/common';
import { database } from '@codeguard/database';
import type { CreateProjectInput, ProjectSummary } from '@codeguard/contracts';
import { randomBytes } from 'node:crypto';

export function generateProjectSlug(name: string, suffix = randomBytes(3).toString('hex')): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 55)
    .replace(/-$/g, '');
  return `${base || 'project'}-${suffix}`;
}

@Injectable()
export class ProjectsService {
  async list(organizationId: string): Promise<ProjectSummary[]> {
    const projects = await database.project.findMany({
      where: { organizationId },
      select: { id: true, organizationId: true, name: true, slug: true, createdAt: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return projects.map((project) => ({
      ...project,
      createdAt: project.createdAt.toISOString(),
    }));
  }

  async create(
    organizationId: string,
    actorId: string,
    input: CreateProjectInput,
    correlationId: string,
  ): Promise<ProjectSummary> {
    try {
      const project = await database.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: { organizationId, name: input.name, slug: generateProjectSlug(input.name) },
          select: { id: true, organizationId: true, name: true, slug: true, createdAt: true },
        });
        await tx.auditEvent.create({
          data: {
            organizationId,
            actorId,
            action: 'project.created',
            targetType: 'Project',
            targetId: created.id,
            correlationId,
            metadata: { slug: created.slug },
          },
        });
        return created;
      });
      return { ...project, createdAt: project.createdAt.toISOString() };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Could not allocate a unique project identifier');
      }
      throw error;
    }
  }
}
