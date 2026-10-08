import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { builtinEntries } from '../web/dist/data.js';
import { freshState, validateState, createSession, recordAnswer, summarize, saveLearningPlan, setEnglishAccent, dailyWordIds, allEntries, parseWordList, dayKey } from '../web/dist/core.js';

function answer(state,id,now,{mode='recall',answer='tried',skip=false}={}) {
  const entry=allEntries(state).find(item=>item.id===id);
  const session=createSession({...state.prefs[entry.language],language:entry.language,mode},allEntries(state),now,[id]);
  state.sessions[entry.language]=session;
  return recordAnswer(state,session,entry,answer,{now,skip});
}
test('First-open plan saves custom daily goals and accent across reload and backup restore',()=>{
  const state=freshState();assert.equal(state.onboardingComplete,false);
  saveLearningPlan(state,{enGoal:17,jaGoal:6,accent:'en-GB'});
  const restored=validateState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.onboardingComplete,true);assert.equal(restored.prefs.en.goal,17);
  assert.equal(restored.prefs.ja.goal,6);assert.equal(restored.prefs.en.accent,'en-GB');
  for(const value of [0,101,2.5,NaN,'20']){
    const before=structuredClone(restored);
    assert.throws(()=>saveLearningPlan(restored,{enGoal:value,jaGoal:10,accent:'en-US'}));
    assert.deepEqual(restored,before);
    const invalid=structuredClone(restored);invalid.prefs.en.goal=value;assert.throws(()=>validateState(invalid));
  }
  assert.throws(()=>validateState({...restored,onboardingComplete:'yes'}));
  const invalid=structuredClone(restored);invalid.prefs.en.accent='en-AU';assert.throws(()=>validateState(invalid));
});
test('Older saved sessions retain results and drafts when accent and onboarding fields are added',async()=>{
  const old=JSON.parse(await readFile(new URL('./fixtures/fresh-backup.json',import.meta.url),'utf8'));
  old.prefs.en.goal=30;
  const session=createSession({...old.prefs.en,language:'en',shuffle:false},builtinEntries,1000);
  delete session.settings.accent;session.draft='app';old.sessions.en=session;
  const restored=validateState(old);
  assert.equal(restored.onboardingComplete,false);assert.equal(restored.prefs.en.goal,30);
  assert.equal(restored.prefs.en.accent,'en-US');assert.equal(restored.sessions.en.settings.accent,'en-US');
  assert.equal(restored.sessions.en.draft,'app');assert.deepEqual(restored.sessions.en.ids,session.ids);
});
test('Switching accent clears incompatible voices in preferences and the active group without losing answers',()=>{
  const state=freshState();answer(state,'en-w-1',1000,{answer:'apple'});
  state.prefs.en.voice='us-voice';state.sessions.en.settings.voice='us-voice';
  const result=structuredClone(state.sessions.en.currentResult), ja=structuredClone(state.prefs.ja);
  setEnglishAccent(state,'en-GB');
  assert.equal(state.prefs.en.voice,'');assert.equal(state.sessions.en.settings.voice,'');
  assert.equal(state.sessions.en.settings.accent,'en-GB');assert.deepEqual(state.sessions.en.currentResult,result);
  assert.deepEqual(state.prefs.ja,ja);validateState(state);
});
test('Daily words deduplicate across modes and books and exclude phrases, skips, blank answers and other days/languages',()=>{
  const state=freshState(),now=new Date(2026,9,9,12).getTime();
  const yesterday=new Date(2026,9,8,12).getTime();
  state.customBooks.push({id:'custom-duplicate',name:'重复词测试',language:'en',kind:'word',entries:parseWordList('APPLE | 苹果','en','word','custom-duplicate')});
  answer(state,'en-w-1',now,{answer:'apple'});answer(state,'en-w-1',now+1,{mode:'shadow',answer:''});
  answer(state,'custom-duplicate-1',now+2);answer(state,'en-p-1',now+3);
  answer(state,'en-w-2',now+4,{answer:'',skip:true});answer(state,'en-w-3',now+5,{answer:''});
  answer(state,'ja-w-1',now+6);answer(state,'en-w-4',yesterday);answer(state,'en-w-5',now+7,{mode:'shadow',answer:''});
  assert.equal(summarize(state,'en',now).todayWords,2);assert.equal(summarize(state,'en',now).today,7);
  assert.equal(summarize(state,'ja',now).todayWords,1);assert.equal(summarize(state,'en',yesterday).todayWords,1);
  const tomorrow=new Date(2026,9,10,0,0,1).getTime();assert.notEqual(dayKey(now),dayKey(tomorrow));
  assert.equal(summarize(state,'en',tomorrow).todayWords,0);validateState(state);
});
test('Daily plan fills only the remaining goal from unique active words and handles completion or a short library',()=>{
  const state=freshState(),now=new Date(2026,9,9,12).getTime();state.prefs.en.goal=3;
  answer(state,'en-w-1',now);const ids=dailyWordIds(state,'en',now);
  assert.equal(ids.length,2);assert.ok(!ids.includes('en-w-1'));
  assert.ok(ids.every(id=>builtinEntries.some(entry=>entry.id===id&&entry.language==='en'&&entry.kind==='word')));
  assert.deepEqual(dailyWordIds(state,'en',now),ids);
  for(const id of ids)answer(state,id,now);
  assert.deepEqual(dailyWordIds(state,'en',now),[]);
  state.prefs.ja.goal=100;assert.equal(dailyWordIds(state,'ja',now).length,20);
});
