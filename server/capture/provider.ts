import type {CaptureProvider, Config} from './model';
import {CaptureError} from './errors';
import {playwrightProvider} from './providers/playwright';

// FOLIO captures locally with Playwright. No external screenshot provider is used.
export function createProvider(config: Config): CaptureProvider {
  if (config.provider === 'playwright') return playwrightProvider(config);
  throw new CaptureError('SERVICE_UNAVAILABLE', 'Mesin capture lokal belum tersedia.', 503);
}
