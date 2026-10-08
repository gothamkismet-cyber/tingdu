import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinEntries } from '../web/dist/data.js';
import { freshState, evaluateAnswer, normalizeAnswer, diffAnswer, createSession, nextQuestion, recordAnswer, summarize, reviewGroups, parseWordList, validateState, makeChoices } from '../web/dist/core.js';

const entry = id => builtinEntries.find(item => item.id === id);
const settings = (state, language='en', changes={}) => ({...state.prefs[language],language,shuffle:false,...changes});

test('English accepts case, terminal punctuation and whitespace without merging distinct words', () => {
  assert.equal(evaluateAnswer(entry('en-w-1'),' APPLE! ').correct,true);
  assert.equal(evaluateAnswer(entry('en-p-3'),'i  would like some water').correct,true);
  assert.equal(evaluateAnswer(entry('en-w-1'),'aple').correct,false);
  assert.equal(normalizeAnswer("don’t",'en'),"don't");
  assert.notEqual(normalizeAnswer('dont','en'),normalizeAnswer("don't",'en'));
  assert.equal(evaluateAnswer(entry('en-w-1'),'').correct,false);
});
test('Japanese reading and written answers stay distinct', () => {
  const school=entry('ja-w-1');
  assert.equal(evaluateAnswer(school,'学校','written').correct,true);
  assert.equal(evaluateAnswer(school,'がっこう','written').correct,false);
  assert.equal(evaluateAnswer(school,'ガッコウ','reading').correct,true);
  assert.equal(evaluateAnswer(school,'学校','reading').correct,false);
  assert.equal(evaluateAnswer(entry('ja-p-7'),'いま なんじですか。','reading').correct,true);
  assert.equal(evaluateAnswer(entry('ja-w-18'),'ｺｰﾋｰ','written').correct,true);
});
test('Japanese small kana, long vowels and doubled consonants cannot be silently corrected', () => {
  assert.equal(evaluateAnswer(entry('ja-w-15'),'きて','reading').correct,false);
  assert.equal(evaluateAnswer(entry('ja-w-16'),'おかさん','reading').correct,false);
  assert.equal(evaluateAnswer(entry('ja-w-9'),'きよう','reading').correct,false);
  assert.equal(evaluateAnswer(entry('ja-w-18'),'コヒー','reading').correct,false);
});
test('Unicode feedback identifies missing and extra characters', () => {
  const missing=diffAnswer('aple','apple');
  assert.equal(missing.filter(part=>part.type==='missing').map(part=>part.expected).join(''),'p');
  assert.equal(diffAnswer('きて','きって').find(part=>part.type==='missing').expected,'っ');
  assert.equal(diffAnswer('appple','apple').filter(part=>part.type==='extra').length,1);
});
test('A submitted result is written once and survives a serialized reload', () => {
  const state=freshState(),s=createSession(settings(state),builtinEntries,1000);
  state.sessions.en=s;
  recordAnswer(state,s,entry('en-w-1'),'apple',{now:2000});
  recordAnswer(state,s,entry('en-w-1'),'wrong',{now:3000});
  assert.equal(state.history.length,1);
  const restored=validateState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.sessions.en.currentResult.correct,true);
  assert.equal(restored.sessions.en.index,0);
  assert.equal(nextQuestion(restored.sessions.en),true);
  assert.equal(restored.sessions.en.index,1);
  assert.equal(nextQuestion(restored.sessions.en),false);
});
test('Hints do not count as independent correct answers or clear existing mistakes', () => {
  const state=freshState(),s=createSession(settings(state),builtinEntries,1000);
  state.sessions.en=s;
  recordAnswer(state,s,entry('en-w-1'),'aple',{now:2000});
  const retry=createSession(settings(state),builtinEntries,3000,['en-w-1']);state.sessions.en=retry;retry.hints=1;
  recordAnswer(state,retry,entry('en-w-1'),'apple',{now:4000});
  const stats=summarize(state,'en',4000);
  assert.equal(stats.independent,0);assert.equal(stats.assisted,1);assert.equal(stats.accuracy,0);assert.equal(stats.wrong,1);
  assert.equal(reviewGroups(state,'en',4000)[0].mode,'dictation');
  const final=createSession(settings(state),builtinEntries,5000,['en-w-1']);state.sessions.en=final;
  recordAnswer(state,final,entry('en-w-1'),'apple',{now:6000});
  assert.equal(summarize(state,'en',6000).wrong,0);
  assert.equal(reviewGroups(state,'en',6000).length,0);
  assert.equal(reviewGroups(state,'en',6000+86400000).length,1);
});
test('Language, mode and Japanese answer requirements keep their own review state', () => {
  const state=freshState();
  for(const [mode,form] of [['dictation','reading'],['recall','written']]) {
    const s=createSession(settings(state,'ja',{mode,form}),builtinEntries,1000);
    recordAnswer(state,s,entry('ja-w-1'),'bad',{now:2000});
  }
  assert.equal(Object.keys(state.progress).length,2);
  assert.equal(reviewGroups(state,'ja',2000).length,2);
  assert.equal(reviewGroups(state,'en',2000).length,0);
});
test('Reading scores comprehension; shadowing has no invented score', () => {
  const state=freshState();
  const reading=createSession(settings(state,'en',{mode:'reading'}),builtinEntries,1000);
  recordAnswer(state,reading,entry('en-w-1'),'苹果',{now:2000});
  const shadow=createSession(settings(state,'en',{mode:'shadow'}),builtinEntries,3000);
  recordAnswer(state,shadow,entry('en-w-1'),'',{now:4000});
  assert.equal(state.history[1].correct,null);
  assert.equal(summarize(state,'en',4000).accuracy,100);
  assert.equal(summarize(state,'en',4000).graded,1);
  assert.equal(Object.keys(state.progress).length,1);
});
test('Custom lists validate complete rows and preserve literal text safely for rendering', () => {
  const en=parseWordList('window | 窗户\npractice\t练习','en','word','custom-test');
  assert.equal(en.length,2);
  assert.equal(parseWordList('学校 | がっこう | 学校','ja','word','custom-test')[0].reading,'がっこう');
  assert.throws(()=>parseWordList('学校 | 学校','ja','word','custom-test'),/第 1 行/);
  assert.throws(()=>parseWordList('学校 | 学校 | 学校','ja','word','custom-test'),/假名/);
  assert.throws(()=>parseWordList('apple | 苹果\nAPPLE | 苹果','en','word','custom-test'),/重复/);
  assert.equal(parseWordList('<b>hi</b> | 问候','en','word','custom-test')[0].text,'<b>hi</b>');
});
test('Backups reject inconsistent scores, unsupported versions and unknown session entries', () => {
  const state=freshState();assert.deepEqual(validateState(state),state);
  assert.throws(()=>validateState({...state,version:2}));
  const s=createSession(settings(state),builtinEntries,1000);state.sessions.en=s;
  recordAnswer(state,s,entry('en-w-1'),'apple',{now:2000});
  const badScore=structuredClone(state);Object.values(badScore.progress)[0].independent=99;assert.throws(()=>validateState(badScore));
  const badSession=structuredClone(state);badSession.sessions.en.ids[0]='missing';assert.throws(()=>validateState(badSession));
  const badBook=structuredClone(state);badBook.prefs.en.book='ja-words';assert.throws(()=>validateState(badBook));
  const mixedLanguage=structuredClone(state);mixedLanguage.history[0].language='ja';assert.throws(()=>validateState(mixedLanguage));
  const fakeShadowScore=structuredClone(state);fakeShadowScore.history[0].mode='shadow';assert.throws(()=>validateState(fakeShadowScore));
});
test('Choices remain stable on reload and have exactly one correct meaning', () => {
  const choices=makeChoices(entry('ja-p-1'),builtinEntries,'seed');
  assert.equal(choices.length,4);
  assert.equal(choices.filter(text=>text===entry('ja-p-1').meaning).length,1);
  assert.deepEqual(choices,makeChoices(entry('ja-p-1'),builtinEntries,'seed'));
});
test('Review selection respects ordering and does not include another language', () => {
  const state=freshState(),s=createSession(settings(state),builtinEntries,1000,['en-w-3','en-w-1','ja-w-1','en-w-3']);
  assert.deepEqual(s.ids,['en-w-3','en-w-1']);
});
