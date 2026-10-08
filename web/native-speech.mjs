import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('./speech.ps1', import.meta.url)).replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
function run(mode, input) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') return mode === 'voices' ? resolve(Buffer.from('[]')) : reject(new Error('Native speech unavailable'));
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Mode', mode], { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    const chunks = []; let size = 0;
    const timer = setTimeout(() => { child.kill(); reject(new Error('Speech timed out')); }, 15000);
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 12*1024*1024) {child.kill();reject(new Error('Speech output too large'));} else chunks.push(chunk); });
    child.stderr.resume();
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code===0 ? resolve(Buffer.concat(chunks)) : reject(new Error('Speech unavailable')); });
    child.stdin.on('error', () => {});
    child.stdin.end(input ? JSON.stringify(input) : undefined);
  });
}
let voicesPromise;
export function nativeVoices(refresh = false) {
  if(refresh)voicesPromise=undefined;
  voicesPromise ??= run('voices').then(buffer => JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/,''))).catch(() => []);
  return voicesPromise;
}
const cache = new Map();
export async function nativeSpeak(input) {
  if (!input || !['en','ja'].includes(input.language) || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 300 || !Number.isFinite(input.rate) || input.rate < .5 || input.rate > 1.5 || typeof input.voice !== 'string') throw new Error('Invalid speech request');
  const voices = await nativeVoices();
  if (!voices.some(voice => voice.lang.toLowerCase().startsWith(input.language) && voice.name === input.voice)) throw new Error('Voice unavailable');
  const key = JSON.stringify(input);
  if (cache.has(key)) return cache.get(key);
  const result = await run('speak', input);
  if (result.subarray(0,4).toString() !== 'RIFF') throw new Error('Invalid audio');
  cache.set(key,result);
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  return result;
}
