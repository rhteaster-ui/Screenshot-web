import {getConfig} from './config';
import {r2Store} from './utils/files';
import {nodeStore} from './utils/node-files';
import {handle} from './handler';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Standalone node fallback store for Vercel / Standard Node serverless runtimes
const fallbackNodeStore = nodeStore(path.join(tmpdir(), 'folio-captures'));

export async function route(request: Request) {
  let bindings: (Record<string, unknown> & { CAPTURE_FILES?: R2Bucket }) | undefined;
  try {
    const cf = await import('cloudflare:workers');
    bindings = cf.env as unknown as Record<string, unknown> & { CAPTURE_FILES?: R2Bucket };
  } catch {
    // Standard Node.js / Vercel Serverless environment
    bindings = undefined;
  }

  const store = bindings?.CAPTURE_FILES ? r2Store(bindings.CAPTURE_FILES) : fallbackNodeStore;
  const config = getConfig(bindings || process.env);
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                   request.headers.get('cf-connecting-ip') ||
                   'local';

  return handle(request, store, config, clientIp);
}
