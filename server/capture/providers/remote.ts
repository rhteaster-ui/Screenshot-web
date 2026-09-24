import type {CaptureProvider,Config} from '../model';
import {CaptureError} from '../errors';
import {detectMime,MIME,safeFilename} from '../parser';
export function remoteProvider(config:Config):CaptureProvider {
  return {async capture(options,signal){
    if(!config.engineUrl || !config.engineToken)throw new CaptureError('ENGINE_UNAVAILABLE','Mesin capture mandiri belum terhubung. Coba lagi setelah server diaktifkan.',503);
    const endpoint=new URL('/api/engine',config.engineUrl);
    if(endpoint.protocol!=='https:')throw new CaptureError('ENGINE_UNAVAILABLE','Koneksi mesin capture belum dikonfigurasi.',503);
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.engineToken}`},body:JSON.stringify(options),signal,redirect:'manual'});
    if(!response.ok)throw new CaptureError(response.status===504?'REQUEST_TIMEOUT':'CAPTURE_FAILED',response.status===504?'Waktu capture habis. Kurangi delay atau jumlah URL.':'Mesin capture gagal membuka halaman. Periksa URL dan coba lagi.',response.status===504?504:502);
    const reader=response.body?.getReader();if(!reader)throw new CaptureError('OUTPUT_FAILED','Mesin tidak mengirim file.',502);
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>config.maxOutput){await reader.cancel();throw new CaptureError('OUTPUT_TOO_LARGE','Hasil terlalu besar. Kurangi resolusi.',422);}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const mimeType=options.mode==='batch'?MIME.zip:MIME[options.output.format];
    if(detectMime(bytes)!==mimeType)throw new CaptureError('OUTPUT_FAILED','Format hasil tidak sesuai.',502);
    return {bytes,mimeType,filename:safeFilename(response.headers.get('x-capture-filename')||`folio.${options.mode==='batch'?'zip':options.output.format}`)};
  }};
}
