import type { NextRequest } from 'next/server';

const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://api:4000';
const trustedOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = new URL(`/api/v1/${path.map(encodeURIComponent).join('/')}`, apiOrigin);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.set('origin', trustedOrigin);

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer(),
    redirect: 'manual',
    cache: 'no-store',
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
