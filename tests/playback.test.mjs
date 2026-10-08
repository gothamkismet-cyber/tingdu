import test from 'node:test';
import assert from 'node:assert/strict';
import {SpeechPlayer} from '../web/dist/audio.js';

function fakeEngine(voices=[{name:'Test English',lang:'en-US',voiceURI:'test',localService:true}]){
  const calls=[];
  globalThis.document={querySelectorAll:()=>[]};globalThis.location={hostname:'test'};
  globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  globalThis.window={speechSynthesis:{getVoices:()=>voices,addEventListener(){},cancel(){},speak(utterance){calls.push(utterance);}}};
  return calls;
}
test('Stopping during speech settles the pending sequence and never starts its next repeat',async()=>{
  const calls=fakeEngine(),player=new SpeechPlayer(()=>{});
  const finished=player.speak({language:'en',kind:'word',text:'apple'},{rate:1,repeat:3});
  assert.equal(calls.length,1);player.stop();assert.equal(await finished,false);assert.equal(calls.length,1);
});
test('A missing Japanese voice fails explicitly instead of using the available English voice',async()=>{
  const calls=fakeEngine(),messages=[],player=new SpeechPlayer(message=>messages.push(message));
  assert.equal(await player.speak({language:'ja',kind:'word',text:'学校',reading:'がっこう'},{rate:1}),false);
  assert.equal(calls.length,0);assert.match(messages[0],/日语音色/);
});
test('American and British playback select the requested locale even with a stale saved voice',async()=>{
  const voices=[
    {name:'US',lang:'en-US',voiceURI:'us',localService:true},
    {name:'UK',lang:'en_GB',voiceURI:'uk',localService:true},
    {name:'Australian',lang:'en-AU',voiceURI:'au',localService:true}
  ];
  const calls=fakeEngine(voices),player=new SpeechPlayer(()=>{}),entry={language:'en',kind:'word',text:'water'};
  const uk=player.speak(entry,{rate:1,accent:'en-GB',voice:'us'});
  assert.equal(calls[0].voice.name,'UK');calls[0].onend();assert.equal(await uk,true);
  const us=player.speak(entry,{rate:1,accent:'en-US',voice:'uk'});
  assert.equal(calls[1].voice.name,'US');calls[1].onend();assert.equal(await us,true);
});
test('Missing British voice reports the exact accent and never substitutes American or generic English',async()=>{
  const calls=fakeEngine([{name:'US',lang:'en-US',voiceURI:'us'},{name:'English',lang:'en',voiceURI:'en'}]);
  const messages=[],player=new SpeechPlayer(message=>messages.push(message));
  assert.equal(await player.speak({language:'en',kind:'word',text:'water'},{rate:1,accent:'en-GB'}),false);
  assert.equal(calls.length,0);assert.match(messages[0],/英式英语音色/);
});
test('Native voice providers also receive only a voice from the selected English accent',async()=>{
  fakeEngine([]);
  const player=new SpeechPlayer(()=>{}),calls=[];
  player.voices=[{name:'Windows US',lang:'en-US',provider:'windows',voiceURI:'win-us'},{name:'Android UK',lang:'en-GB',provider:'android',voiceURI:'android-uk'}];
  player.speakNative=async(entry,settings,voice)=>{calls.push(voice.name);return true;};
  player.speakAndroid=async(entry,settings,voice)=>{calls.push(voice.name);return true;};
  await player.speak({language:'en',text:'water'},{rate:1,accent:'en-GB',voice:'win-us'});
  await player.speak({language:'en',text:'water'},{rate:1,accent:'en-US',voice:'android-uk'});
  assert.deepEqual(calls,['Android UK','Windows US']);
});
