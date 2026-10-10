import { builtinEntries, builtinBooks, modes, languages, englishAccents } from './data.js';
import { freshListening, validateListening } from './listening.js';

export const STORAGE_KEY = 'tingdu:v1';
const DAY = 86400000;
const defaults = lang => ({ book: `${lang}-words`, mode: 'dictation', form: lang === 'ja' ? 'reading' : 'written', limit: 10, rate: 0.85, voice: '', kana: true, shuffle: true, dictationStyle:'step', repeat:1, pause:4, goal:10, ...(lang==='en'?{accent:'en-US'}:{}) });
export function freshState() {
  return { version: 1, language: 'en', onboardingComplete: false, prefs: { en: defaults('en'), ja: defaults('ja') }, customBooks: [], progress: {}, history: [], sessions: { en: null, ja: null }, listening: freshListening() };
}
export const validDailyGoal = value => Number.isSafeInteger(value) && value >= 1 && value <= 100;
export function setEnglishAccent(state, accent) {
  if(!Object.hasOwn(englishAccents,accent))throw new Error('请选择美式英语或英式英语。');
  state.prefs.en.accent=accent;state.prefs.en.voice='';
  if(state.sessions.en){state.sessions.en.settings.accent=accent;state.sessions.en.settings.voice='';}
}
export function saveLearningPlan(state, {enGoal,jaGoal,accent}) {
  if(!validDailyGoal(enGoal)||!validDailyGoal(jaGoal))throw new Error('每日单词数请填写 1–100 之间的整数。');
  if(!Object.hasOwn(englishAccents,accent))throw new Error('请选择美式英语或英式英语。');
  if(state.prefs.en.accent!==accent)setEnglishAccent(state,accent);
  state.prefs.en.goal=enGoal;state.prefs.ja.goal=jaGoal;state.onboardingComplete=true;
}
export const allEntries = (state,includeArchived=false) => [...builtinEntries, ...state.customBooks.filter(book=>includeArchived||!book.archived).flatMap(book => book.entries.filter(entry=>includeArchived||!entry.archived))];
export const allBooks = (state,includeArchived=false) => [...builtinBooks, ...state.customBooks.filter(book=>includeArchived||!book.archived)];
export const isBatch = session => session?.settings.mode==='dictation'&&session.settings.dictationStyle==='batch';
export const answerKey = (entry, mode, form) => `${entry.id}|${mode}|${entry.language === 'ja' && ['dictation', 'recall'].includes(mode) ? form : 'written'}`;

export function normalizeAnswer(value, language, form = 'written') {
  let text = String(value).normalize('NFKC').trim().replace(/[’‘]/g, "'").replace(/[.!?。！？]+$/u, '').trim();
  if (language === 'en') return text.toLocaleLowerCase('en').replace(/\s+/g, ' ');
  text = text.replace(/[\s、,]/g, '');
  if (form === 'reading') text = text.replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
  return text;
}
export function expectedAnswer(entry, form) {
  return entry.language === 'ja' && form === 'reading' ? entry.reading : entry.text;
}
export function evaluateAnswer(entry, answer, form = 'written') {
  const expected = expectedAnswer(entry, form);
  const variants = entry.language === 'ja' && form === 'reading' ? entry.readingAccepted || [] : entry.accepted || [];
  const value = normalizeAnswer(answer, entry.language, form);
  return { correct: Boolean(value) && [expected, ...variants].some(item => normalizeAnswer(item, entry.language, form) === value), expected, normalized: value };
}

// Align Unicode characters, so Japanese and missing letters receive useful feedback.
export function diffAnswer(actual, expected) {
  const a = Array.from(actual).slice(0, 300), b = Array.from(expected).slice(0, 300);
  const grid = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) grid[i][0] = i;
  for (let j = 0; j <= b.length; j++) grid[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    grid[i][j] = Math.min(grid[i-1][j] + 1, grid[i][j-1] + 1, grid[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  }
  const parts = []; let i = a.length, j = b.length;
  while (i || j) {
    if (i && j && grid[i][j] === grid[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)) {
      parts.push({ type: a[i-1] === b[j-1] ? 'equal' : 'change', actual: a[--i], expected: b[--j] });
    } else if (j && grid[i][j] === grid[i][j-1] + 1) {
      parts.push({ type: 'missing', actual: '', expected: b[--j] });
    } else parts.push({ type: 'extra', actual: a[--i], expected: '' });
  }
  return parts.reverse();
}
export function shuffle(items, seed = Math.random().toString()) {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const j = n % (i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeChoices(entry, entries, seed) {
  const pool = [...new Set(entries.filter(item => item.language === entry.language && item.kind === entry.kind && item.meaning !== entry.meaning).map(item => item.meaning))];
  return shuffle([entry.meaning, ...shuffle(pool, seed).slice(0, 3)], `${seed}-choices`);
}
export function createSession(settings, entries, now = Date.now(), ids = null) {
  const selected = ids ? [...new Set(ids)].map(id => entries.find(entry => entry.id === id && entry.language === settings.language)).filter(Boolean) : entries.filter(entry => entry.language === settings.language && (settings.book === 'all' || entry.book === settings.book));
  if (!selected.length) throw new Error('词本里还没有内容，请先添加词条。');
  const sessionId = `s-${now}-${Math.random().toString(36).slice(2, 9)}`;
  const list = settings.shuffle ? shuffle(selected, sessionId) : selected;
  return { id: sessionId, settings: { ...defaults(settings.language), ...settings }, ids: list.slice(0, settings.limit).map(entry => entry.id), index: 0, results: [], draft: '', batchDrafts:{}, hints: 0, currentResult: null, startedAt: now };
}
export function nextQuestion(session) {
  if (!session.currentResult) return false;
  session.index++; session.draft = ''; session.hints = 0; session.currentResult = null;
  return true;
}
export function recordAnswer(state, session, entry, answer, { skip = false, now = Date.now() } = {}) {
  if (session.currentResult || session.index >= session.ids.length) return session.currentResult;
  const mode = session.settings.mode;
  const form = entry.language === 'ja' && ['dictation','recall'].includes(mode) ? session.settings.form : 'written';
  const graded = mode !== 'shadow';
  const correct = !graded ? null : skip ? false : ['meaning', 'reading'].includes(mode) ? answer === entry.meaning : evaluateAnswer(entry, answer, form).correct;
  const result = { id: `${session.id}-${session.index}`, sessionId: session.id, entryId: entry.id, language: entry.language, kind: entry.kind, mode, form, correct, assisted: session.hints > 0, answer: String(answer || '').slice(0, 300), at: now, text: entry.text, meaning: entry.meaning, reading: entry.reading || '', skipped: skip };
  if (graded) {
    const key = answerKey(entry, mode, form), prev = state.progress[key] || { attempts: 0, independent: 0, assisted: 0, incorrect: 0, stage: 0, mistake: false };
    const independent = correct && !result.assisted;
    const stage = independent ? Math.min(prev.stage + 1, 4) : 0;
    state.progress[key] = { ...prev, entryId: entry.id, language: entry.language, mode, form, attempts: prev.attempts + 1, independent: prev.independent + (independent ? 1 : 0), assisted: prev.assisted + (correct && result.assisted ? 1 : 0), incorrect: prev.incorrect + (!correct ? 1 : 0), stage, mistake: independent ? false : prev.mistake || !correct, nextReview: independent ? now + [0, 1, 3, 7, 14][stage] * DAY : now, lastAt: now, lastAnswer: result.answer };
  }
  state.history.push(result); state.history = state.history.slice(-5000);
  session.results.push(result); session.currentResult = result; session.draft = result.answer;
  return result;
}
export function dayKey(value = Date.now()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function submitBatch(state,session,now=Date.now()) {
  if(!isBatch(session)||session.index>=session.ids.length)return [];
  if(session.index!==0||session.results.length||session.currentResult)throw new Error('整组听写的进度不完整，请重新开始这一组。');
  const map=new Map(allEntries(state).map(entry=>[entry.id,entry]));
  if(session.ids.some(id=>!map.has(id)))throw new Error('词本内容已变动，请重新开始这一组。');
  const results=[];
  for(const id of session.ids){results.push(recordAnswer(state,session,map.get(id),session.batchDrafts?.[id]||'',{now}));nextQuestion(session);}
  return results;
}
export function learningStreak(state,language,now=Date.now()) {
  const dates=new Set(state.history.filter(item=>item.language===language).map(item=>dayKey(item.at)));
  const cursor=new Date(now);cursor.setHours(12,0,0,0);
  if(!dates.has(dayKey(cursor)))cursor.setDate(cursor.getDate()-1);
  let streak=0;while(dates.has(dayKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
  return streak;
}
function studiedWords(history) {
  return new Set(history.filter(item=>item.kind==='word'&&!item.skipped&&(item.mode==='shadow'||item.answer.trim())).map(item=>normalizeAnswer(item.text,item.language)));
}
export function dailyWordIds(state,language,now=Date.now()) {
  const done=studiedWords(state.history.filter(item=>item.language===language&&dayKey(item.at)===dayKey(now)));
  const remaining=Math.max(0,state.prefs[language].goal-done.size), seen=new Set(done);
  const candidates=shuffle(allEntries(state).filter(entry=>entry.language===language&&entry.kind==='word'),`${language}-${dayKey(now)}`);
  return candidates.filter(entry=>{const key=normalizeAnswer(entry.text,language);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,remaining).map(entry=>entry.id);
}
export function summarize(state, language, now = Date.now()) {
  const history = state.history.filter(item => item.language === language), graded = history.filter(item => item.correct !== null);
  const today = history.filter(item => dayKey(item.at) === dayKey(now));
  const todayWords = studiedWords(today).size;
  const independent = graded.filter(item => item.correct && !item.assisted).length;
  const progress = Object.values(state.progress).filter(item => item.language === language);
  const activeIds=new Set(allEntries(state).map(entry=>entry.id));
  return { total: history.length, graded: graded.length, independent, assisted: graded.filter(item => item.correct && item.assisted).length, accuracy: graded.length ? Math.round(independent / graded.length * 100) : null, today: today.length, todayWords, wrong: new Set(progress.filter(item => activeIds.has(item.entryId)&&item.mistake).map(item => item.entryId)).size, due: new Set(progress.filter(item => activeIds.has(item.entryId)&&item.nextReview <= now).map(item => item.entryId)).size, practiced: new Set(history.map(item => item.entryId)).size, goal:state.prefs[language].goal||10, streak:learningStreak(state,language,now) };
}
export function reviewGroups(state, language, now = Date.now(), onlyMistakes = false) {
  const groups = new Map(), known = new Set(allEntries(state).map(entry => entry.id));
  for (const item of Object.values(state.progress)) {
    if (item.language !== language || !known.has(item.entryId) || (onlyMistakes ? !item.mistake : !item.mistake && item.nextReview > now)) continue;
    const key = `${item.mode}|${item.form}`;
    if (!groups.has(key)) groups.set(key, { key, mode: item.mode, form: item.form, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].map(group => ({ ...group, items: group.items.sort((a,b) => Number(b.mistake) - Number(a.mistake) || a.nextReview - b.nextReview) }));
}
function validKanaReading(value) {
  const text=String(value).normalize('NFKC');
  return /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) && /^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s、，。！？!?.,0-9]+$/u.test(text);
}
export function parseWordList(source, language, kind, bookId) {
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 500) throw new Error('请输入 1–500 行词条。');
  const seen = new Set();
  return lines.map((line, index) => {
    const cells = line.split(/\t|\|/).map(cell => cell.trim());
    const needed = language === 'ja' ? 3 : 2;
    if (cells.length !== needed || cells.some(cell => !cell || cell.length > 300)) throw new Error(`第 ${index+1} 行格式有误：${language === 'ja' ? '原文 | 假名读音 | 中文释义' : '原文 | 中文释义'}，每项最多 300 字。`);
    const [text, second, third] = cells;
    if (language === 'ja' && !validKanaReading(second)) throw new Error(`第 ${index+1} 行读音请用假名填写，例如：がっこう。`);
    if (seen.has(normalizeAnswer(text, language))) throw new Error(`第 ${index+1} 行重复：${text}`);
    seen.add(normalizeAnswer(text, language));
    return { id: `${bookId}-${index+1}`, book: bookId, language, kind, text, meaning: language === 'ja' ? third : second, ...(language === 'ja' ? { reading: second } : {}) };
  });
}

export function editCustomBook(state,bookId,{name,kind,source}) {
  const book=state.customBooks.find(item=>item.id===bookId);
  if(!book||book.archived)throw new Error('这个词本不能编辑。');
  if(typeof name!=='string'||!name.trim()||name.trim().length>60||!['word','phrase'].includes(kind))throw new Error('请填写词本名称和内容类型。');
  const parsed=parseWordList(source,book.language,kind,bookId);
  const old=new Map(book.entries.filter(entry=>!entry.archived).map(entry=>[normalizeAnswer(entry.text,book.language),entry]));
  const changed=new Set(),used=new Set(book.entries.map(entry=>entry.id));
  const fresh=parsed.map((entry,index)=>{
    const previous=old.get(normalizeAnswer(entry.text,book.language));
    if(previous&&previous.kind===kind){if(previous.meaning!==entry.meaning||previous.reading!==entry.reading)changed.add(previous.id);return {...entry,id:previous.id};}
    let suffix=book.entries.length+index+1;while(used.has(`${bookId}-${suffix}`))suffix++;
    const id=`${bookId}-${suffix}`;used.add(id);return {...entry,id};
  });
  const keep=new Set(fresh.map(entry=>entry.id));
  const archived=book.entries.filter(entry=>!keep.has(entry.id)).map(entry=>({...entry,archived:true}));
  if(fresh.length+archived.length>2000)throw new Error('这个词本累计历史内容较多，请另建一本；现有内容仍保留。');
  for(const entry of archived)changed.add(entry.id);
  const updated={...book,name:name.trim(),kind,entries:[...fresh,...archived]};
  state.customBooks[state.customBooks.indexOf(book)]=updated;
  for(const [key,item] of Object.entries(state.progress))if(changed.has(item.entryId))delete state.progress[key];
  for(const language of ['en','ja'])if(state.sessions[language]?.ids.some(id=>changed.has(id)))state.sessions[language]=null;
  return updated;
}
// A restored backup can hold an unfinished session whose entries were archived; it can no longer be shown.
export function dropStaleSessions(state) {
  const active=new Set(allEntries(state).map(entry=>entry.id));
  for(const language of ['en','ja']){
    const session=state.sessions[language];
    if(session&&session.index<session.ids.length&&session.ids.slice(isBatch(session)?0:session.index).some(id=>!active.has(id)))state.sessions[language]=null;
  }
  return state;
}
export function archiveCustomBook(state,bookId,archived=true) {
  const book=state.customBooks.find(item=>item.id===bookId);if(!book)throw new Error('词本不存在。');
  book.archived=archived;
  if(archived){
    if(state.prefs[book.language].book===bookId)state.prefs[book.language].book=`${book.language}-words`;
    if(state.sessions[book.language]?.ids.some(id=>book.entries.some(entry=>entry.id===id)))state.sessions[book.language]=null;
  }
}

// Reject malformed backups before replacing any current learning data.
export function validateState(input) {
  const fail = () => { throw new Error('记录格式无效，请选择由听读导出的完整备份。'); };
  const obj = value => value && typeof value === 'object' && !Array.isArray(value);
  const str = (value, max = 300) => typeof value === 'string' && value.length <= max;
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const language = value => Object.hasOwn(languages, value);
  const mode = value => Object.hasOwn(modes, value);
  const form = value => ['written', 'reading'].includes(value);
  const prefs = value => obj(value) && str(value.book, 100) && mode(value.mode) && form(value.form) && [5,10,20,30,50,100].includes(value.limit) && Number.isFinite(value.rate) && value.rate >= .5 && value.rate <= 1.5 && str(value.voice, 500) && typeof value.kana === 'boolean' && typeof value.shuffle === 'boolean' && (value.dictationStyle===undefined||['step','batch'].includes(value.dictationStyle)) && (value.repeat===undefined||[1,2,3].includes(value.repeat)) && (value.pause===undefined||[2,4,6,8].includes(value.pause)) && (value.goal===undefined||validDailyGoal(value.goal)) && (value.accent===undefined||Object.hasOwn(englishAccents,value.accent));
  if (!obj(input) || input.version !== 1 || !language(input.language) || !obj(input.prefs) || !prefs(input.prefs.en) || !prefs(input.prefs.ja) || !Array.isArray(input.customBooks) || input.customBooks.length > 50 || !obj(input.progress) || !Array.isArray(input.history) || input.history.length > 5000 || !obj(input.sessions)) fail();
  if(input.onboardingComplete!==undefined&&typeof input.onboardingComplete!=='boolean')fail();
  const entryIds = new Set(builtinEntries.map(item => item.id)); const bookIds = new Set(builtinBooks.map(item => item.id));
  for (const book of input.customBooks) {
    if (!obj(book) || !str(book.id, 100) || !/^custom-[\w-]+$/.test(book.id) || bookIds.has(book.id) || !str(book.name, 60) || !book.name.trim() || !language(book.language) || !['word','phrase'].includes(book.kind) || (book.archived!==undefined&&typeof book.archived!=='boolean') || !Array.isArray(book.entries) || !book.entries.length || book.entries.length > 2000 || !book.entries.filter(entry=>!entry.archived).length || book.entries.filter(entry=>!entry.archived).length>500) fail();
    bookIds.add(book.id);
    for (const entry of book.entries) {
      if (!obj(entry) || !str(entry.id, 150) || !entry.id.startsWith(`${book.id}-`) || entryIds.has(entry.id) || entry.book !== book.id || entry.language !== book.language || (!entry.archived&&entry.kind !== book.kind) || !['word','phrase'].includes(entry.kind) || (entry.archived!==undefined&&typeof entry.archived!=='boolean') || !str(entry.text) || !entry.text.trim() || !str(entry.meaning) || !entry.meaning.trim() || (entry.language === 'ja' && (!str(entry.reading) || !validKanaReading(entry.reading)))) fail();
      if (entry.accepted !== undefined || entry.readingAccepted !== undefined) {
        for (const variants of [entry.accepted, entry.readingAccepted]) if (variants !== undefined && (!Array.isArray(variants) || variants.length > 20 || !variants.every(item => str(item) && item.trim()))) fail();
      }
      entryIds.add(entry.id);
    }
  }
  const entryMap=new Map([...builtinEntries,...input.customBooks.flatMap(book=>book.entries)].map(entry=>[entry.id,entry]));
  const validResult = value => obj(value) && str(value.id, 180) && str(value.sessionId, 100) && entryMap.has(value.entryId) && value.language===entryMap.get(value.entryId).language && value.kind===entryMap.get(value.entryId).kind && mode(value.mode) && form(value.form) && (value.mode==='shadow'?value.correct===null:typeof value.correct==='boolean') && typeof value.assisted === 'boolean' && str(value.answer) && integer(value.at) && str(value.text) && str(value.meaning) && str(value.reading) && typeof value.skipped === 'boolean';
  if (!input.history.every(validResult)) fail();
  if (Object.keys(input.progress).length > 30000) fail();
  for (const [key, item] of Object.entries(input.progress)) {
    if (!obj(item) || !entryIds.has(item.entryId) || item.language!==entryMap.get(item.entryId).language || !mode(item.mode) || item.mode === 'shadow' || !form(item.form) || key !== answerKey({ id:item.entryId, language:item.language }, item.mode, item.form) || !['attempts','independent','assisted','incorrect','lastAt','nextReview'].every(field => integer(item[field])) || !integer(item.stage) || item.stage > 4 || typeof item.mistake !== 'boolean' || !str(item.lastAnswer) || item.independent+item.assisted+item.incorrect !== item.attempts) fail();
  }
  const entries = [...builtinEntries, ...input.customBooks.flatMap(book => book.entries)];
  for (const lang of ['en','ja']) {
    if (input.prefs[lang].book !== 'all' && !allBooks(input).some(book => book.id === input.prefs[lang].book && book.language === lang)) fail();
    const session = input.sessions[lang];
    if (session === null) continue;
    if (!obj(session) || !str(session.id, 100) || !prefs(session.settings) || session.settings.language !== lang || !Array.isArray(session.ids) || !session.ids.length || session.ids.length > 100 || new Set(session.ids).size !== session.ids.length || !session.ids.every(id => entries.some(entry => entry.id === id && entry.language === lang)) || !integer(session.index) || session.index > session.ids.length || !Array.isArray(session.results) || !session.results.every(validResult) || !str(session.draft) || !integer(session.hints) || session.hints > 300 || !integer(session.startedAt) || (session.currentResult !== null && !validResult(session.currentResult))) fail();
    if (session.results.length !== session.index + (session.currentResult ? 1 : 0) || (session.currentResult && (session.currentResult.entryId !== session.ids[session.index] || session.currentResult.id !== session.results.at(-1)?.id))) fail();
    if(!session.results.every((result,index)=>result.sessionId===session.id&&result.id===`${session.id}-${index}`&&result.entryId===session.ids[index]&&result.mode===session.settings.mode&&result.language===lang))fail();
    if(session.batchDrafts!==undefined&&(!obj(session.batchDrafts)||Object.entries(session.batchDrafts).some(([id,value])=>!session.ids.includes(id)||!str(value))))fail();
    if(isBatch(session)&&session.index>0&&session.index<session.ids.length)fail();
  }
  const restored=structuredClone(input);
  restored.listening=validateListening(input.listening);
  restored.onboardingComplete??=false;
  for(const lang of ['en','ja']){restored.prefs[lang]={...defaults(lang),...restored.prefs[lang]};if(restored.sessions[lang]){restored.sessions[lang].settings={...defaults(lang),...restored.sessions[lang].settings};restored.sessions[lang].batchDrafts??={};}}
  return restored;
}
