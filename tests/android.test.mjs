import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeHost } from '../web/dist/host.js';
import { loadLearningState } from '../web/dist/storage.js';
import { SpeechPlayer } from '../web/dist/audio.js';
import { freshState } from '../web/dist/core.js';

// Mirrors MainActivity.Bridge: synchronous JSON answers, with results announced later as "tingdu:native" events.
function fakeAndroid({ ready = true, voices = [{ name: 'en-us-x-local', lang: 'en-US', localService: true }, { name: 'ja-jp-x-local', lang: 'ja-JP', localService: true }], file = null } = {}) {
  const calls = { speak: [], stop: 0, saved: [] };
  const android = {
    calls,
    loadState: () => JSON.stringify(file === null ? { exists: false, raw: null } : { exists: true, raw: file }),
    saveState: raw => { calls.saved.push(raw); return JSON.stringify(raw.startsWith('{') ? { saved: true } : { error: '学习数据过大或格式不正确' }); },
    info: () => JSON.stringify({ version: '2.1.0', dataDirectory: '/data/user/0/local.tingdu.learner/files', platform: 'android' }),
    voices: () => JSON.stringify({ ready, voices: ready ? voices : [] }),
    speak: request => { calls.speak.push(JSON.parse(request)); return JSON.stringify({ ok: true }); },
    stopSpeech: () => { calls.stop++; }
  };
  return android;
}
function browserScope(android) {
  const scope = new EventTarget();
  Object.assign(scope, { TingduAndroid: android });
  globalThis.window = scope; globalThis.document = { querySelectorAll: () => [] }; globalThis.location = { hostname: 'appassets.androidplatform.net' };
  return scope;
}
const emit = (scope, detail) => scope.dispatchEvent(new CustomEvent('tingdu:native', { detail }));

test('The Android host reads and writes the learning file through JSON replies and surfaces bridge errors', async () => {
  const android = fakeAndroid({ file: JSON.stringify(freshState()) }), host = nativeHost({ TingduAndroid: android });
  assert.equal(host.kind, 'android');
  assert.deepEqual(await host.loadState(), { exists: true, raw: JSON.stringify(freshState()) });
  assert.deepEqual(await host.saveState('{"version":1}'), { saved: true });
  await assert.rejects(host.saveState('broken'), /格式不正确/);
  assert.equal((await host.info()).dataDirectory, '/data/user/0/local.tingdu.learner/files');
  assert.equal(nativeHost({}), null);
  assert.equal(nativeHost({ tingduDesktop: { loadState: async () => ({ exists: false }) } }).kind, 'desktop');
});

test('Learning state loads from the Android file, and an interrupted save falls back to the newer cache', async () => {
  const saved = freshState(); saved.prefs.ja.goal = 30;
  const cached = freshState(); cached.prefs.ja.goal = 50;
  const cache = pending => ({ getItem: key => key === 'tingdu:v1' ? JSON.stringify(cached) : key === 'tingdu:desktop-pending' && pending ? 'id' : null });
  const host = nativeHost({ TingduAndroid: fakeAndroid({ file: JSON.stringify(saved) }) });
  assert.equal((await loadLearningState(cache(false), host)).state.prefs.ja.goal, 30);
  assert.equal((await loadLearningState(cache(true), host)).state.prefs.ja.goal, 50);
  assert.equal((await loadLearningState(cache(false), host)).desktopInfo.version, '2.1.0');
});

test('Android speech reads Japanese words by their kana and finishes only on its own utterance event', async () => {
  const android = fakeAndroid(), scope = browserScope(android), player = new SpeechPlayer(() => {});
  await player.nativeReady;
  assert.deepEqual(player.forLanguage('ja').map(voice => voice.provider), ['android']);
  const finished = player.speak({ id: 'ja-w-1', language: 'ja', kind: 'word', text: '学校', reading: 'がっこう' }, { rate: 1, repeat: 1, voice: '' });
  const request = android.calls.speak[0];
  assert.deepEqual([request.language, request.voice, request.text, request.rate], ['ja', 'ja-jp-x-local', 'がっこう', 1]);
  emit(scope, { type: 'speech', id: 'someone-else', ok: true });
  emit(scope, { type: 'speech', id: request.id, ok: true });
  assert.equal(await finished, true);
});

test('Stopping Android speech settles playback, silences the engine and ignores the late completion event', async () => {
  const android = fakeAndroid(), scope = browserScope(android), messages = [], player = new SpeechPlayer(message => messages.push(message));
  await player.nativeReady;
  const finished = player.speak({ id: 'en-w-1', language: 'en', kind: 'word', text: 'apple' }, { rate: .85, repeat: 2 });
  const stopsBefore = android.calls.stop;
  player.stop();
  assert.equal(await finished, false);
  assert.ok(android.calls.stop > stopsBefore);
  emit(scope, { type: 'speech', id: android.calls.speak[0].id, ok: false });
  assert.equal(android.calls.speak.length, 1);
  assert.deepEqual(messages, []);
});

test('While the Android engine starts, voices stay pending and appear when the engine announces them', async () => {
  const android = fakeAndroid({ ready: false }), scope = browserScope(android), player = new SpeechPlayer(() => {});
  await player.nativeReady;
  assert.equal(player.loadingNative, true);
  assert.equal(player.forLanguage('en').length, 0);
  android.voices = () => JSON.stringify({ ready: true, voices: [{ name: 'en-us-x-local', lang: 'en-US', localService: true }] });
  emit(scope, { type: 'voices', ready: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(player.loadingNative, false);
  assert.equal(player.forLanguage('en')[0].voiceURI, 'android:en-us-x-local');
});
