import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
