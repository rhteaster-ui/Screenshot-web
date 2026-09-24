import http from 'node:http';import https from 'node:https';import {lookup} from 'node:dns/promises';
import {publicAddress} from '../capture/validation';import {CaptureError} from '../capture/errors';
// Validate the exact DNS answer used by the socket, not only a prior lookup.
export const safeHead:typeof fetch=(async(input:URL|string|Request,init?:RequestInit)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 return new Promise<Response>((resolve,reject)=>{
  const req=(url.protocol==='https:'?https:http).request(url,{method:'HEAD',agent:false,signal:init?.signal??undefined,lookup:((hostname:string,opts:any,cb:any)=>{
   lookup(hostname,{all:true,verbatim:true}).then(addresses=>{if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return cb(new CaptureError('PRIVATE_URL','Alamat privat ditolak.'));
    if(opts.all)cb(null,addresses);else cb(null,addresses[0].address,addresses[0].family);
   }).catch(cb);
  }) as any},r=>{const headers=new Headers();for(const[k,v]of Object.entries(r.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);r.resume();resolve(new Response(null,{status:r.statusCode||502,headers}));});req.on('error',reject);req.end();
 });
}) as typeof fetch;
