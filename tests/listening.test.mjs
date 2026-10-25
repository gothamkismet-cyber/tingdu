import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listeningLessons } from '../web/dist/listening-data.js';
import { beginListening, answerListening, submitListening, listeningResult, listeningStats, listeningEntries } from '../web/dist/listening.js';
import { freshState, validateState, summarize, dailyWordIds } from '../web/dist/core.js';
import { createListeningView } from '../web/dist/listening-view.js';
import { LearningStore } from '../desktop/store.mjs';

const en = listeningLessons.find(item => item.language === 'en');
const ja = listeningLessons.find(item => item.language === 'ja');
function complete(state, lesson = en, wrong = []) {
  const session = beginListening(state, lesson.language, lesson.id, null, 1000);
  for (const question of lesson.questions) answerListening(session, question.id, (question.answer + (wrong.includes(question.id) ? 1 : 0)) % 4);
  submitListening(state, lesson.language, 2000);
  return session;
}

test('Listening materials have unique questions, four distinct options and speech-sized segments', () => {
  assert.equal(listeningLessons.length, 12);
  const ids = new Set();
  for (const language of ['en', 'ja']) {
    assert.equal(listeningLessons.filter(item => item.language === language).length, 6);
    assert.equal(listeningLessons.filter(item => item.language === language && item.kind === 'dialogue').length, 3);
  }
  for (const lesson of listeningLessons) {
    assert.equal(lesson.questions.length, 3);
    for (const entry of listeningEntries(lesson)) { assert.equal(entry.kind, 'phrase'); assert.ok(entry.text.length > 0 && entry.text.length <= 300); }
    for (const question of lesson.questions) {
      assert.ok(!ids.has(question.id)); ids.add(question.id);
      assert.equal(new Set(question.options).size, 4);
      assert.ok(question.options[question.answer]); assert.ok(question.explanation.trim());
    }
  }
  assert.equal(ids.size, 36);
});

test('Old backups acquire empty listening state while bilingual drafts survive round trips independently', () => {
  const old = freshState(); delete old.listening;
  const upgraded = validateState(old);
  assert.deepEqual(upgraded.listening, { sessions: { en: null, ja: null }, history: [], customLessons: [] });
  const english = beginListening(upgraded, 'en', en.id, null, 10);
  answerListening(english, en.questions[0].id, 2);
  const japanese = beginListening(upgraded, 'ja', ja.id, null, 20);
  answerListening(japanese, ja.questions[1].id, 0);
  const restored = validateState(JSON.parse(JSON.stringify(upgraded)));
  assert.deepEqual(restored.listening, upgraded.listening);
  assert.equal(restored.sessions.en, null);
  assert.throws(() => beginListening(restored, 'en', ja.id), /语言/);
});

test('Submission requires all choices, grades once, locks answers and never advances the daily word goal', () => {
  const state = freshState(), before = dailyWordIds(state, 'en', 1000);
  const session = beginListening(state, 'en', en.id, null, 1000);
  answerListening(session, en.questions[0].id, en.questions[0].answer);
  assert.throws(() => submitListening(state, 'en', 2000), /还有 2 道题/);
  assert.equal(state.listening.history.length, 0);
  for (const question of en.questions.slice(1)) answerListening(session, question.id, (question.answer + 1) % 4);
  submitListening(state, 'en', 2000); submitListening(state, 'en', 3000);
  assert.equal(state.listening.history.length, 1);
  assert.equal(listeningResult(session).correct, 1);
  assert.equal(listeningResult(session).percent, 33);
  assert.throws(() => answerListening(session, en.questions[1].id, en.questions[1].answer), /已交卷/);
  assert.equal(summarize(state, 'en', 2000).todayWords, 0);
  assert.deepEqual(dailyWordIds(state, 'en', 1000), before);
  assert.equal(state.history.length, 0);
  assert.deepEqual(validateState(state).listening, state.listening);
});

test('Retrying only wrong listening questions clears just those mistakes and preserves earlier grades', () => {
  const state = freshState(), wrongId = en.questions[1].id;
  const original = complete(state, en, [wrongId]);
  assert.equal(listeningStats(state, 'en').mistakes.length, 1);
  const retry = beginListening(state, 'en', en.id, [wrongId], 3000);
  answerListening(retry, wrongId, en.questions[1].answer);
  submitListening(state, 'en', 4000);
  assert.equal(listeningStats(state, 'en').mistakes.length, 0);
  assert.equal(listeningStats(state, 'en').total, 4);
  assert.equal(listeningStats(state, 'en').correct, 3);
  assert.equal(listeningResult(original).correct, 2);
  assert.equal(listeningStats(state, 'ja').attempts, 0);
});

test('Malformed listening backups reject unknown IDs, foreign choices, duplicate grades and conflicting session copies', () => {
  const state = freshState(); complete(state);
  const corruptions = [
    s => { s.listening.sessions.en.lessonId = ja.id; },
    s => { s.listening.sessions.en.questionIds = ['unknown']; },
    s => { s.listening.sessions.en.questionIds.push(s.listening.sessions.en.questionIds[0]); },
    s => { s.listening.sessions.en.answers[en.questions[0].id] = 4; },
    s => { s.listening.sessions.en.answers.foreign = 0; },
    s => { delete s.listening.sessions.en.answers[en.questions[0].id]; },
    s => { s.listening.history.push(structuredClone(s.listening.history[0])); },
    s => { s.listening.sessions.en.answers[en.questions[0].id] = (en.questions[0].answer + 1) % 4; },
    s => { s.listening.sessions.en.submittedAt = 1; },
    s => { s.listening.sessions.en.submittedAt = Number.MAX_SAFE_INTEGER; },
    s => { s.listening.sessions.en.plays = -1; }
  ];
  for (const corrupt of corruptions) { const copy = structuredClone(state); corrupt(copy); assert.throws(() => validateState(copy), /听力记录/); }
  assert.throws(() => beginListening(state, 'en', en.id, []), /题目无效/);
});

test('Transcripts, translations and explanations are absent before submission and appear after grading', () => {
  const state = freshState(); const session = beginListening(state, 'en', en.id, null, 1000);
  const e = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const ui = createListeningView({ getState: () => state, e, icon: () => '', visible: () => true });
  const before = ui.render();
  assert.ok(before.includes('交卷看解析'));
  assert.ok(!before.includes(e(en.segments[0].text)));
  assert.ok(!before.includes(e(en.segments[0].translation)));
  assert.ok(!before.includes(e(en.questions[0].explanation)));
  for (const question of en.questions) answerListening(session, question.id, question.answer);
  submitListening(state, 'en', 2000);
  const after = ui.render();
  assert.ok(after.includes(e(en.segments[0].text)));
  assert.ok(after.includes(e(en.segments[0].translation)));
  assert.ok(after.includes(e(en.questions[0].explanation)));
  assert.ok(after.includes('100%'));
});

test('Listening history is bounded and desktop saving preserves grades plus unfinished Japanese answers', async () => {
  const state = freshState();
  for (let i = 0; i < 102; i++) complete(state);
  assert.equal(state.listening.history.length, 100);
  const draft = beginListening(state, 'ja', ja.id, null, 3000);
  answerListening(draft, ja.questions[0].id, 2);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tingdu-listening-test-'));
  try {
    const store = new LearningStore(directory);
    await store.save(JSON.stringify(state)); await store.flush();
    const restored = validateState(JSON.parse((await new LearningStore(directory).load()).raw));
    assert.deepEqual(restored.listening, state.listening);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('tingdu-listening-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});
