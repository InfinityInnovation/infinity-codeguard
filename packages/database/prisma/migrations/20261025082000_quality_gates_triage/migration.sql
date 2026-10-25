CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'CONFIRMED', 'RESOLVED', 'ACCEPTED_RISK', 'FALSE_POSITIVE');
CREATE TYPE "QualityGateStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

ALTER TABLE "Finding" ADD COLUMN "status" "FindingStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Scan"
  ADD COLUMN "criticalCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "highCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mediumCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lowCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "infoCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "qualityGate" "QualityGateStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "Scan" s SET
  "criticalCount" = (SELECT count(*) FROM "Finding" f WHERE f."scanId" = s.id AND f.severity = 'CRITICAL'),
  "highCount" = (SELECT count(*) FROM "Finding" f WHERE f."scanId" = s.id AND f.severity = 'HIGH'),
  "mediumCount" = (SELECT count(*) FROM "Finding" f WHERE f."scanId" = s.id AND f.severity = 'MEDIUM'),
  "lowCount" = (SELECT count(*) FROM "Finding" f WHERE f."scanId" = s.id AND f.severity = 'LOW'),
  "infoCount" = (SELECT count(*) FROM "Finding" f WHERE f."scanId" = s.id AND f.severity = 'INFO'),
  "qualityGate" = CASE
    WHEN s.status <> 'SUCCEEDED' THEN 'PENDING'::"QualityGateStatus"
    WHEN EXISTS (SELECT 1 FROM "Finding" f WHERE f."scanId" = s.id AND f.severity IN ('CRITICAL', 'HIGH')) THEN 'FAILED'::"QualityGateStatus"
    ELSE 'PASSED'::"QualityGateStatus"
  END;

CREATE INDEX "Finding_organizationId_status_idx" ON "Finding"("organizationId", "status");
