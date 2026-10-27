CREATE TABLE "AnalysisToken" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "prefix" CHAR(12) NOT NULL,
  "digest" CHAR(64) NOT NULL,
  "lastUsedAt" TIMESTAMPTZ(6),
  "expiresAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalysisToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalysisToken_digest_key" ON "AnalysisToken"("digest");
CREATE INDEX "AnalysisToken_organizationId_projectId_revokedAt_idx" ON "AnalysisToken"("organizationId", "projectId", "revokedAt");
ALTER TABLE "AnalysisToken" ADD CONSTRAINT "AnalysisToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisToken" ADD CONSTRAINT "AnalysisToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
