import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, STORAGE_KEY } from '../web/dist/core.js';
import { loadLearningState } from '../web/dist/storage.js';

const snapshot=goal=>{const state=freshState();state.prefs.en.goal=goal;return JSON.stringify(state);};
const cache=(raw,pending=false)=>({getItem:key=>key===STORAGE_KEY?raw:key==='tingdu:desktop-pending'&&pending?'pending':null});
const bridge=raw=>({loadState:async()=>({exists:true,raw}),info:async()=>({version:'2.0.0'})});

test('Desktop file wins over an older cache, while an interrupted save recovers the latest cached progress',async()=>{
  const file=await loadLearningState(cache(snapshot(10)),bridge(snapshot(20)));
  assert.equal(file.state.prefs.en.goal,20);assert.equal(file.desktopReadProblem,false);
  const interrupted=await loadLearningState(cache(snapshot(30),true),bridge(snapshot(20)));
  assert.equal(interrupted.state.prefs.en.goal,30);
});

test('An unreadable desktop file preserves valid cached progress and blocks automatic file replacement',async()=>{
  const desktop={...bridge(null),loadState:async()=>{throw new Error('EACCES');}};
  const loaded=await loadLearningState(cache(snapshot(20)),desktop);
  assert.equal(loaded.state.prefs.en.goal,20);assert.equal(loaded.desktopReadProblem,true);assert.match(loaded.storageProblem,/不覆盖原文件/);
});

test('A broken saved file remains available for export, and unavailable cache access can still load the desktop file',async()=>{
  const broken=await loadLearningState(cache(snapshot(10)),bridge('{broken'));
  assert.equal(broken.corruptRaw,'{broken');
  const unavailable=await loadLearningState(()=>{throw new Error('disabled');},bridge(snapshot(30)));
  assert.equal(unavailable.state.prefs.en.goal,30);assert.equal(unavailable.corruptRaw,null);
});
