CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "FindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

CREATE TABLE "Scan" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "repositoryId" UUID NOT NULL,
  "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
  "scanner" VARCHAR(40) NOT NULL DEFAULT 'semgrep',
  "commitSha" CHAR(40),
  "errorMessage" VARCHAR(500),
  "findingCount" INTEGER NOT NULL DEFAULT 0,
  "queuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMPTZ(6),
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "Scan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Scan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Scan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Scan_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Finding" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "scanId" UUID NOT NULL,
  "ruleId" VARCHAR(255) NOT NULL,
  "severity" "FindingSeverity" NOT NULL,
  "message" VARCHAR(2000) NOT NULL,
  "filePath" VARCHAR(1000) NOT NULL,
  "startLine" INTEGER NOT NULL,
  "endLine" INTEGER NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Finding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Finding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Finding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Finding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Scan_organizationId_queuedAt_idx" ON "Scan"("organizationId", "queuedAt");
CREATE INDEX "Scan_projectId_queuedAt_idx" ON "Scan"("projectId", "queuedAt");
CREATE INDEX "Scan_repositoryId_queuedAt_idx" ON "Scan"("repositoryId", "queuedAt");
CREATE UNIQUE INDEX "Finding_scanId_fingerprint_key" ON "Finding"("scanId", "fingerprint");
CREATE INDEX "Finding_organizationId_severity_idx" ON "Finding"("organizationId", "severity");
CREATE INDEX "Finding_projectId_createdAt_idx" ON "Finding"("projectId", "createdAt");
