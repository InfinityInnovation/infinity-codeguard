import { z } from 'zod';

export const SCAN_QUEUE = 'scan-orchestration';
export const scanJobSchema = z.object({
  scanId: z.string().uuid(),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  repositoryId: z.string().uuid(),
});
export type ScanJob = z.infer<typeof scanJobSchema>;
