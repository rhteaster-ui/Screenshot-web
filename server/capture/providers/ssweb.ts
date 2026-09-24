import type {CaptureOptions, CaptureProvider, Config} from '../model';
import {CaptureError} from '../errors';
import {MIME, parseOutput, readBounded} from '../parser';

function providerPayload(options: CaptureOptions) {
  const batch = options.mode === 'batch';
  const format = options.output.format === 'jpeg' ? 'jpg' : options.output.format;
  return {
    url: batch ? null : options.targets[0],
    size: [`${options.viewport.width}x${options.viewport.height}`],
    fullPage: options.viewport.fullPage,
    darkMode: options.appearance.darkMode,
    format,
    delay: options.timing.delay,
    width: options.viewport.width,
    height: options.viewport.height,
    scale: options.viewport.scale,
    save: false,
    pdf: {format: 'resolution', landscape: false},
    script: '',
    style: '',
    urls: batch ? options.targets.map(url => ({url})) : [{url: null}],
    keepUrlStructure: false,
    type: batch ? 'multiple-imgs' : 'img',
    mimeType: batch ? 'application/zip' : MIME[options.output.format],
    password: null,
  };
}

export function toSSWeb(options: CaptureOptions) {
  return providerPayload(options);
}

export function ssweb(config: Config, request: typeof fetch = fetch): CaptureProvider {
  return {
    async capture(options, signal) {
      if (options.output.format === 'pdf') {
        throw new CaptureError('FORMAT_UNAVAILABLE', 'PDF belum tersedia. Pilih JPG, PNG, atau WEBP.', 422);
      }

      const response = await request(config.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'FOLIO/1.0 screenshot client',
        },
        body: JSON.stringify(providerPayload(options)),
        signal,
        redirect: 'manual',
      });

      if (response.status === 401 || response.status === 403) {
        const detail = await readBounded(response, 65536).catch(() => '');
        if (/registration|sign up|api key|unauthoriz|authentication|access requires/i.test(detail)) {
          throw new CaptureError('PROVIDER_AUTH_REQUIRED', 'Akses provider screenshot belum aktif.', 503);
        }
        throw new CaptureError('PROVIDER_ACCESS_DENIED', 'Provider screenshot menolak request.', 503);
      }
      if (response.status === 429) {
        throw new CaptureError('PROVIDER_LIMIT', 'Provider screenshot sedang membatasi request.', 503);
      }
      if (!response.ok) {
        throw new CaptureError('CAPTURE_FAILED', `Provider screenshot mengembalikan HTTP ${response.status}.`, 502);
      }

      const text = await readBounded(response, Math.ceil(config.maxOutput * 1.4) + 8192);
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new CaptureError('OUTPUT_FAILED', 'Respons provider bukan JSON yang valid.', 502);
      }

      return parseOutput(
        data,
        options.mode === 'batch' ? MIME.zip : MIME[options.output.format],
        config.maxOutput,
      );
    },
  };
}
