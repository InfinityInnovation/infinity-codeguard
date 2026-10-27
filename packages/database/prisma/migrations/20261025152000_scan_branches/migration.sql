ALTER TABLE "Scan"
ADD COLUMN "branch" VARCHAR(255) NOT NULL DEFAULT 'main';

UPDATE "Scan" AS scan
SET "branch" = repository."defaultBranch"
FROM "Repository" AS repository
WHERE scan."repositoryId" = repository."id";
