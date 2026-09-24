import {getConfig} from './config';
import {CaptureError} from './capture/errors';
import {normalize,validateNetwork} from './capture/validation';
import {createProvider} from './capture/provider';
import {capture} from './capture/service';
import {readBounded} from './capture/parser';
import {acquire} from './middleware/rateLimit';
import type {Config,FileStore,CaptureProvider} from './capture/model';
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export async function handle(request:Request,store:FileStore,config:Config=getConfig(),key='anonymous',deps?:{provider?:CaptureProvider;validate?:typeof validateNetwork}):Promise<Response>{
  const path=new URL(request.url).pathname;let release:(()=>void)|undefined;
  try{
    if(path==='/api/health')return json({status:'ok',providerConfigured:config.provider==='playwright'||config.provider==='ssweb'||!!(config.engineUrl&&config.engineToken),formats:config.provider==='ssweb'?['jpeg','png','webp']:['jpeg','png','webp','pdf'],batchLimit:config.batchLimit,ttl:config.ttl,maxOutputBytes:config.maxOutput});
    if(request.method==='GET' && /^\/api\/(files|download)\//.test(path)){
      const file=await store.get(path.split('/').pop()!);if(!file)throw new CaptureError('FILE_EXPIRED','Hasil sudah kedaluwarsa. Silakan capture ulang.',410);
      return new Response(file.body,{headers:{'Content-Type':file.meta.mimeType,'Content-Length':String(file.meta.bytes),'Content-Disposition':`${path.includes('/download/')?'attachment':'inline'}; filename="${file.meta.filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});
    }
    if(request.method!=='POST' || !['/api/capture','/api/capture/batch'].includes(path))return json({success:false,code:'NOT_FOUND',message:'Endpoint tidak ditemukan.'},404);
    const origin=request.headers.get('origin');
    const forwardedHost=request.headers.get('x-forwarded-host') || request.headers.get('host');
    const reqOrigin=new URL(request.url).origin;
    if(origin && origin!==reqOrigin && (!forwardedHost || new URL(origin).host!==forwardedHost)){
      throw new CaptureError('INVALID_ORIGIN','Permintaan harus berasal dari website ini.',403);
    }
    if(!request.headers.get('content-type')?.includes('application/json'))throw new CaptureError('INVALID_REQUEST','Gunakan data JSON.',415);
    const raw=await readBounded(new Response(request.body),16384);
    let body;try{body=JSON.parse(raw);}catch{throw new CaptureError('INVALID_REQUEST','Data permintaan tidak valid.');}
    const mode=path.endsWith('/batch')?'batch':'single';const options=normalize(body,mode,config.batchLimit);
    if(config.provider==='ssweb' && options.output.format==='pdf')throw new CaptureError('FORMAT_UNAVAILABLE','Format PDF belum didukung oleh provider ini.',422);
    release=acquire(key,config.rateLimit,config.maxConcurrent,options.targets.length);
    const timeout=AbortSignal.timeout(config.timeout);const signal=AbortSignal.any([timeout,request.signal]);
    try{
      await store.cleanup();
      for(let row=0;config.provider!=='remote'&&row<options.targets.length;row++){
        try{await(deps?.validate??validateNetwork)(options.targets[row],signal);}catch(e){if(e instanceof CaptureError)e.row=row;throw e;}
      }
      return json(await capture(options,deps?.provider??createProvider(config),store,config,signal));
    }catch(e){if(timeout.aborted)throw new CaptureError('REQUEST_TIMEOUT','Waktu capture habis. Coba satu URL, resolusi lebih kecil, atau delay lebih pendek.',504);if(request.signal.aborted)throw new CaptureError('CANCELLED','Capture dihentikan.',499);throw e;}
  }catch(e){
    if(e instanceof CaptureError)return json({success:false,code:e.code,retryable:!['PROVIDER_ACCESS_DENIED','PROVIDER_AUTH_REQUIRED','FORMAT_UNAVAILABLE','PRIVATE_URL','INVALID_URL','INVALID_SETTINGS'].includes(e.code),message:e.code==='FILE_EXPIRED'?'Hasil sudah kedaluwarsa. Silakan capture ulang.':e.message,...(e.row!==undefined?{row:e.row}:{})},e.status,e.status===429?{'Retry-After':'60'}:{});
    console.error('[capture]',e instanceof Error?{name:e.name,message:e.message}:'Unknown error');
    return json({success:false,code:'CAPTURE_FAILED',message:'Capture belum berhasil. Silakan coba lagi.'},502);
  }finally{release?.();}
}
