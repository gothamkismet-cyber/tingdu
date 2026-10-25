import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, validateState, summarize } from '../web/dist/core.js';
import { generatedLesson, saveCustomLesson, deleteCustomLesson, validateCustomLesson } from '../web/dist/generated-lessons.js';
import { beginListening, answerListening, submitListening, listeningStats, listeningResult } from '../web/dist/listening.js';
import { createListeningView } from '../web/dist/listening-view.js';
import { createAIView } from '../web/dist/ai-view.js';
const reply=()=>({title:'咖啡店的一天',segments:Array.from({length:3},()=>({speaker:'旁白',text:'Anna orders a coffee at the shop.',translation:'安娜在店里点了一杯咖啡。'})),questions:Array.from({length:3},()=>({prompt:'安娜点了什么？',options:['咖啡','茶','牛奶','果汁'],answer:0,explanation:'原文说明她点了咖啡。'}))});
const source={title:'Coffee',url:'https://en.wikipedia.org/wiki/Coffee',license:'CC BY-SA 4.0',retrievedAt:1000};
const make=(language='en')=>generatedLesson(reply(),{language,level:'入门',source:language==='en'?source:null},2000);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('Generated English and Japanese lessons survive backups together with grades and drafts',()=>{
  const state=freshState(),en=saveCustomLesson(state,make()),ja=saveCustomLesson(state,make('ja'));
  const session=beginListening(state,'en',en.id,null,3000);
  for(const q of en.questions)answerListening(session,q.id,q.answer,state);
  submitListening(state,'en',4000);assert.equal(listeningResult(session,state).correct,3);
  const draft=beginListening(state,'ja',ja.id,null,5000);answerListening(draft,ja.questions[0].id,1,state);
  const restored=validateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.listening,state.listening);assert.equal(listeningStats(restored,'en').accuracy,100);
  assert.equal(summarize(restored,'en',4000).todayWords,0);
  const old=freshState();delete old.listening.customLessons;assert.deepEqual(validateState(old).listening.customLessons,[]);
});
test('Malformed, oversized and duplicate generated questions or source URLs are rejected before saving',()=>{
  for(const corrupt of [l=>l.questions.pop(),l=>l.questions[0].answer=4,l=>l.questions[0].options[1]=l.questions[0].options[0],l=>l.segments[0].text='x'.repeat(301),l=>l.source.url='javascript:alert(1)',l=>l.source.url='https://evil.invalid/wiki/Coffee',l=>l.source.license='MIT',l=>l.id=[l.id],l=>l.questions[0].id='foreign-id',l=>l.createdAt=-1]) {
    const lesson=make();corrupt(lesson);assert.throws(()=>validateCustomLesson(lesson),/未保存/);
  }
  const state=freshState(),lesson=make();saveCustomLesson(state,lesson);assert.throws(()=>saveCustomLesson(state,lesson),/已经保存/);
  for(let i=1;i<30;i++)saveCustomLesson(state,make());assert.throws(()=>saveCustomLesson(state,make()),/30 篇/);
  const unknown=make();unknown.apiKey='must-not-be-exported';unknown.source.apiKey='must-not-be-exported';assert.ok(!JSON.stringify(validateCustomLesson(unknown)).includes('must-not-be-exported'));
});
test('Deleting a custom lesson removes only its dependent history and draft, leaving the other language intact',()=>{
  const state=freshState(),en=saveCustomLesson(state,make()),ja=saveCustomLesson(state,make('ja'));
  const session=beginListening(state,'en',en.id,null,3000);for(const q of en.questions)answerListening(session,q.id,1,state);submitListening(state,'en',4000);
  beginListening(state,'ja',ja.id,null,5000);const originalPrefs=JSON.stringify(state.prefs);
  deleteCustomLesson(state,en.id);assert.equal(state.listening.sessions.en,null);assert.equal(state.listening.history.length,0);assert.equal(state.listening.sessions.ja.lessonId,ja.id);assert.equal(state.listening.customLessons.length,1);assert.equal(JSON.stringify(state.prefs),originalPrefs);
  assert.deepEqual(validateState(state).listening,state.listening);assert.throws(()=>deleteCustomLesson(state,'lc-en-builtin'),/只能删除/);
});
test('Generated remote text is escaped, sources are attributed, and transcript stays hidden until submission',()=>{
  const state=freshState(),lesson=make();lesson.title='<img src=x onerror=alert(1)>';lesson.segments[0].text='<script>bad()</script>';saveCustomLesson(state,lesson);
  const ui=createListeningView({getState:()=>state,e,icon:()=>'',visible:()=>true});
  assert.ok(ui.render().includes('&lt;img'));assert.ok(!ui.render().includes('<img src=x'));
  const session=beginListening(state,'en',lesson.id,null,3000);
  assert.ok(!ui.render().includes('&lt;script'));assert.ok(!ui.render().includes(source.url));
  for(const q of lesson.questions)answerListening(session,q.id,q.answer,state);submitListening(state,'en',4000);
  assert.ok(ui.render().includes('&lt;script'));assert.ok(!ui.render().includes('<script>bad'));assert.ok(ui.render().includes(source.url));assert.ok(ui.render().includes('CC BY-SA 4.0'));
});
test('A generation response after leaving the AI page cannot install a stale preview or modify learning data',async t=>{
  globalThis.document={querySelectorAll:()=>[],querySelector:()=>null};t.after(()=>delete globalThis.document);
  let resolve,show=true;const state=freshState();
  const client={config:{},remember:false,verified:true,complete:()=>new Promise(done=>{resolve=done;})};
  const ui=createAIView({client,getState:()=>state,render(){},visible:()=>show,notify(){},persist:()=>true,speech:{stop(){}},e,icon:()=>''});
  ui.input({id:'ai-topic',value:'Coffee',dataset:{}});
  ui.action({dataset:{action:'ai-generate'}});assert.match(ui.render(),/正在编写/);
  ui.leave(true);show=false;resolve({choices:[{message:{content:JSON.stringify(reply())}}]});await new Promise(done=>setImmediate(done));
  assert.equal(state.listening.customLessons.length,0);assert.ok(!ui.render().includes('生成完成'));
});
