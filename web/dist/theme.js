// Runs before the stylesheet paints: applies the saved appearance (so night never flashes light) and prepares the opening animation.
(function () {
  var root = document.documentElement;
  try {
    var theme = localStorage.getItem('tingdu:theme');
    // 定时夜间: night from 19:00 to 07:00, matching nightHours() in app.js.
    if (theme === 'auto') { var hour = new Date().getHours(); theme = hour >= 19 || hour < 7 ? 'dark' : 'light'; }
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    var style = localStorage.getItem('tingdu:style');
    if (style === 'warm' || style === 'fresh' || style === 'sakura') root.dataset.style = style;
  } catch (error) {}
  // "night" marks whichever dark palette is showing, so the sky and glow details can follow it.
  var dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && !!window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('night', dark);
  // Fast startup is the default. The full opening remains available in appearance settings.
  try {
    if (localStorage.getItem('tingdu:opening') !== 'full' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) root.classList.add('splash-seen');
    else if (sessionStorage.getItem('tingdu:splash')) root.classList.add('splash-seen');
    else sessionStorage.setItem('tingdu:splash', '1');
  } catch (error) { root.classList.add('splash-seen'); }
  // A tap, click or key press skips the animation.
  function skip() {
    if (!document.getElementById('splash')) { document.removeEventListener('pointerdown', skip, true); document.removeEventListener('keydown', skip, true); return; }
    if (!root.classList.contains('splash-seen')) root.classList.add('splash-skip');
  }
  document.addEventListener('pointerdown', skip, true);
  document.addEventListener('keydown', skip, true);
})();
