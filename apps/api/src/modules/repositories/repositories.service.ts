import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { database } from '@codeguard/database';
import type { CreateRepositoryInput, RepositorySummary } from '@codeguard/contracts';

@Injectable()
export class RepositoriesService {
  async list(organizationId: string, projectId: string): Promise<RepositorySummary[]> {
    await this.assertProject(organizationId, projectId);
    const repositories = await database.repository.findMany({
      where: { organizationId, projectId },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        name: true,
        remoteUrl: true,
        defaultBranch: true,
        provider: true,
        createdAt: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return repositories.map((repository) => ({
      ...repository,
      createdAt: repository.createdAt.toISOString(),
    }));
  }

  async create(
    organizationId: string,
    projectId: string,
    actorId: string,
    input: CreateRepositoryInput,
    correlationId: string,
  ): Promise<RepositorySummary> {
    await this.assertProject(organizationId, projectId);
    try {
      const repository = await database.$transaction(async (tx) => {
        const created = await tx.repository.create({
          data: { organizationId, projectId, ...input },
          select: {
            id: true,
            organizationId: true,
            projectId: true,
            name: true,
            remoteUrl: true,
            defaultBranch: true,
            provider: true,
            createdAt: true,
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId,
            actorId,
            action: 'repository.created',
            targetType: 'Repository',
            targetId: created.id,
            correlationId,
            metadata: { projectId, provider: created.provider },
          },
        });
        return created;
      });
      return { ...repository, createdAt: repository.createdAt.toISOString() };
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')
        throw new ConflictException('Repository URL already exists in this organization');
      throw error;
    }
  }

  private async assertProject(organizationId: string, projectId: string): Promise<void> {
    const project = await database.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
