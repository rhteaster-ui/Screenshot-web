import { CaptureError } from './errors';
export const MIME: Record<string,string> = { jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',zip:'application/zip' };
export function detectMime(b: Uint8Array): string | null {
  const s = (a: number, z: number) => String.fromCharCode(...b.slice(a,z));
  if (b[0]===255 && b[1]===216 && b[2]===255) return MIME.jpeg;
  if ([137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x)) return MIME.png;
  if (s(0,4)==='RIFF' && s(8,12)==='WEBP') return MIME.webp;
  if (s(0,5)==='%PDF-') return MIME.pdf;
  if (s(0,2)==='PK' && b[2]===3 && b[3]===4) return MIME.zip;
  return null;
}
export function safeFilename(name: string) { return name.split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,150) || 'capture'; }
export function parseOutput(data: any, expected: string, max: number) {
  if (data?.success === false || data?.error) {
    const message = `${data?.error ?? ''} ${data?.message ?? ''}`;
    if (/registration|sign up|api key|unauthoriz|authentication/i.test(message)) throw new CaptureError('PROVIDER_AUTH_REQUIRED','Layanan capture sedang menunggu aktivasi akses. Coba kembali setelah akses layanan tersedia.',503);
    if (/limit|quota|too many/i.test(message)) throw new CaptureError('PROVIDER_LIMIT','Layanan capture sedang mencapai batas penggunaan. Coba lagi nanti.',503);
    throw new CaptureError('CAPTURE_FAILED','Website belum berhasil di-capture. Coba URL lain atau ulangi nanti.',502);
  }
  const value = data?.base64;
  const match = typeof value === 'string' && /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0 || match[2].length > Math.ceil(max/3)*4) throw new CaptureError('OUTPUT_FAILED','Hasil capture tidak valid atau melebihi batas ukuran.',502);
  const bytes = new Uint8Array(Buffer.from(match[2],'base64'));
  const actual = detectMime(bytes);
  if (actual !== expected || match[1] !== expected || bytes.length > max || !bytes.length) throw new CaptureError('OUTPUT_FAILED','Format hasil berbeda dari permintaan. Coba format lain.',502);
  return { bytes, mimeType:actual, filename:safeFilename(String(data.filename || `capture.${Object.keys(MIME).find(k=>MIME[k]===actual)}`)) };
}
export async function readBounded(response: Response, max: number): Promise<string> {
  if (Number(response.headers.get('content-length')) > max) throw new CaptureError('OUTPUT_TOO_LARGE','Hasil terlalu besar. Kurangi resolusi atau jumlah URL.',502);
  const reader = response.body?.getReader(); if (!reader) throw new CaptureError('OUTPUT_FAILED','Layanan tidak mengirim hasil.',502);
  let size=0; const chunks: Uint8Array[]=[];
  try { for (;;) {const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new CaptureError('OUTPUT_TOO_LARGE','Hasil terlalu besar. Kurangi resolusi atau jumlah URL.',502);}chunks.push(value);} }
  finally {reader.releaseLock();}
  const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(out);
}
