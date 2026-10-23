import { z } from 'zod';

export const SCAN_QUEUE = 'scan-orchestration';
export const scanJobSchema = z.object({
  scanId: z.string().uuid(),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  repositoryUrl: z.string().url(),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
  requestedScannerIds: z.array(z.string().min(1)).min(1),
});
export type ScanJob = z.infer<typeof scanJobSchema>;
