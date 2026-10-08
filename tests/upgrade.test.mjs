import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { builtinEntries } from '../web/dist/data.js';
import { freshState,createSession,recordAnswer,nextQuestion,submitBatch,validateState,editCustomBook,archiveCustomBook,allEntries,parseWordList,summarize,dropStaleSessions } from '../web/dist/core.js';
import { LearningStore } from '../desktop/store.mjs';

test('First-version backups acquire desktop upgrade defaults without changing historical results',async()=>{
  const original=JSON.parse(await readFile(new URL('./fixtures/fresh-backup.json',import.meta.url),'utf8'));
  const restored=validateState(original);assert.equal(restored.version,1);assert.equal(restored.prefs.en.goal,10);assert.equal(restored.prefs.ja.dictationStyle,'step');assert.equal(restored.prefs.en.repeat,1);
  original.prefs.en.repeat=99;assert.throws(()=>validateState(original));
});
test('Batch drafts survive reload, and submitting the full group records every result exactly once',()=>{
  let state=freshState(),s=createSession({...state.prefs.en,language:'en',dictationStyle:'batch',shuffle:false,limit:5},builtinEntries,1000);
  state.sessions.en=s;s.batchDrafts={'en-w-1':'APPLE','en-w-2':'wter','en-w-3':'window','en-w-4':'school','en-w-5':'friend'};
  state=validateState(JSON.parse(JSON.stringify(state)));s=state.sessions.en;
  const result=submitBatch(state,s,2000);assert.equal(result.length,5);assert.equal(result.filter(item=>item.correct).length,4);assert.equal(state.history.length,5);assert.equal(s.index,5);assert.equal(submitBatch(state,s).length,0);validateState(state);
});
test('Editing and archiving a book preserve old answers and stable IDs without reviewing removed content',()=>{
  const state=freshState(),id='custom-test';
  const book={id,name:'我的词本',language:'en',kind:'word',entries:parseWordList('apple | 苹果\nwater | 水','en','word',id)};state.customBooks.push(book);
  state.sessions.en=createSession({...state.prefs.en,language:'en',book:id,shuffle:false},allEntries(state),1000);
  recordAnswer(state,state.sessions.en,book.entries[0],'aple',{now:2000});
  const oldId=book.entries[0].id;
  const edited=editCustomBook(state,id,{name:'更新词本',kind:'word',source:'water | 饮用水\nwindow | 窗户'});
  assert.equal(state.history[0].text,'apple');assert.equal(edited.entries.find(item=>item.text==='water').id,`${id}-2`);assert.equal(edited.entries.find(item=>item.id===oldId).archived,true);assert.equal(state.sessions.en,null);assert.equal(summarize(state,'en').wrong,0);validateState(state);
  archiveCustomBook(state,id);assert.equal(allEntries(state).some(entry=>entry.book===id),false);validateState(state);
  archiveCustomBook(state,id,false);assert.equal(allEntries(state).filter(entry=>entry.book===id).length,2);validateState(state);
});
test('Changing a book from words to phrases preserves historical word metadata',()=>{
  const state=freshState(),id='custom-kind',book={id,name:'内容',language:'en',kind:'word',entries:parseWordList('hello | 你好','en','word',id)};
  state.customBooks.push(book);const s=createSession({...state.prefs.en,language:'en',book:id,shuffle:false},allEntries(state),1000);state.sessions.en=s;recordAnswer(state,s,book.entries[0],'hello',{now:2000});
  editCustomBook(state,id,{name:'短句',kind:'phrase',source:'hello | 你好'});assert.equal(state.history[0].kind,'word');assert.equal(allEntries(state).find(entry=>entry.book===id).kind,'phrase');validateState(state);
});
test('Streaks use local calendar dates, goals stay independent by language, and shadowing counts as practice',()=>{
  const state=freshState();state.prefs.en.goal=20;const now=new Date(2026,9,8,12).getTime();
  for(const offset of [0,1,2]){const at=new Date(2026,9,8-offset,12).getTime();const s=createSession({...state.prefs.en,language:'en',mode:'shadow',shuffle:false},builtinEntries,at);recordAnswer(state,s,builtinEntries[0],'',{now:at});}
  assert.equal(summarize(state,'en',now).streak,3);assert.equal(summarize(state,'en',now).goal,20);assert.equal(summarize(state,'ja',now).goal,10);assert.equal(summarize(state,'en',now).graded,0);
});
test('Desktop saves are serialized, survive reopening and reject invalid replacements',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'tingdu-store-')),store=new LearningStore(directory),first=freshState(),second=freshState();second.prefs.en.goal=30;
  await Promise.all([store.save(JSON.stringify(first)),store.save(JSON.stringify(second))]);assert.equal(JSON.parse((await new LearningStore(directory).load()).raw).prefs.en.goal,30);
  assert.equal(JSON.parse(await readFile(path.join(directory,'learning.previous.json'),'utf8')).prefs.en.goal,10);
  await assert.rejects(store.save('{"version":99}'));assert.equal(JSON.parse((await store.load()).raw).prefs.en.goal,30);
  await writeFile(path.join(directory,'learning.json'),'broken');assert.equal((await store.load()).raw,'broken');
});
test('A restored unfinished session that points at archived entries is dropped instead of breaking the page',()=>{
  const state=freshState(),id='custom-stale';
  state.customBooks.push({id,name:'旧词本',language:'en',kind:'word',entries:parseWordList('apple | 苹果\nwater | 水','en','word',id)});
  state.sessions.en=createSession({...state.prefs.en,language:'en',book:id,shuffle:false},allEntries(state),1000);
  const finished=createSession({...state.prefs.ja,language:'ja',shuffle:false,limit:5},builtinEntries,1000);state.sessions.ja=finished;
  for(const entryId of finished.ids){recordAnswer(state,finished,builtinEntries.find(entry=>entry.id===entryId),'',{skip:true,now:2000});nextQuestion(finished);}
  const backup=structuredClone(state);backup.customBooks[0].archived=true;
  const restored=dropStaleSessions(validateState(backup));
  assert.equal(restored.sessions.en,null);assert.equal(restored.sessions.ja.index,5);
  const active=structuredClone(state);dropStaleSessions(active);assert.notEqual(active.sessions.en,null);
});
