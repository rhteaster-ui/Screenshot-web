import {getConfig} from './config';
import {nodeStore} from './utils/node-files';
import {handle} from './handler';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Vercel/Node-only runtime: capture provider returns the binary to this handler,
// which stores it temporarily and returns preview/download URLs to the frontend.
const store = nodeStore(path.join(tmpdir(), 'folio-captures'));

export async function route(request: Request) {
  const config = getConfig(process.env);
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  return handle(request, store, config, clientIp);
}
