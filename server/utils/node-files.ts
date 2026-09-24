import {mkdir,writeFile,readFile,readdir,unlink,rename} from 'node:fs/promises';
import path from 'node:path';
import type {FileStore,FileMeta} from '../capture/model';
import {validId} from './files';
export function nodeStore(root:string):FileStore {
  const loc=(id:string)=>path.join(root,id.startsWith('batch')?'batches':'captures',id);
  return {
    async put(id,bytes,meta){if(!validId(id))throw new Error('Invalid identifier');const p=loc(id);await mkdir(path.dirname(p),{recursive:true});await writeFile(p+'.tmp',bytes);await rename(p+'.tmp',p);await writeFile(p+'.json',JSON.stringify(meta));},
    async get(id){if(!validId(id))return null;try{const p=loc(id);const meta=JSON.parse(await readFile(p+'.json','utf8')) as FileMeta;if(meta.expires<=Date.now())return null;return{body:new Uint8Array(await readFile(p)),meta};}catch{return null;}},
    async cleanup(){for(const dir of ['captures','batches']){const base=path.join(root,dir);await mkdir(base,{recursive:true});for(const file of await readdir(base)){if(!file.endsWith('.json'))continue;try{const meta=JSON.parse(await readFile(path.join(base,file),'utf8')) as FileMeta;if(meta.expires<=Date.now()){await Promise.allSettled([unlink(path.join(base,file)),unlink(path.join(base,file.slice(0,-5)))]);}}catch{}}}}
  };
}
