import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { FindingSource } from '@codeguard/contracts';
import { sourceLineSchema } from '@codeguard/contracts';

const MAX_SOURCE_BYTES = 256_000;
const SECRET_PATTERN = /(token|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi;

export function sanitizeSubmittedPreview(value: unknown): FindingSource['lines'] | undefined {
  if (value === undefined) return undefined;
  const parsed = sourceLineSchema.array().max(11).safeParse(value);
  if (!parsed.success) return undefined;
  return parsed.data.map((line) => ({
    ...line,
    content:
      /secret|password|token|authorization|api[_-]?key|private[_-]?key|BEGIN .* PRIVATE KEY/iu.test(
        line.content,
      )
        ? '[contenu masqué : secret possible]'
        : line.content.slice(0, 500),
  }));
}

export function githubRawUrl(remoteUrl: string, commitSha: string, filePath: string): URL {
  const remote = new URL(remoteUrl);
  const segments = remote.pathname
    .replace(/^\//, '')
    .replace(/\.git$/, '')
    .split('/');
  const cleanPath = filePath.replaceAll('\\', '/').split('/');
  if (
    remote.protocol !== 'https:' ||
    remote.hostname.toLowerCase() !== 'github.com' ||
    remote.username ||
    remote.password ||
    remote.port ||
    segments.length !== 2 ||
    !/^[a-f0-9]{40}$/i.test(commitSha) ||
    cleanPath.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new BadRequestException('Source preview is unavailable for this repository');
  }
  const encoded = [...segments, commitSha, ...cleanPath].map(encodeURIComponent).join('/');
  return new URL(`https://raw.githubusercontent.com/${encoded}`);
}

export function sourceWindow(
  source: string,
  filePath: string,
  commitSha: string,
  sourceUrl: string,
  startLine: number,
  endLine: number,
): FindingSource {
  const allLines = source.split(/\r?\n/);
  const first = Math.max(1, startLine - 5);
  const last = Math.min(allLines.length, endLine + 5, first + 24);
  return {
    filePath,
    commitSha,
    sourceUrl,
    lines: allLines.slice(first - 1, last).map((content, index) => {
      const number = first + index;
      return {
        number,
        content: content.replace(SECRET_PATTERN, '$1=[REDACTED]'),
        highlighted: number >= startLine && number <= endLine,
      };
    }),
  };
}

export async function loadFindingSource(input: {
  remoteUrl: string;
  commitSha: string;
  filePath: string;
  startLine: number;
  endLine: number;
}): Promise<FindingSource> {
  const url = githubRawUrl(input.remoteUrl, input.commitSha, input.filePath);
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (!response.ok || contentLength > MAX_SOURCE_BYTES)
    throw new BadGatewayException('Unable to load the source preview');
  const source = await response.text();
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES)
    throw new BadGatewayException('Source preview is too large');
  return sourceWindow(
    source,
    input.filePath,
    input.commitSha,
    url.href,
    input.startLine,
    input.endLine,
  );
}
