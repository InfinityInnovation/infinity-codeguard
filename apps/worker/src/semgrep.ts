import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { githubInstallationToken } from './github.js';

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

export type ScanProfile =
  | 'COMPREHENSIVE'
  | 'STANDARD'
  | 'SECRETS'
  | 'OWASP_TOP_TEN'
  | 'INFRASTRUCTURE_AS_CODE';

export function configsForProfile(profile: ScanProfile): string[] {
  switch (profile) {
    case 'COMPREHENSIVE':
      return ['p/default', 'p/secrets', 'p/owasp-top-ten', 'p/terraform', 'p/dockerfile'];
    case 'SECRETS':
      return ['p/secrets'];
    case 'OWASP_TOP_TEN':
      return ['p/owasp-top-ten'];
    case 'INFRASTRUCTURE_AS_CODE':
      return ['p/terraform', 'p/dockerfile'];
    default:
      return ['p/default'];
  }
}

export function normalizeCloneError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : '';
  if (detail.includes('could not read Username') || detail.includes('Repository not found')) {
    return new Error(
      'Dépôt inaccessible : vérifiez que le dépôt est public, que l’URL et la branche sont correctes, ou configurez une connexion GitHub autorisée pour un dépôt privé.',
    );
  }
  if (detail.includes('Remote branch') && detail.includes('not found')) {
    return new Error(
      'Branche introuvable : vérifiez la branche par défaut configurée pour ce dépôt.',
    );
  }
  return new Error(
    'Impossible de cloner le dépôt. Vérifiez son URL, sa branche et son accessibilité.',
  );
}

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
  const findings = output.results.map((result) => {
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
  return [...new Map(findings.map((finding) => [finding.fingerprint, finding])).values()];
}

export async function runSemgrepScan(
  remoteUrl: string,
  branch: string,
  profile: ScanProfile,
  organizationId: string,
) {
  const safeUrl = assertSafeRepositoryUrl(remoteUrl);
  const workspace = await mkdtemp(join(tmpdir(), 'codeguard-scan-'));
  const checkout = join(workspace, 'repository');
  const outputFile = join(workspace, 'semgrep.json');
  const askPassFile = join(workspace, 'git-askpass.sh');
  try {
    const githubToken = await githubInstallationToken(organizationId, safeUrl);
    if (githubToken) {
      await writeFile(
        askPassFile,
        '#!/bin/sh\ncase "$1" in *Username*) printf "%s\\n" x-access-token ;; *) printf "%s\\n" "$CODEGUARD_GIT_TOKEN" ;; esac\n',
        'utf8',
      );
      await chmod(askPassFile, 0o700);
    }
    const environment = {
      ...process.env,
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'protocol.file.allow',
      GIT_CONFIG_VALUE_0: 'never',
      GIT_CONFIG_KEY_1: 'credential.helper',
      GIT_CONFIG_VALUE_1: '',
      GIT_TERMINAL_PROMPT: '0',
      ...(githubToken ? { GIT_ASKPASS: askPassFile, CODEGUARD_GIT_TOKEN: githubToken } : {}),
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
    } catch (error: unknown) {
      throw normalizeCloneError(error);
    }
    const { stdout: commitSha } = await exec('git', ['-C', checkout, 'rev-parse', 'HEAD'], {
      env: environment,
      timeout: 10_000,
    });
    const configs = configsForProfile(profile).flatMap((config) => ['--config', config]);
    await exec(
      'semgrep',
      [
        'scan',
        ...configs,
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
