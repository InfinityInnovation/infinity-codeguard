import {
  findingSummarySchema,
  organizationSummarySchema,
  projectSummarySchema,
  repositorySummarySchema,
  scanSummarySchema,
} from '@codeguard/contracts';
import { z } from 'zod';

export const organizationsSchema = z.array(organizationSummarySchema);
export const projectsSchema = z.array(projectSummarySchema);
export const repositoriesSchema = z.array(repositorySummarySchema);
export const scansSchema = z.array(scanSummarySchema);
export const findingsSchema = z.array(findingSummarySchema);
export const noContentSchema = z.undefined();
