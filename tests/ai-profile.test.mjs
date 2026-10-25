import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes,createCipheriv,createDecipheriv } from 'node:crypto';
import { AIProfileStore } from '../desktop/ai-profile.mjs';
import { AI_DEFAULTS } from '../web/dist/ai-protocol.js';

test('Profiles are encrypted separately, replacements are serialized and forgetting removes persisted secrets',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'tingdu-ai-profile-')),key=randomBytes(32);
  const encryption={isEncryptionAvailable:()=>true,encryptString:value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);},decryptString:value=>{const decipher=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));decipher.setAuthTag(value.subarray(12,28));return Buffer.concat([decipher.update(value.subarray(28)),decipher.final()]).toString('utf8');}};
  try {
    const store=new AIProfileStore(directory,encryption),first={...AI_DEFAULTS,apiKey:'test-only-private-key'},second={...first,voice:'nova'};
    assert.deepEqual(await store.load(),{available:true,profile:null});
    await Promise.all([store.save(first),store.save(second)]);assert.deepEqual((await store.load()).profile,second);
    const bytes=await readFile(store.file);assert.ok(!bytes.includes(Buffer.from(first.apiKey)));assert.ok(!bytes.includes(Buffer.from(first.baseUrl)));
    await writeFile(store.file,'broken-encryption');const damaged=await store.load();assert.equal(damaged.available,true);assert.match(damaged.error,/重新填写/);
    await writeFile(store.file+'.next',bytes);await store.save(null);assert.equal((await store.load()).profile,null);await assert.rejects(readFile(store.file+'.next'),{code:'ENOENT'});
    const unavailable=new AIProfileStore(directory,{isEncryptionAvailable:()=>false});await assert.rejects(unavailable.save(first),/加密不可用/);assert.deepEqual(await unavailable.load(),{available:false,profile:null});
  } finally {
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('tingdu-ai-profile-'));
    await rm(directory,{recursive:true,force:true});
  }
});
