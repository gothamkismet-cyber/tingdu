import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceRecorder } from '../web/dist/audio.js';

async function runtime(getUserMedia, run) {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  class FakeRecorder {
    constructor(){this.state='inactive';this.mimeType='audio/webm';}
    start(){this.state='recording';}
    stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['recording'])});this.onstop?.();});}
  }
  Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia}},configurable:true});
  globalThis.window={MediaRecorder:FakeRecorder};globalThis.MediaRecorder=FakeRecorder;
  try{await run();}finally{delete globalThis.window;delete globalThis.MediaRecorder;if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
}
test('Stopping recording releases the microphone and resetting releases the playback URL',async()=>{
  let closed=false;const stream={getTracks:()=>[{stop(){closed=true;}}]};
  await runtime(async()=>stream,async()=>{
    const recorder=new VoiceRecorder(()=>{},()=>{});await recorder.start();assert.equal(recorder.status,'recording');
    recorder.stop();await Promise.resolve();assert.equal(recorder.status,'ready');assert.equal(closed,true);assert.ok(recorder.url);
    recorder.reset();assert.equal(recorder.status,'idle');assert.equal(recorder.url,null);
  });
});
test('A permission response arriving after a page change cannot restart recording',async()=>{
  let grant,closed=false;const stream={getTracks:()=>[{stop(){closed=true;}}]};
  await runtime(()=>new Promise(resolve=>{grant=resolve;}),async()=>{
    const recorder=new VoiceRecorder(()=>{},()=>{}),pending=recorder.start();assert.equal(recorder.status,'requesting');
    recorder.reset();grant(stream);await pending;assert.equal(recorder.status,'idle');assert.equal(closed,true);assert.equal(recorder.url,null);
  });
});
