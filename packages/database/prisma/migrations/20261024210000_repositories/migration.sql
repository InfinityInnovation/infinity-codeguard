CREATE TYPE "RepositoryProvider" AS ENUM ('GITHUB', 'GITLAB', 'BITBUCKET', 'AZURE_DEVOPS', 'OTHER');

CREATE TABLE "Repository" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "remoteUrl" VARCHAR(500) NOT NULL,
    "defaultBranch" VARCHAR(255) NOT NULL DEFAULT 'main',
    "provider" "RepositoryProvider" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Repository_organizationId_remoteUrl_key" ON "Repository"("organizationId", "remoteUrl");
CREATE INDEX "Repository_projectId_createdAt_idx" ON "Repository"("projectId", "createdAt");
CREATE INDEX "Repository_organizationId_createdAt_idx" ON "Repository"("organizationId", "createdAt");
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
