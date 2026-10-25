export const CUSTOM_LESSON_LIMIT = 30;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = () => { throw new Error('听力材料不完整或超出限制，未保存。请重新生成或检查备份。'); };
const text = (value, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail();
  return value.trim();
};
const timestamp = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;

export function validateLessonSource(source, language) {
  if (source === null) return null;
  if (!object(source) || source.license !== 'CC BY-SA 4.0' || !timestamp(source.retrievedAt)) fail();
  const title = text(source.title, 200);
  const url = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  if (source.url !== url) fail();
  return { title, url, license: 'CC BY-SA 4.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/', retrievedAt: source.retrievedAt };
}

export function validateCustomLesson(input) {
  if (!object(input) || typeof input.id !== 'string' || !/^lc-ai-[\w-]{1,80}$/.test(input.id) || !['en','ja'].includes(input.language) || !['入门','进阶'].includes(input.level) || !timestamp(input.createdAt)) fail();
  if (!Array.isArray(input.segments) || input.segments.length < 3 || input.segments.length > 6 || !Array.isArray(input.questions) || input.questions.length !== 3) fail();
  const segments = input.segments.map(s => {
    if (!object(s)) fail();
    return { speaker: text(s.speaker, 40), text: text(s.text, 300), translation: text(s.translation, 500) };
  });
  const questions = input.questions.map((q, i) => {
    if (!object(q) || q.id !== `${input.id}-q${i + 1}` || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) fail();
    const options = q.options.map(o => text(o, 180));
    if (new Set(options).size !== 4) fail();
    return { id:q.id, prompt:text(q.prompt, 300), options, answer:q.answer, explanation:text(q.explanation, 600) };
  });
  return { id:input.id, language:input.language, title:text(input.title, 100), kind:'passage', level:input.level, createdAt:input.createdAt, source:validateLessonSource(input.source, input.language), segments, questions };
}

export function generatedLesson(reply, { language, level, source = null }, now = Date.now()) {
  if (!object(reply) || !Array.isArray(reply.questions)) fail();
  const id = `lc-ai-${crypto.randomUUID()}`;
  return validateCustomLesson({ ...reply, id, language, level, source, createdAt:now, questions:reply.questions.map((q,i) => ({ ...q, id:`${id}-q${i+1}` })) });
}
export function validateCustomLessons(input = []) {
  if (!Array.isArray(input) || input.length > CUSTOM_LESSON_LIMIT) fail();
  const lessons = input.map(validateCustomLesson);
  if (new Set(lessons.map(l => l.id)).size !== lessons.length) fail();
  return lessons;
}
export function saveCustomLesson(state, lesson) {
  const lessons = state.listening.customLessons;
  if (lessons.length >= CUSTOM_LESSON_LIMIT) throw new Error('已保存 30 篇自建听力，请先导出备份，再删除不需要的材料。');
  const checked = validateCustomLesson(lesson);
  if (lessons.some(item => item.id === checked.id)) throw new Error('这篇听力已经保存。');
  lessons.push(checked);
  return checked;
}
export function deleteCustomLesson(state, id) {
  const lessons = state.listening.customLessons;
  if (!lessons.some(item => item.id === id)) throw new Error('只能删除自建听力材料。');
  state.listening.customLessons = lessons.filter(item => item.id !== id);
  state.listening.history = state.listening.history.filter(item => item.lessonId !== id);
  for (const language of ['en','ja']) if (state.listening.sessions[language]?.lessonId === id) state.listening.sessions[language] = null;
}
