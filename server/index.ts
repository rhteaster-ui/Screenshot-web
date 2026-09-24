import {createServer} from 'node:http';
import {access,readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {lookup} from 'node:dns/promises';
import {safeHead} from './utils/node-head';
import {getConfig} from './config';
import {nodeStore} from './utils/node-files';
import {handle} from './handler';
import {validateNetwork} from './capture/validation';
import {CaptureError} from './capture/errors';
import {playwrightProvider} from './capture/providers/playwright';
import {normalize} from './capture/validation';
import {acquire} from './middleware/rateLimit';
import {timingSafeEqual} from 'node:crypto';
import {chromium} from 'playwright';
const config=getConfig({...process.env,CAPTURE_PROVIDER:process.env.CAPTURE_PROVIDER||'playwright'});
if(config.provider==='playwright'){
 try{await access(process.env.CHROMIUM_EXECUTABLE_PATH||chromium.executablePath());}
 catch{config.provider='unavailable';console.error('Chromium belum tersedia. Jalankan pnpm exec playwright install chromium.');}
}
const provider=config.provider==='playwright'?playwrightProvider(config):undefined;
const store=nodeStore(resolve('storage'));const root=resolve('dist-node');
const cleanup=setInterval(()=>{store.cleanup().catch(()=>console.error('Temporary cleanup failed'));},60000);cleanup.unref();await store.cleanup();
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const controller=new AbortController();req.on('aborted',()=>controller.abort());res.on('close',()=>{if(!res.writableEnded)controller.abort();});
 try{
  const url=new URL(req.url||'/',`http://localhost:${Number(process.env.PORT)||3000}`);
  if(url.pathname.startsWith('/api/')){
   if(config.engineToken && url.pathname!=='/api/engine'){res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,code:'ENGINE_ONLY',message:'Endpoint hanya untuk mesin capture.'}));return;}
   let n=0;const chunks:Buffer[]=[];for await(const chunk of req){n+=chunk.length;if(n>16384){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({success:false,code:'REQUEST_TOO_LARGE',message:'Data terlalu besar.'}));return;}chunks.push(chunk);}
   if(url.pathname==='/api/engine'){
    const expected=Buffer.from(`Bearer ${config.engineToken||''}`);const actual=Buffer.from(req.headers.authorization||'');
    if(req.method!=='POST'||!config.engineToken||actual.length!==expected.length||!timingSafeEqual(actual,expected)||!provider){res.writeHead(403);res.end();return;}
    let release:(()=>void)|undefined;const timeout=AbortSignal.timeout(config.timeout);const signal=AbortSignal.any([controller.signal,timeout]);
    try{
     const body=JSON.parse(Buffer.concat(chunks).toString());const options=normalize(body,body.mode==='batch'?'batch':'single',config.batchLimit);
     release=acquire('engine',config.rateLimit,config.maxConcurrent,options.targets.length);
     const output=await provider.capture(options,signal);
     if(output.bytes.length>config.maxOutput)throw new CaptureError('OUTPUT_TOO_LARGE','Hasil terlalu besar.',422);
     res.writeHead(200,{'Content-Type':output.mimeType,'Content-Length':output.bytes.length,'X-Capture-Filename':output.filename,'Cache-Control':'no-store'});res.end(output.bytes);
    }catch(error){if(!res.destroyed&&!res.headersSent){res.writeHead(timeout.aborted?504:error instanceof CaptureError?error.status:502,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({success:false,message:'Capture gagal.'}));}}finally{release?.();}return;
   }
   const headers=new Headers();for(const[key,value]of Object.entries(req.headers)){if(value)headers.set(key,Array.isArray(value)?value.join(','):value);}
   // Use the direct Host header for same-origin validation; do not trust forwarded IPs.
   const host=req.headers.host || `localhost:${Number(process.env.PORT)||3000}`;
   const request=new Request(`${process.env.APP_ORIGIN || `http://${host}`}${url.pathname}${url.search}`,{method:req.method,headers,body:['GET','HEAD'].includes(req.method||'GET')?undefined:Buffer.concat(chunks),signal:controller.signal});
   const response=await handle(request,store,config,req.socket.remoteAddress||'local',{provider,validate:(target,signal)=>validateNetwork(target,signal,async hostname=>{const result=await lookup(hostname,{all:true,verbatim:true});return result.map(x=>x.address);},safeHead)});
   res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){for await(const chunk of response.body as unknown as AsyncIterable<Uint8Array>){if(res.destroyed)break;res.write(chunk);}}res.end();return;
  }
  if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405);res.end();return;}
  const file=resolve(root,'.'+decodeURIComponent(url.pathname));if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const final=url.pathname==='/'?resolve(root,'index.html'):file;
  try{const info=await stat(final);if(!info.isFile())throw new Error();const bytes=await readFile(final);res.writeHead(200,{'Content-Type':mime[extname(final)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':url.pathname.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404);res.end('Not found');}
 }catch{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({success:false,code:'SERVICE_UNAVAILABLE',message:'Layanan belum tersedia.'}));}
});
server.requestTimeout=200000;server.headersTimeout=20000;
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`FOLIO listening on port ${Number(process.env.PORT)||3000}`));
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>{clearInterval(cleanup);server.close(()=>process.exit());});
