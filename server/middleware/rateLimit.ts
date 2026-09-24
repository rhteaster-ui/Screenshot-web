import {CaptureError} from '../capture/errors';
const buckets=new Map<string,{count:number;until:number}>();let active=0;
export function acquire(key:string,limit:number,maxConcurrent:number,cost=1){
  const now=Date.now();for(const[k,v]of buckets)if(v.until<=now)buckets.delete(k);
  if(buckets.size>10000)throw new CaptureError('RATE_LIMIT','Layanan sedang sibuk. Coba beberapa saat lagi.',429);
  const item=buckets.get(key) ?? {count:0,until:now+60000};
  if(item.count+cost>limit)throw new CaptureError('RATE_LIMIT','Terlalu banyak capture. Tunggu satu menit lalu coba lagi.',429);
  if(active>=maxConcurrent)throw new CaptureError('SERVICE_BUSY','Semua frame sedang digunakan. Coba beberapa saat lagi.',503);
  item.count+=cost;buckets.set(key,item);active++;let released=false;
  return()=>{if(!released){released=true;active--;}};
}
