import type { FileStore,FileMeta } from '../capture/model';
const validId=(id:string)=>/^(cap|batch|item)_[a-f0-9]{32}$/.test(id);
export function r2Store(bucket:R2Bucket):FileStore {
  return {
    async put(id,bytes,meta){if(!validId(id))throw new Error('Invalid identifier');await bucket.put(`${id.startsWith('batch')?'batches':'captures'}/${id}`,bytes,{httpMetadata:{contentType:meta.mimeType},customMetadata:{meta:JSON.stringify(meta)}});},
    async get(id){if(!validId(id))return null;const key=`${id.startsWith('batch')?'batches':'captures'}/${id}`;const obj=await bucket.get(key);if(!obj)return null;
      const meta=JSON.parse(obj.customMetadata?.meta || '{}') as FileMeta;
      if(!meta.expires || meta.expires<=Date.now()){await bucket.delete(key);return null;}return {body:obj.body as unknown as BodyInit,meta};},
    async cleanup(){
      // Bounded sweep; expired objects are never served, including between sweeps.
      for(const prefix of ['captures/','batches/']){const page=await bucket.list({prefix,limit:100,include:['customMetadata']} as R2ListOptions);const expired=page.objects.filter(o=>{try{return JSON.parse(o.customMetadata?.meta || '{}').expires<=Date.now();}catch{return true;}});if(expired.length)await bucket.delete(expired.map(o=>o.key));}
    }
  };
}
export {validId};
