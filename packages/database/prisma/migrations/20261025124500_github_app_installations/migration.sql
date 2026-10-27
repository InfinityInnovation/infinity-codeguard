CREATE TABLE "GitHubInstallation" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "installationId" BIGINT NOT NULL,
  "accountLogin" VARCHAR(100) NOT NULL,
  "repositorySelection" VARCHAR(20) NOT NULL,
  "suspendedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitHubInstallation_organizationId_key" ON "GitHubInstallation"("organizationId");
CREATE UNIQUE INDEX "GitHubInstallation_installationId_key" ON "GitHubInstallation"("installationId");
CREATE INDEX "GitHubInstallation_organizationId_suspendedAt_idx" ON "GitHubInstallation"("organizationId", "suspendedAt");
ALTER TABLE "GitHubInstallation" ADD CONSTRAINT "GitHubInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
