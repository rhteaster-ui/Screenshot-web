import ipaddr from 'ipaddr.js';
import { CaptureError } from './errors';
import type { CaptureOptions } from './model';
export function publicAddress(address: string): boolean {
  try {
    let ip = ipaddr.parse(address.replace(/^\[|\]$/g, ''));
    if (ip.kind() === 'ipv6' && (ip as ipaddr.IPv6).isIPv4MappedAddress()) ip = (ip as ipaddr.IPv6).toIPv4Address();
    return ip.range() === 'unicast';
  } catch { return false; }
}
export function parsePublicUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new CaptureError('INVALID_URL', 'Masukkan URL lengkap, diawali https:// atau http://.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port)))
    throw new CaptureError('INVALID_URL', 'Gunakan URL HTTP/HTTPS publik tanpa kredensial dan port khusus.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (ipaddr.isValid(host)) {
    if (!publicAddress(host)) throw new CaptureError('PRIVATE_URL', 'Alamat lokal, privat, dan internal tidak dapat di-capture.');
  } else if (!host.includes('.') || /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host) || host === 'metadata.google.internal' || host.endsWith('.onion')) {
    throw new CaptureError('PRIVATE_URL', 'Gunakan alamat website publik, bukan alamat jaringan lokal.');
  }
  if (value.length > 2048) throw new CaptureError('INVALID_URL', 'URL terlalu panjang (maksimal 2.048 karakter).');
  url.hash = ''; return url;
}
export function normalize(input: unknown, mode: 'single' | 'batch', limit: number): CaptureOptions {
  if (!input || typeof input !== 'object') throw new CaptureError('INVALID_REQUEST', 'Pengaturan capture tidak valid.');
  const v = input as Record<string, any>;
  if (v.mode !== mode || !Array.isArray(v.targets) || v.targets.length < 1 || v.targets.length > (mode === 'single' ? 1 : limit))
    throw new CaptureError('INVALID_REQUEST', `Gunakan ${mode === 'single' ? 'satu URL' : `1–${limit} URL`}.`);
  const targets = v.targets.map((x: unknown, row: number) => {
    try { if (typeof x !== 'string') throw new CaptureError('INVALID_URL','URL tidak valid.'); return parsePublicUrl(x.trim()).href; }
    catch (e) { if (e instanceof CaptureError) e.row = row; throw e; }
  });
  const p = v.viewport ?? {};
  const numeric = (x: unknown, min: number, max: number, label: string, integer = true) => {
    if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max || (integer && !Number.isInteger(x)))
      throw new CaptureError('INVALID_SETTINGS', `${label} harus antara ${min} dan ${max}.`);
    return x;
  };
  const width = numeric(p.width, 320, 3840, 'Lebar'); const height = numeric(p.height, 240, 2160, 'Tinggi');
  const scale = numeric(p.scale ?? 1, .5, 2, 'Scale', false);
  if (width * height * scale * scale > 16588800) throw new CaptureError('INVALID_SETTINGS','Resolusi dan scale terlalu besar. Kurangi salah satunya.');
  const format = v.output?.format;
  if (!['jpeg','png','webp','pdf'].includes(format)) throw new CaptureError('INVALID_SETTINGS','Pilih JPG, PNG, WEBP, atau PDF.');
  if (typeof p.fullPage !== 'boolean' || typeof v.appearance?.darkMode !== 'boolean') throw new CaptureError('INVALID_SETTINGS','Pengaturan tampilan tidak valid.');
  return { mode, targets, viewport: { preset: ['desktop','mobile','ipad','ipad-pro','macbook','pc','custom'].includes(p.preset) ? p.preset : 'custom', width,height,scale,fullPage:p.fullPage },
    output:{format},appearance:{darkMode:v.appearance.darkMode},timing:{delay:numeric(v.timing?.delay ?? 1,0,10,'Delay')} };
}
export type Resolver = (hostname: string, signal: AbortSignal) => Promise<string[]>;
export const resolvePublicDns: Resolver = async (hostname, signal) => {
  if (ipaddr.isValid(hostname.replace(/^\[|\]$/g, ''))) return [hostname];
  const groups = await Promise.all(['A','AAAA'].map(async type => {
    let r:Response;
    try{r=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers:{accept:'application/dns-json'}, signal, redirect:'manual' });}
    catch(e){if(signal.aborted)throw e;throw new CaptureError('DNS_UNAVAILABLE','Pemeriksaan alamat belum tersedia. Coba lagi nanti.',503);}
    if (!r.ok) throw new CaptureError('DNS_UNAVAILABLE','Pemeriksaan alamat belum tersedia. Coba lagi.',503);
    const data = await r.json() as { Answer?: {type:number;data:string}[] };
    return (data.Answer ?? []).filter(x=>x.type===1 || x.type===28).map(x=>x.data);
  }));
  return groups.flat();
};
export async function validateNetwork(target: string, signal: AbortSignal, resolver: Resolver = resolvePublicDns, request: typeof fetch = fetch): Promise<void> {
  let url = parsePublicUrl(target);
  for (let hop = 0; hop < 6; hop++) {
    const addresses = await resolver(url.hostname,signal);
    if (!addresses.length) throw new CaptureError('TARGET_UNAVAILABLE','Alamat website tidak ditemukan. Periksa kembali URL.',422);
    if (addresses.some(x=>!publicAddress(x))) throw new CaptureError('PRIVATE_URL','Alamat mengarah ke jaringan privat atau internal.');
    // Only a public URL is contacted; never auto-follow redirects.
    let response: Response;
    try { response = await request(url, {method:'HEAD',redirect:'manual',signal}); }
    catch (e) { if (signal.aborted) throw e; throw new CaptureError('TARGET_UNAVAILABLE','Website tidak dapat dijangkau. Coba URL lain.',422); }
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      url = parsePublicUrl(new URL(response.headers.get('location')!,url).href); continue;
    }
    if ([401,403,429,503].includes(response.status)) throw new CaptureError('TARGET_BLOCKED','Website membatasi akses otomatis atau sedang tidak tersedia. Coba halaman publik lain.',422);
    if (response.status >= 400 && ![405,501].includes(response.status)) throw new CaptureError('TARGET_UNAVAILABLE','Halaman tidak ditemukan atau tidak dapat dibuka.',422);
    return;
  }
  throw new CaptureError('TARGET_UNAVAILABLE','Terlalu banyak pengalihan alamat website.',422);
}
