import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('../web/dist/theme.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../web/dist/style.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../web/dist/index.html', import.meta.url), 'utf8');

// Runs theme.js the way the page does, before first paint, with a chosen clock, storage and system preferences.
function boot({ theme = null, style = null, opening = null, hour = 12, systemDark = false, reducedMotion = false, launched = false, storageUnavailable = false } = {}) {
  const classes = new Set(), listeners = {};
  const root = { dataset: {}, classList: { add: name => classes.add(name), contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } };
  const store = values => ({ getItem: key => values[key] ?? null, setItem: (key, value) => { values[key] = String(value); } });
  const session = { ...(launched ? { 'tingdu:splash': '1' } : {}) };
  class FixedDate extends Date { getHours() { return hour; } }
  const context = {
    Date: FixedDate,
    localStorage: storageUnavailable ? { getItem() { throw new Error('Storage disabled'); } } : store({ 'tingdu:theme': theme, 'tingdu:style': style, 'tingdu:opening': opening }),
    sessionStorage: store(session),
    matchMedia: query => ({ matches: query.includes('dark') ? systemDark : query.includes('reduced-motion') ? reducedMotion : false }),
    document: { documentElement: root, getElementById: () => ({}), addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener() {} }
  };
  context.window = context;
  vm.runInNewContext(script, context);
  return { theme: root.dataset.theme, style: root.dataset.style, classes, session, listeners };
}

test('定时夜间 picks the night palette from 19:00 to 07:00 before the page paints', () => {
  for (const [hour, expected] of [[6, 'dark'], [7, 'light'], [12, 'light'], [18, 'light'], [19, 'dark'], [23, 'dark'], [0, 'dark']]) {
    const page = boot({ theme: 'auto', hour });
    assert.equal(page.theme, expected, `hour ${hour}`);
    assert.equal(page.classes.has('night'), expected === 'dark', `night class at hour ${hour}`);
  }
});

test('The night class follows an explicit choice, or the system when following it', () => {
  assert.equal(boot({ theme: 'dark' }).classes.has('night'), true);
  assert.equal(boot({ theme: 'light', systemDark: true }).classes.has('night'), false);
  assert.equal(boot({ systemDark: true }).classes.has('night'), true);
  assert.equal(boot({ systemDark: false }).classes.has('night'), false);
  assert.equal(boot({ theme: 'dark', style: 'sakura' }).style, 'sakura');
  assert.equal(boot({ theme: 'bogus' }).theme, undefined);
});

test('Fast startup is the default; an optional full opening respects repeat launches, reduced motion and skipping', () => {
  assert.equal(boot().classes.has('splash-seen'), true);
  assert.equal(boot({ storageUnavailable: true }).classes.has('splash-seen'), true);
  const first = boot({ opening: 'full' });
  assert.equal(first.classes.has('splash-seen'), false);
  assert.equal(first.session['tingdu:splash'], '1');
  assert.equal(boot({ opening: 'full', launched: true }).classes.has('splash-seen'), true);
  assert.equal(boot({ opening: 'full', reducedMotion: true }).classes.has('splash-seen'), true);
  first.listeners.pointerdown();
  assert.equal(first.classes.has('splash-skip'), true);
});

test('The splash markup ships with a CSS fail-safe so it can never cover the app for good', () => {
  assert.match(html, /id="splash"/);
  assert.match(css, /\.splash \{[^}]*animation: splash-failsafe/);
  assert.match(css, /@keyframes splash-failsafe \{ to \{ opacity: 0; visibility: hidden; \} \}/);
  assert.match(css, /\.splash-seen \.splash \{ display: none; \}/);
});
