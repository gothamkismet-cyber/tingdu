import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { nativeVoices, nativeSpeak } from './native-speech.mjs';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
function openBrowser() {
  if (process.platform === 'win32') spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `Start-Process '${origin}'`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
const server = http.createServer(async (req, res) => {
  if (!['127.0.0.1:4173', 'localhost:4173'].includes(req.headers.host)) {res.writeHead(403);return res.end();}
  const requestUrl = new URL(req.url, origin);
  if (requestUrl.pathname.startsWith('/api/')) {
    if (req.headers.origin && ![origin,'http://localhost:4173'].includes(req.headers.origin)) {res.writeHead(403);return res.end();}
    try {
      if (requestUrl.pathname === '/api/voices' && req.method === 'GET') {
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify(await nativeVoices(requestUrl.searchParams.get('refresh')==='1')));
      }
      if (requestUrl.pathname === '/api/speech' && req.method === 'POST') {
        const parts=[];let bytes=0;
        for await (const part of req) {bytes+=part.length;if(bytes>4096)throw new Error('Request too large');parts.push(part);}
        const audio = await nativeSpeak(JSON.parse(Buffer.concat(parts).toString('utf8')));
        res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(audio);
      }
      res.writeHead(404);return res.end();
    } catch {res.writeHead(422,{'Content-Type':'application/json'});return res.end('{"error":"Speech unavailable"}');}
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  try {
    const pathname = decodeURIComponent(requestUrl.pathname);
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root) || !mime[path.extname(target)]) { res.writeHead(404); return res.end('Not found'); }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(`${origin}/index.html`);
      if (response.ok && (await response.text()).includes('tingdu-app')) {
        console.log(`Tingdu is already running: ${origin}`);
        if (process.argv.includes('--open')) openBrowser();
        return;
      }
    } catch {}
  }
  console.error(`Cannot start Tingdu: ${error.message}`); process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Tingdu ready: ${origin}`);
  if (process.argv.includes('--open')) openBrowser();
});
