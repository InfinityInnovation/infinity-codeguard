import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const exec = promisify(execFile);
const allowedGitHosts = new Set(['github.com', 'gitlab.com', 'bitbucket.org', 'dev.azure.com']);
const semgrepOutputSchema = z.object({
  results: z.array(
    z.object({
      check_id: z.string(),
      path: z.string(),
      start: z.object({ line: z.number().int().positive() }),
      end: z.object({ line: z.number().int().positive() }),
      extra: z.object({
        message: z.string(),
        // Semgrep CE can emit both legacy levels (ERROR/WARNING/INFO) and
        // policy levels (CRITICAL/HIGH/MEDIUM/LOW). Keep parsing forward-compatible;
        // mapSeverity normalizes every value before persistence.
        severity: z.string().min(1).max(50),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    }),
  ),
  errors: z.array(z.unknown()).optional(),
});

export type ParsedFinding = {
  ruleId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  message: string;
  filePath: string;
  startLine: number;
  endLine: number;
  fingerprint: string;
};

export function assertSafeRepositoryUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !allowedGitHosts.has(url.hostname.toLowerCase())
  ) {
    throw new Error('Repository host is not allowed for isolated scanning');
  }
  return url;
}

export function parseSemgrepOutput(raw: string, checkoutDirectory: string): ParsedFinding[] {
  const output = semgrepOutputSchema.parse(JSON.parse(raw));
  return output.results.map((result) => {
    const filePath = relative(checkoutDirectory, result.path).replaceAll('\\', '/');
    const impact = result.extra.metadata?.impact;
    const severity = mapSeverity(typeof impact === 'string' ? impact : result.extra.severity);
    const fingerprint = createHash('sha256')
      .update(`${result.check_id}\0${filePath}\0${result.start.line}\0${result.extra.message}`)
      .digest('hex');
    return {
      ruleId: result.check_id.slice(0, 255),
      severity,
      message: result.extra.message.slice(0, 2000),
      filePath: filePath.slice(0, 1000),
      startLine: result.start.line,
      endLine: result.end.line,
      fingerprint,
    };
  });
}

export async function runSemgrepScan(remoteUrl: string, branch: string) {
  const safeUrl = assertSafeRepositoryUrl(remoteUrl);
  const workspace = await mkdtemp(join(tmpdir(), 'codeguard-scan-'));
  const checkout = join(workspace, 'repository');
  const outputFile = join(workspace, 'semgrep.json');
  const environment = {
    ...process.env,
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'protocol.file.allow',
    GIT_CONFIG_VALUE_0: 'never',
    GIT_CONFIG_KEY_1: 'credential.helper',
    GIT_CONFIG_VALUE_1: '',
    GIT_TERMINAL_PROMPT: '0',
  };
  try {
    await exec(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--single-branch',
        '--branch',
        branch,
        '--',
        safeUrl.href,
        checkout,
      ],
      { env: environment, timeout: 120_000, maxBuffer: 2_000_000 },
    );
    const { stdout: commitSha } = await exec('git', ['-C', checkout, 'rev-parse', 'HEAD'], {
      env: environment,
      timeout: 10_000,
    });
    await exec(
      'semgrep',
      [
        'scan',
        '--config',
        'p/default',
        '--json',
        '--quiet',
        '--metrics',
        'off',
        '--output',
        outputFile,
        checkout,
      ],
      { env: environment, timeout: 600_000, maxBuffer: 2_000_000 },
    );
    return {
      commitSha: commitSha.trim(),
      findings: parseSemgrepOutput(await readFile(outputFile, 'utf8'), checkout),
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

function mapSeverity(raw: string): ParsedFinding['severity'] {
  switch (raw.toUpperCase()) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
    case 'ERROR':
      return 'HIGH';
    case 'MEDIUM':
    case 'WARNING':
      return 'MEDIUM';
    case 'LOW':
      return 'LOW';
    default:
      return 'INFO';
  }
}
