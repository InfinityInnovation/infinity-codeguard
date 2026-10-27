#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  COMPREHENSIVE_CONFIGS,
  deduplicateFindings,
  normalizeSeverity,
  parseProperties,
  readSourcePreview,
  validateRepositoryId,
} from './scanner.js';

const exec = promisify(execFile);
async function main(): Promise<void> {
  const token = requiredEnvironment('CG_TOKEN');
  const baseDirectory = resolve(process.env.CG_PROJECT_BASE_DIR ?? '.');
  const properties = await projectProperties(baseDirectory);
  const host = (
    process.env.CG_HOST_URL ??
    properties['codeguard.host.url'] ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
  const repositoryId = validateRepositoryId(
    process.env.CG_REPOSITORY_ID ?? properties['codeguard.repository.id'],
  );
  const profile = 'COMPREHENSIVE' as const;
  const branch = process.env.CG_BRANCH || (await git(baseDirectory, ['branch', '--show-current']));
  if (!branch)
    throw new Error('Branche introuvable : définissez CG_BRANCH pour un checkout détaché.');
  const commitSha = await git(baseDirectory, ['rev-parse', 'HEAD']);
  const workspace = await mkdtemp(join(tmpdir(), 'codeguard-cli-'));
  const output = join(workspace, 'semgrep.json');
  try {
    console.log(`Infinity CodeGuard · ${profile} · ${branch}@${commitSha.slice(0, 12)}`);
    const configArguments = COMPREHENSIVE_CONFIGS.flatMap((config) => ['--config', config]);
    await exec(
      'semgrep',
      [
        'scan',
        ...configArguments,
        '--json',
        '--quiet',
        '--metrics',
        'off',
        '--output',
        output,
        baseDirectory,
      ],
      { timeout: 600_000, maxBuffer: 2_000_000 },
    );
    const report = JSON.parse(await readFile(output, 'utf8')) as SemgrepReport;
    const parsedFindings = [];
    let previewBudget = 1_500_000;
    for (const result of report.results ?? []) {
      const filePath = relative(baseDirectory, resolve(result.path))
        .replaceAll('\\', '/')
        .slice(0, 1000);
      const preview =
        previewBudget > 0
          ? await readSourcePreview(baseDirectory, filePath, result.start.line, result.end.line)
          : undefined;
      const previewSize = preview ? Buffer.byteLength(JSON.stringify(preview), 'utf8') : 0;
      const includedPreview = previewSize <= previewBudget ? preview : undefined;
      if (includedPreview) previewBudget -= previewSize;
      parsedFindings.push({
        ruleId: result.check_id.slice(0, 255),
        severity: normalizeSeverity(result.extra.metadata?.impact ?? result.extra.severity),
        message: result.extra.message.slice(0, 2000),
        filePath,
        startLine: result.start.line,
        endLine: result.end.line,
        sourcePreview: includedPreview,
      });
    }
    const findings = deduplicateFindings(parsedFindings);
    const version = (await exec('semgrep', ['--version'], { timeout: 10_000 })).stdout.trim();
    const response = await fetch(`${host}/api/v1/scanner/analyses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        repositoryId,
        branch,
        commitSha,
        profile,
        scannerVersion: version,
        findings,
      }),
    });
    if (!response.ok)
      throw new Error(`Upload rejected (${response.status}): ${await response.text()}`);
    const scan = (await response.json()) as {
      id: string;
      qualityGate: string;
      findingCount: number;
    };
    console.log(
      `Analyse ${scan.id} envoyée · ${scan.findingCount} problème(s) · Quality Gate ${scan.qualityGate}`,
    );
    if (scan.qualityGate === 'FAILED') process.exitCode = 2;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function projectProperties(baseDirectory: string): Promise<Record<string, string>> {
  try {
    return parseProperties(await readFile(join(baseDirectory, 'codeguard.properties'), 'utf8'));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

async function git(directory: string, args: string[]): Promise<string> {
  const safeDirectory = process.env.CG_GIT_SAFE_DIRECTORY;
  const gitArgs = safeDirectory ? ['-c', `safe.directory=${safeDirectory}`] : [];
  return (
    await exec('git', [...gitArgs, '-C', directory, ...args], { timeout: 10_000 })
  ).stdout.trim();
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

type SemgrepReport = {
  results?: Array<{
    check_id: string;
    path: string;
    start: { line: number };
    end: { line: number };
    extra: { message: string; severity: string; metadata?: { impact?: string } };
  }>;
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Scanner failed');
  process.exitCode = 1;
});
