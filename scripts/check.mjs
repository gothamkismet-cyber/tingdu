import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listeningLessons } from '../web/dist/listening-data.js';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const directory of ['web/dist', 'web', 'desktop', 'scripts', 'tests']) {
  let names; try { names = await readdir(path.join(root, directory)); } catch { continue; }
  for (const name of names.filter(name => /\.(js|mjs|cjs)$/.test(name))) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, directory, name)], { encoding:'utf8' });
    if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
  }
}
const html = await readFile(path.join(root, 'web/dist/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) await access(path.join(root, 'web/dist', match[1]));
const { builtinEntries, builtinBooks } = await import('../web/dist/data.js');
if (new Set(builtinEntries.map(entry => entry.id)).size !== 140) throw new Error('Expected 140 unique builtin entries');
for (const [language,kind,count] of [['en','word',80],['en','phrase',30],['ja','word',20],['ja','phrase',10]]) {
  const entries=builtinEntries.filter(entry=>entry.language===language&&entry.kind===kind);
  if(entries.length!==count||new Set(entries.map(entry=>entry.text.toLowerCase())).size!==count)throw new Error('Builtin content count or uniqueness mismatch');
}
for(const entry of builtinEntries){
  if(!entry.text?.trim()||!entry.meaning?.trim()||!builtinBooks.some(book=>book.id===entry.book&&book.language===entry.language&&book.kind===entry.kind))throw new Error('Incomplete builtin entry');
}
console.log('Syntax, local assets and all 140 bilingual entries passed.');
const questionIds = new Set();
if (listeningLessons.length !== 12 || new Set(listeningLessons.map(item => item.id)).size !== 12) throw new Error('Expected 12 unique listening lessons');
for (const lesson of listeningLessons) {
  if (!['en','ja'].includes(lesson.language) || !['dialogue','passage'].includes(lesson.kind) || !lesson.title || !lesson.segments.length || lesson.questions.length !== 3) throw new Error('Incomplete listening lesson');
  for (const segment of lesson.segments) if (!segment.text.trim() || segment.text.length > 300 || !segment.translation.trim()) throw new Error('Listening segment exceeds the speech contract');
  for (const question of lesson.questions) {
    if (questionIds.has(question.id) || question.options.length !== 4 || new Set(question.options).size !== 4 || !Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3 || !question.prompt.trim() || !question.explanation.trim()) throw new Error('Invalid listening question');
    questionIds.add(question.id);
  }
}
for (const language of ['en','ja']) if (listeningLessons.filter(item => item.language === language).length !== 6) throw new Error('Expected 6 listening lessons per language');
console.log('All 12 listening lessons and 36 questions passed.');
