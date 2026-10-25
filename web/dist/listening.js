import { listeningLessons } from './listening-data.js';
import { validateCustomLessons } from './generated-lessons.js';

export const freshListening = () => ({ sessions: { en: null, ja: null }, history: [], customLessons: [] });
export const allListeningLessons = state => [...listeningLessons, ...(state?.listening?.customLessons || [])];
export const lessonById = (id, state) => allListeningLessons(state).find(lesson => lesson.id === id);
export const listeningEntries = lesson => lesson.segments.map((segment, index) => ({
  id: `${lesson.id}-segment-${index}`, language: lesson.language, kind: 'phrase', text: segment.text
}));

export function beginListening(state, language, lessonId, questionIds = null, now = Date.now()) {
  const lesson = lessonById(lessonId, state);
  if (!lesson || lesson.language !== language) throw new Error('听力材料不存在或语言不匹配。');
  const ids = questionIds ?? lesson.questions.map(question => question.id);
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !lesson.questions.some(question => question.id === id))) throw new Error('听力题目无效。');
  const session = { id: `lc-s-${now}-${Math.random().toString(36).slice(2, 10)}`, lessonId, language, questionIds: [...ids], answers: {}, startedAt: now, submittedAt: null, plays: 0 };
  state.listening.sessions[language] = session;
  return session;
}

export function answerListening(session, questionId, option, state) {
  if (!session || session.submittedAt !== null) throw new Error('这组听力已交卷，请重新练习。');
  const question = lessonById(session.lessonId, state)?.questions.find(item => item.id === questionId);
  if (!question || !session.questionIds.includes(questionId) || !Number.isInteger(option) || option < 0 || option >= question.options.length) throw new Error('请选择这道题的有效选项。');
  session.answers[questionId] = option;
}

export function listeningResult(session, state) {
  const lesson = lessonById(session.lessonId, state);
  const items = session.questionIds.map(id => {
    const question = lesson.questions.find(item => item.id === id);
    return { question, selected: session.answers[id], correct: session.answers[id] === question.answer };
  });
  const correct = items.filter(item => item.correct).length;
  return { items, correct, total: items.length, percent: Math.round(correct / items.length * 100) };
}

export function submitListening(state, language, now = Date.now()) {
  const session = state.listening.sessions[language];
  if (!session) throw new Error('请先选择一篇听力材料。');
  if (session.submittedAt !== null) return session;
  const missing = session.questionIds.filter(id => !Object.hasOwn(session.answers, id));
  if (missing.length) throw new Error(`还有 ${missing.length} 道题未选择答案，请完成后再交卷。`);
  if (!Number.isSafeInteger(now) || now < session.startedAt) throw new Error('系统时间有变化，请校准时间后再交卷。');
  session.submittedAt = now;
  state.listening.history.push(structuredClone(session));
  state.listening.history = state.listening.history.slice(-100);
  return session;
}

export function listeningStats(state, language) {
  const history = state.listening.history.filter(item => item.language === language);
  let correct = 0, total = 0;
  const latest = new Map();
  for (const session of history) {
    const result = listeningResult(session, state);
    correct += result.correct; total += result.total;
    for (const item of result.items) latest.set(item.question.id, { ...item, lessonId: session.lessonId });
  }
  return { attempts: history.length, correct, total, accuracy: total ? Math.round(correct / total * 100) : null, mistakes: [...latest.values()].filter(item => !item.correct) };
}

// An optional extension of the existing backup. Old backups acquire an empty listening section.
export function validateListening(input) {
  if (input === undefined) return freshListening();
  const fail = () => { throw new Error('听力记录格式无效，请选择完整的听读学习备份。'); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const timestamp = value => integer(value) && value <= 8640000000000000;
  if (!object(input) || !object(input.sessions) || !Array.isArray(input.history) || input.history.length > 100) fail();
  const customLessons = validateCustomLessons(input.customLessons), state = { listening: { customLessons } };
  const validSession = (value, language, submitted = false) => {
    const lesson = object(value) && lessonById(value.lessonId, state);
    if (!lesson || lesson.language !== language || value.language !== language || typeof value.id !== 'string' || !/^lc-s-[\w-]{1,90}$/.test(value.id) || !Array.isArray(value.questionIds) || !value.questionIds.length || value.questionIds.length > lesson.questions.length || new Set(value.questionIds).size !== value.questionIds.length || !value.questionIds.every(id => lesson.questions.some(question => question.id === id)) || !object(value.answers) || !timestamp(value.startedAt) || !integer(value.plays) || value.plays > 10000) fail();
    const done = value.submittedAt !== null;
    if ((submitted && !done) || (done && (!timestamp(value.submittedAt) || value.submittedAt < value.startedAt))) fail();
    for (const [id, option] of Object.entries(value.answers)) {
      const question = lesson.questions.find(item => item.id === id);
      if (!value.questionIds.includes(id) || !question || !integer(option) || option >= question.options.length) fail();
    }
    if (done && value.questionIds.some(id => !Object.hasOwn(value.answers, id))) fail();
    // Keep only owned fields; grades are derived from the stable question IDs, never trusted from a backup.
    return { id: value.id, lessonId: value.lessonId, language, questionIds: [...value.questionIds], answers: { ...value.answers }, startedAt: value.startedAt, submittedAt: value.submittedAt, plays: value.plays };
  };
  const sessions = {};
  for (const language of ['en', 'ja']) sessions[language] = input.sessions[language] === null ? null : validSession(input.sessions[language], language);
  const history = input.history.map(value => validSession(value, value?.language, true));
  if (new Set(history.map(value => value.id)).size !== history.length) fail();
  const signature = value => JSON.stringify([value.lessonId, value.language, value.questionIds, value.questionIds.map(id => value.answers[id]), value.startedAt, value.submittedAt, value.plays]);
  for (const session of Object.values(sessions).filter(Boolean)) {
    const saved = history.find(item => item.id === session.id);
    if (saved && signature(saved) !== signature(session)) fail();
  }
  if (sessions.en && sessions.ja && sessions.en.id === sessions.ja.id) fail();
  return { sessions, history, customLessons };
}
