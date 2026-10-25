import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {validateAIConfig} from '../web/dist/ai-protocol.js';

export class AIProfileStore {
  constructor(directory, encryption){this.directory=directory;this.file=path.join(directory,'ai-provider.enc');this.encryption=encryption;this.queue=Promise.resolve();}
  available(){return this.encryption.isEncryptionAvailable()&&!(process.platform==='linux'&&this.encryption.getSelectedStorageBackend?.()==='basic_text');}
  async load(){
    if(!this.available())return {available:false,profile:null};
    try {const bytes=await readFile(this.file);if(bytes.length>16000)throw new Error();return {available:true,profile:validateAIConfig(JSON.parse(this.encryption.decryptString(bytes)))};}
    catch(error){if(error.code==='ENOENT')return {available:true,profile:null};return {available:true,profile:null,error:'保存的 AI 连接无法解密，请重新填写。'};}
  }
  save(profile){
    const normalized=profile===null?null:validateAIConfig(profile);
    if(normalized&&!this.available())return Promise.reject(new Error('本机加密不可用，密钥只能在本次运行中使用。'));
    const task=this.queue.catch(()=>{}).then(async()=>{
      if(!normalized){await rm(this.file,{force:true});await rm(this.file+'.next',{force:true});return {saved:false};}
      await mkdir(this.directory,{recursive:true});
      const temporary=this.file+'.next';
      await writeFile(temporary,this.encryption.encryptString(JSON.stringify(normalized)));
      await rename(temporary,this.file);return {saved:true};
    });this.queue=task;return task;
  }
}
