export const COMPREHENSIVE_CONFIGS = [
  'p/default',
  'p/secrets',
  'p/owasp-top-ten',
  'p/terraform',
  'p/dockerfile',
] as const;

export type ScannerFinding = {
  ruleId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  message: string;
  filePath: string;
  startLine: number;
  endLine: number;
  sourcePreview?: Array<{ number: number; content: string; highlighted: boolean }>;
};

export function sourcePreviewWindow(
  source: string,
  startLine: number,
  endLine: number,
): NonNullable<ScannerFinding['sourcePreview']> {
  const lines = source.split(/\r?\n/u);
  const first = Math.max(1, startLine - 5);
  const last = Math.min(lines.length, endLine + 5, first + 10);
  return lines.slice(first - 1, last).map((line, index) => ({
    number: first + index,
    content: redactSourceLine(line).slice(0, 500),
    highlighted: first + index >= startLine && first + index <= endLine,
  }));
}

export function redactSourceLine(line: string): string {
  if (
    /secret|password|token|authorization|api[_-]?key|private[_-]?key|BEGIN .* PRIVATE KEY/iu.test(
      line,
    )
  ) {
    return '[contenu masqué : secret possible]';
  }
  if (/["'][A-Za-z0-9+/_=-]{32,}["']/u.test(line))
    return '[contenu masqué : valeur sensible possible]';
  return line;
}

export async function readSourcePreview(
  baseDirectory: string,
  filePath: string,
  startLine: number,
  endLine: number,
): Promise<ReturnType<typeof sourcePreviewWindow> | undefined> {
  if (!filePath || isAbsolute(filePath) || filePath.split('/').includes('..')) return undefined;
  try {
    const root = await realpath(baseDirectory);
    const file = await realpath(resolve(baseDirectory, filePath));
    const pathWithinRoot = relative(root, file);
    if (!pathWithinRoot || isAbsolute(pathWithinRoot) || pathWithinRoot.split('/').includes('..'))
      return undefined;
    const details = await stat(file);
    if (!details.isFile() || details.size > 256_000) return undefined;
    return sourcePreviewWindow(await readFile(file, 'utf8'), startLine, endLine);
  } catch {
    return undefined;
  }
}

export function parseProperties(contents: string): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const sourceLine of contents.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    properties[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return properties;
}

export function validateRepositoryId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value) &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  ) {
    throw new Error(
      'codeguard.repository.id doit être l’UUID du dépôt ou la clé du projet CodeGuard.',
    );
  }
  return value;
}

export function normalizeSeverity(value: string): ScannerFinding['severity'] {
  switch (value.toUpperCase()) {
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

export function deduplicateFindings(findings: ScannerFinding[]): ScannerFinding[] {
  return [
    ...new Map(
      findings.map((finding) => [
        `${finding.ruleId}\0${finding.filePath}\0${finding.startLine}\0${finding.message}`,
        finding,
      ]),
    ).values(),
  ];
}
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
