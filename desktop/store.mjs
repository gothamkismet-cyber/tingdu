import { readFile, mkdir, writeFile, rename, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { validateState } from '../web/dist/core.js';

export class LearningStore {
  constructor(directory) { this.directory=directory; this.file=path.join(directory,'learning.json'); this.queue=Promise.resolve(); }
  async load() {
    try { const text=await readFile(this.file,'utf8'); if(Buffer.byteLength(text)>10*1024*1024)throw new Error('学习数据超过读取限制'); return {raw:text,exists:true}; }
    catch(error) { if(error.code==='ENOENT')return {raw:null,exists:false}; throw error; }
  }
  save(raw) {
    if(typeof raw!=='string'||Buffer.byteLength(raw)>10*1024*1024)return Promise.reject(new Error('学习数据过大或格式不正确'));
    let serialized;
    try {serialized=JSON.stringify(validateState(JSON.parse(raw)),null,2);} catch(error){return Promise.reject(error);}
    const operation=this.queue.catch(()=>{}).then(async()=>{
      await mkdir(this.directory,{recursive:true});
      try {await copyFile(this.file,path.join(this.directory,'learning.previous.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
      const temporary=path.join(this.directory,'learning.next.json');
      await writeFile(temporary,serialized,'utf8');
      await rename(temporary,this.file);
      return {saved:true};
    });
    this.queue=operation;return operation;
  }
  async flush(){await this.queue;}
}
