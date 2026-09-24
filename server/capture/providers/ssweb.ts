import type { CaptureOptions, CaptureProvider, Config } from '../model';
import { CaptureError } from '../errors';
import { MIME, parseOutput, readBounded } from '../parser';
export function toSSWeb(options: CaptureOptions) {
  const { viewport:v, output:o, timing:t } = options;
  const batch = options.mode === 'batch';
  if(o.format==='pdf') throw new CaptureError('FORMAT_UNAVAILABLE','PDF belum tersedia. Pilih JPG, PNG, atau WEBP.',422);
  return { url:batch ? null : options.targets[0],size:[`${v.width}x${v.height}`],fullPage:v.fullPage,darkMode:options.appearance.darkMode,
    format:o.format,delay:batch ? String(t.delay) : t.delay,width:v.width,height:v.height,scale:v.scale,save:false,
    pdf:{format:'resolution',landscape:false},script:'',style:'',urls:batch ? options.targets.map(url=>({url})) : [{url:null}],
    keepUrlStructure:false,type:batch ? 'multiple-imgs' : 'img',mimeType:batch ? '' : MIME[o.format],password:null };
}
export function ssweb(config: Config, request: typeof fetch = fetch): CaptureProvider {
  return { async capture(options,signal) {
    const payload = toSSWeb(options);
    const wireBody = { ...payload, format: payload.format === 'jpeg' ? 'jpg' : payload.format };
    const response=await request(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/plain, */*','User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36','Origin':'https://scrollingscreenshot.com','Referer':'https://scrollingscreenshot.com/'},body:JSON.stringify(wireBody),signal,redirect:'manual'});
    if(response.status===403){
      const detail=await readBounded(response,65536).catch(()=>'');
      if(/registration|api access requires|api key|unauthoriz|authentication/i.test(detail)) throw new CaptureError('PROVIDER_AUTH_REQUIRED','Akses API layanan capture belum aktif. Coba kembali setelah akses tersedia.',503);
      throw new CaptureError('PROVIDER_ACCESS_DENIED','Layanan capture menolak akses dari server FOLIO. Capture belum tersedia saat ini.',503);
    }
    if(response.status===401) throw new CaptureError('PROVIDER_AUTH_REQUIRED','Akses API layanan capture belum aktif.',503);
    if(response.status===429) throw new CaptureError('PROVIDER_LIMIT','Layanan sedang sibuk. Coba lagi beberapa saat.',503);
    if(!response.ok) throw new CaptureError('CAPTURE_FAILED','Layanan capture belum dapat dihubungi. Coba lagi nanti.',502);
    const text=await readBounded(response,Math.ceil(config.maxOutput*1.4)+8192);
    let data;try{data=JSON.parse(text);}catch{throw new CaptureError('OUTPUT_FAILED','Respons layanan capture tidak valid.',502);}
    if(options.mode!=='batch' && data?.base64 && options.output.format!=='png'){
      try {
        const sharpModule = await import('sharp').then(m=>m.default).catch(e=>{console.error('Sharp import failed:', e); return null;});
        if(sharpModule){
          const m = /^data:([^;,]+);base64,(.*)$/.exec(data.base64);
          if(m){
            let b = Buffer.from(m[2],'base64');
            if(options.output.format==='jpeg') b = await sharpModule(b).jpeg({quality:90}).toBuffer();
            else if(options.output.format==='webp') b = await sharpModule(b).webp({quality:90}).toBuffer();
            data.base64 = `data:${MIME[options.output.format]};base64,${b.toString('base64')}`;
          }
        }
      } catch (err) {
        console.error('Sharp transform failed:', err);
      }
    }
    return parseOutput(data,options.mode==='batch' ? MIME.zip : MIME[options.output.format],config.maxOutput);
  }};
}
