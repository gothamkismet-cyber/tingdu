import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_DEFAULTS, validateAIConfig, prepareOnlineRequest, pcmWave, bytesBase64, audioReply, buildAIMessage, parseLessonReply, wikiSearchReply, wikiSummaryReply } from '../web/dist/ai-protocol.js';
import { AIClient, onlineRequest, recordingWave } from '../web/dist/ai-client.js';
import { SpeechPlayer } from '../web/dist/audio.js';
import { requestOnline } from '../web/online.mjs';
const config = { ...AI_DEFAULTS, apiKey:'local-test-key' };
const wave = pcmWave(new Float32Array([0,.2,-.2,1,-1]));
const audio = { choices:[{message:{audio:{data:bytesBase64(wave),transcript:'Hello!'}}}] };
const request = () => ({ kind:'ai', config, body:buildAIMessage(config,'test') });
const wiki = { kind:'wiki', language:'en', query:'London' };

test('Provider configuration only accepts HTTPS or loopback, and never takes credentials from a URL', () => {
  assert.equal(validateAIConfig({...config,baseUrl:'http://127.0.0.1:4185/v1/'}).baseUrl,'http://127.0.0.1:4185/v1');
  for(const baseUrl of ['http://example.com/v1','file:///tmp/key','https://name:password@example.com','https://example.com?key=secret','https://example.com#key','https://example.com/v1/chat/completions','https://example.com/\npath']) assert.throws(()=>validateAIConfig({...config,baseUrl}));
  assert.throws(()=>validateAIConfig({...config,apiKey:'key\r\nvalue'}));
  assert.throws(()=>validateAIConfig({...config,model:'model\nmalicious'}));
});
test('A text-only reply, broken WAV or mislabeled MP3 cannot pass the audio capability gate', () => {
  assert.throws(()=>audioReply({choices:[{message:{content:'I can speak.'}}]}),/音频/);
  assert.throws(()=>audioReply({choices:[{message:{audio:{data:btoa('fake wav audio file')}}}]}),/WAV/);
  const truncated = wave.slice(0,-2);
  assert.throws(()=>audioReply({choices:[{message:{audio:{data:bytesBase64(truncated)}}}]}),/不完整/);
  assert.deepEqual(audioReply(audio).bytes,wave); assert.equal(audioReply(audio).transcript,'Hello!');
});
test('Capability test includes audio input; conversations honor locale, bounded history and explicit WAV output', () => {
  const probe=buildAIMessage(config,'test');
  assert.deepEqual(probe.modalities,['text','audio']); assert.equal(probe.audio.format,'wav');
  assert.equal(probe.messages[1].content[1].input_audio.format,'wav'); assert.equal(probe.store,false);
  const chat=buildAIMessage(config,'chat',{text:'Hi',language:'en',accent:'en-GB',history:Array.from({length:20},()=>({role:'user',content:'Hi'}))});
  assert.equal(chat.messages.length,10);assert.match(chat.messages[0].content,/British English/);
  const recorded=buildAIMessage(config,'chat',{language:'ja',audio:bytesBase64(wave)});
  assert.match(recorded.messages[0].content,/Japanese/);assert.equal(recorded.messages.at(-1).content[1].input_audio.data,bytesBase64(wave));
  const lesson=buildAIMessage(config,'lesson',{language:'ja',topic:'京都',source:'Reference data'});
  assert.deepEqual(lesson.modalities,['text']);assert.match(lesson.messages[0].content,/untrusted/);
  assert.throws(()=>buildAIMessage(config,'chat',{text:'x'.repeat(1201)}));
  assert.throws(()=>parseLessonReply({choices:[{message:{content:'not json'}}]}),/未保存/);
});
test('Networking uses fixed encyclopedia hosts, bounded requests and the configured model only', () => {
  const prepared=prepareOnlineRequest(request());
  assert.equal(prepared.headers.Authorization,'Bearer local-test-key');assert.equal(prepared.timeout,60000);
  assert.equal(new URL(prepareOnlineRequest({...wiki,query:'https://evil.invalid/'}).url).hostname,'en.wikipedia.org');
  assert.throws(()=>prepareOnlineRequest({...wiki,language:'../../elsewhere'}));
  assert.throws(()=>prepareOnlineRequest({...request(),body:{...request().body,model:'different'}}));
  assert.throws(()=>prepareOnlineRequest({...request(),body:{...request().body,messages:[{role:'user',content:'界'.repeat(1100000)}]}}),/过大/);
  const source=wikiSummaryReply({title:'London',extract:'A city.'},'en');assert.equal(source.url,'https://en.wikipedia.org/wiki/London');
  assert.throws(()=>wikiSummaryReply({type:'disambiguation'},'ja'),/多个含义/);
  assert.equal(wikiSearchReply({pages:[{title:'Coffee',key:'Coffee',excerpt:'<b>Coffee</b> drink'}]})[0].description,'Coffee drink');
});
test('Upstream redirects are never followed and provider error bodies never reach the UI', async () => {
  const seen=[];
  const result=await requestOnline(request(),{fetcher:async(url,options)=>{seen.push({url,options});return new Response('secret-provider-error',{status:302,headers:{Location:'https://evil.invalid'}});}});
  assert.deepEqual(result,{status:302});assert.equal(seen.length,1);assert.equal(seen[0].options.redirect,'manual');
  assert.deepEqual(await requestOnline(request(),{fetcher:async()=>new Response('key=secret',{status:401})}),{status:401});
  await assert.rejects(requestOnline(wiki,{fetcher:async()=>new Response('x'.repeat(512*1024+1))}),/回复过大/);
  await assert.rejects(requestOnline(wiki,{fetcher:async()=>new Response('<html>not JSON</html>')}),/不是有效 JSON/);
});
test('Cancelling or timing out a request aborts its upstream connection', async t => {
  const controller=new AbortController();
  const pending=requestOnline(wiki,{signal:controller.signal,fetcher:(_,options)=>new Promise((_,reject)=>{options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));})});
  controller.abort();await assert.rejects(pending,/已取消/);
  t.mock.timers.enable({apis:['setTimeout']});
  const timeout=requestOnline(wiki,{fetcher:(_,options)=>new Promise((_,reject)=>{options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));})});
  t.mock.timers.tick(15001);await assert.rejects(timeout,/超时/);
});
test('Client requires a successful audio test, never stores the key in public preferences, and invalidates old tests', async t => {
  const prefs=new Map();globalThis.localStorage={getItem:k=>prefs.get(k),setItem:(k,v)=>prefs.set(k,v)};globalThis.window={};
  t.after(()=>{delete globalThis.localStorage;delete globalThis.window;});
  let reply=audio; t.mock.method(globalThis,'fetch',async()=>Response.json({status:200,data:reply}));
  const client=new AIClient();await client.configure(config);assert.ok(!JSON.stringify([...prefs]).includes(config.apiKey));
  await assert.rejects(client.complete('chat',{text:'Hi'}),/先在/);
  await client.complete('test');assert.equal(client.verified,true);
  reply={choices:[{message:{content:'Text only'}}]};await assert.rejects(client.complete('test'));assert.equal(client.verified,false);
  reply=audio;await client.complete('test');await client.configure({...config,voice:'nova'});assert.equal(client.verified,false);
  await client.forget();assert.equal(client.config.apiKey,'');assert.equal(client.readAloud,false);
  await assert.rejects(client.configure(config,true),/加密不可用/);
});
test('Android bridge cancellation drops late responses and encrypted profile errors stay recoverable', async t => {
  const scope=new EventTarget(), calls=[];
  scope.TingduAndroid={online:(id)=>{calls.push(id);return '{"started":true}';},cancelOnline:id=>calls.push('cancel:'+id),loadAIProfile:()=>'{"available":true,"error":"重新填写"}'};
  globalThis.window=scope;t.after(()=>delete globalThis.window);
  const controller=new AbortController(), pending=onlineRequest(wiki,{signal:controller.signal});
  controller.abort();await assert.rejects(pending,{name:'AbortError'});
  scope.dispatchEvent(new CustomEvent('tingdu:native',{detail:{type:'online',id:calls[0],result:{status:200,data:{}}}}));
  assert.equal(calls[1],'cancel:'+calls[0]);
  const client=new AIClient();await assert.rejects(client.load(),/重新填写/);assert.equal(client.secureAvailable,true);
});
test('Recording conversion mixes channels into 16 kHz WAV and rejects recordings longer than 30 seconds', async t => {
  let duration=.2, closed=0;
  globalThis.window={AudioContext:class{async decodeAudioData(){return {duration,sampleRate:48000,numberOfChannels:2,getChannelData:()=>new Float32Array(Math.ceil(duration*48000)).fill(.4)};}async close(){closed++;}}};
  t.after(()=>delete globalThis.window);
  const data=await recordingWave(new Blob(['encoded audio'])), bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)), view=new DataView(bytes.buffer);
  assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint16(22,true),1);assert.equal(bytes.length,44+3200*2);
  duration=32;await assert.rejects(recordingWave(new Blob(['long'])),/30 秒/);assert.equal(closed,2);
});
test('AI reading cancellation settles the sequence and a failed connection never falls back silently', async t => {
  let native=0, aborted=false;
  globalThis.window={speechSynthesis:{getVoices:()=>[],addEventListener(){},cancel(){},speak(){native++;}}};
  globalThis.document={querySelectorAll:()=>[]};globalThis.location={hostname:'test'};
  t.after(()=>{delete globalThis.window;delete globalThis.document;delete globalThis.location;});
  const notices=[],player=new SpeechPlayer(message=>notices.push(message));
  player.ai={readAloud:true,verified:true,revision:1,synthesize:(_,__,___,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('stop','AbortError'));}))};
  const pending=player.speak({language:'en',kind:'word',text:'apple'},{rate:1,repeat:2});player.stop();assert.equal(await pending,false);assert.equal(aborted,true);assert.equal(native,0);assert.deepEqual(notices,[]);
  player.ai.verified=false;assert.equal(await player.speak({language:'en',text:'apple'},{rate:1}),false);assert.match(notices[0],/先在/);assert.equal(native,0);
});
