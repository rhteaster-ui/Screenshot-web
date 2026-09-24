import type { CaptureProvider, Config } from './model';
import { ssweb } from './providers/ssweb';
import { CaptureError } from './errors';
import {remoteProvider} from './providers/remote';
export function createProvider(config: Config): CaptureProvider {
  if(config.provider==='ssweb')return ssweb(config);
  if(config.provider==='remote')return remoteProvider(config);
  throw new CaptureError('SERVICE_UNAVAILABLE','Konfigurasi layanan capture belum tersedia.',503);
}
