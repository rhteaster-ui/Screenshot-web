import type { Config } from './capture/model';
export function getConfig(env: Record<string, unknown> = process.env): Config {
  const n = (key: string, fallback: number, min: number, max: number) => {
    const v = Number(env[key] ?? fallback); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  return { provider: String(env.CAPTURE_PROVIDER || 'ssweb'), endpoint: 'https://scrollingscreenshot.com/api/screenshot', engineUrl:String(env.CAPTURE_ENGINE_URL||''),engineToken:String(env.CAPTURE_ENGINE_TOKEN||''),
    timeout: n('CAPTURE_TIMEOUT', 90000, 1000, 180000), ttl: n('CAPTURE_FILE_TTL', 1800000, 1000, 86400000),
    batchLimit: n('CAPTURE_BATCH_LIMIT', 5, 1, 10), maxOutput: n('CAPTURE_MAX_OUTPUT_BYTES', 8388608, 1024, 12582912),
    rateLimit: n('CAPTURE_RATE_LIMIT', 10, 1, 100), maxConcurrent: n('CAPTURE_MAX_CONCURRENT', 2, 1, 4) };
}
