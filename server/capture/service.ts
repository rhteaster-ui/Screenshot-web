import {unzipSync} from 'fflate';
import {CaptureError} from './errors';
import {MIME,detectMime,safeFilename} from './parser';
import type {CaptureOptions,CaptureProvider,CaptureResult,Config,FileStore} from './model';
const id=(prefix:string)=>`${prefix}_${crypto.randomUUID().replace(/-/g,'')}`;
export async function capture(options:CaptureOptions,provider:CaptureProvider,store:FileStore,config:Config,signal:AbortSignal):Promise<CaptureResult>{
  const output=await provider.capture(options,signal);let partial=false;let archiveCount=0;
  const resultId=id(options.mode==='batch'?'batch':'cap');const expires=Date.now()+config.ttl;
  const items:NonNullable<CaptureResult['items']>=[];
  if(options.mode==='batch'){
    let expanded=0;let count=0;let unsafe=false;
    const entries=unzipSync(output.bytes,{filter:entry=>{
      if(entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').includes('..')){unsafe=true;return false;}
      if(entry.name.endsWith('/'))return false;
      if(++count>40 || entry.originalSize>config.maxOutput || (expanded+=entry.originalSize)>config.maxOutput*2){unsafe=true;return false;}
      return true;
    }});
    if(unsafe)throw new CaptureError('OUTPUT_FAILED','Arsip melampaui batas aman. Kurangi jumlah URL.',502);
    for(const [filename,bytes]of Object.entries(entries)){
      const mimeType=detectMime(bytes);if(!mimeType || mimeType==='application/zip')continue;
      if(mimeType!==MIME[options.output.format])throw new CaptureError('OUTPUT_FAILED','Format dalam ZIP berbeda dari pilihan output.',502);
      const itemId=id('item');const clean=safeFilename(filename);
      await store.put(itemId,bytes,{filename:clean,mimeType,bytes:bytes.length,expires});
      items.push({filename:clean,mimeType,previewUrl:`/api/files/${itemId}`});
    }
    if(!items.length)throw new CaptureError('OUTPUT_FAILED','Arsip tidak berisi gambar atau PDF yang dapat dibuka.',502);
    archiveCount=items.length;partial ||= archiveCount!==options.targets.length;
  }
  signal.throwIfAborted();
  await store.put(resultId,output.bytes,{filename:output.filename,mimeType:output.mimeType,bytes:output.bytes.length,expires});
  return{success:true,id:resultId,mode:options.mode,type:options.mode==='batch'?'archive':options.output.format==='pdf'?'pdf':'image',filename:output.filename,mimeType:output.mimeType,bytes:output.bytes.length,
    previewUrl:options.mode==='single'?`/api/files/${resultId}`:undefined,downloadUrl:`/api/download/${resultId}`,expiresAt:new Date(expires).toISOString(),targets:options.targets,viewport:options.viewport,format:options.output.format,
    ...(options.mode==='batch'?{items,archiveCount,partial}:{})};
}
