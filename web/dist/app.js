import { builtinEntries, languages, modes, englishAccents } from './data.js';
import { STORAGE_KEY, freshState, allEntries, allBooks, expectedAnswer, normalizeAnswer, diffAnswer, createSession, nextQuestion, recordAnswer, summarize, dayKey, validateState, makeChoices, reviewGroups, parseWordList, isBatch, submitBatch, editCustomBook, archiveCustomBook, dropStaleSessions, validDailyGoal, setEnglishAccent, saveLearningPlan, dailyWordIds } from './core.js';
import { SpeechPlayer, VoiceRecorder } from './audio.js';
import { registerLearningTools } from './webmcp.js';
import { loadLearningState } from './storage.js';
import { nativeHost } from './host.js';

const root = document.querySelector('#tingdu-app'), dialog = document.querySelector('#dialog');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const e = escape;
const paths = {
 wave:'<path d="M4 9v6m5-10v14m5-9v4m5-9v14"/>',
 headphones:'<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
 volume:'<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 pen:'<path d="m15 4 5 5M4 20l4-1L20 7a3.5 3.5 0 0 0-5-5L3 14l-1 5 2 1Z"/>',
 book:'<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15Z"/>',
 mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
 repeat:'<path d="M3 8h15l-3-3m3 3-3 3M21 16H6l3 3m-3-3 3-3"/>',
 chart:'<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',
 settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="8" cy="18" r="2" fill="currentColor"/>',
 check:'<path d="m5 12 4 4L19 6"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',play:'<path d="m8 4 12 8-12 8V4Z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 stop:'<rect x="6" y="6" width="12" height="12" rx="2.5"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
 flame:'<path d="M12 3c.8 3.4 5 5.6 5 10.2A5 5 0 0 1 7 13.2c0-2.3 1-3.8 2.3-5 .3 1.7 1.2 2.7 2.3 2.9-.4-3 .3-5.8.4-8.1Z"/>',
 sparkle:'<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z"/><path d="M19 16c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z"/>',
 bulb:'<path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z"/>',
 eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
 archive:'<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9m-9 4h4"/>',
 download:'<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>',upload:'<path d="M12 16V5m-4 4 4-4 4 4M5 20h14"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2m0 14.6v2.2M4.6 4.6l1.6 1.6m11.6 11.6 1.6 1.6M2.5 12h2.2m14.6 0h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
 moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/><path d="M17 3.5v3m-1.5-1.5h3" stroke-width="1.5"/>',
 monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8m-4-4v4"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',palette:'<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1.1-1.6-1.1-2.7 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5C21 6.2 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15.5" cy="7.5" r="1.2" fill="currentColor"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
// The four sound bars of the app icon, drawn as elements so they can rise in the opening animation and dance during playback.
const logoBars = '<span class="logo-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
let state = freshState(), storageProblem = '', corruptRaw = null, view = 'train', showSetup = false, toastTimer, saveTimer, composing = false, lastCompositionEnd = 0, libraryBook = 'all', reviewFilter = 'due', recordFilter = 'all', renderedView = null;
const host=nativeHost();
let desktopInfo=null,desktopSave=Promise.resolve(),desktopClosing=false,desktopReadProblem=false;
const loaded=await loadLearningState(()=>localStorage,host);
({state,storageProblem,corruptRaw,desktopInfo,desktopReadProblem}=loaded);
dropStaleSessions(state);
function notify(message) {
  const toast = document.querySelector('#toast'); toast.textContent = message; toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
}
function persist() {
  clearTimeout(saveTimer);
  if (corruptRaw !== null) return false;
  try {
    const raw=JSON.stringify(state);localStorage.setItem(STORAGE_KEY,raw);if(!desktopReadProblem)storageProblem='';
    if(host&&!desktopReadProblem){
      const pending=crypto.randomUUID();localStorage.setItem('tingdu:desktop-pending',pending);
      desktopSave=host.saveState(raw).then(()=>{if(localStorage.getItem('tingdu:desktop-pending')===pending)localStorage.removeItem('tingdu:desktop-pending');}).catch(()=>{storageProblem='本机学习文件没有写入成功，已保留应用缓存；请导出备份后再退出。';updateStorageNotice();});
    }
    return true;
  }
  catch { storageProblem = '记录没有保存成功，请导出备份。浏览器可能禁止存储或空间已满。'; updateStorageNotice(); return false; }
}
function updateStorageNotice() {
  const notice = document.querySelector('#storage-notice');
  if (notice) { notice.hidden = !storageProblem; notice.innerHTML = `${e(storageProblem)} <button class="text-button" data-action="settings">备份与恢复</button>`; }
}
const speech = new SpeechPlayer(notify, () => updateVoiceNotice());
const recorder = new VoiceRecorder(notify, () => { if (view === 'train' && activeSession()?.settings.mode === 'shadow') render(); });
const pref = () => state.prefs[state.language];
const activeSession = () => state.sessions[state.language];
const entryById = id => allEntries(state).find(entry => entry.id === id);
const currentEntry = () => { const s = activeSession(); return s && entryById(s.ids[s.index]); };
const formatTime = at => new Intl.DateTimeFormat('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(at);
const kindName = entry => entry.kind === 'phrase' ? '短句' : '单词';
const formName = (mode, form, language = state.language) => language === 'ja' && ['dictation','recall'].includes(mode) ? (form === 'reading' ? '假名读音' : '标准写法') : '';
const percent = (value, max) => max ? Math.min(100, Math.round(value / max * 100)) : 0;
const typedMode = mode => ['dictation','recall'].includes(mode);
const nextLabel = s => s.index+1===s.ids.length?'查看本组结果':'下一题';
const touchOnly = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
const storageLabel = () => host ? `${host.name} · 数据保存在本机` : '进度保存在当前浏览器';
const greeting = (hour = new Date().getHours()) => hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
const voiceLabel = () => state.language==='en'?englishAccents[pref().accent].name:languages[state.language].name;
const availableVoices = () => speech.forLanguage(state.language,pref().accent);
function accentControls() {
  if(state.language!=='en')return '';
  return `<fieldset class="accent-control"><legend>英语发音</legend><div class="accent-options">${Object.entries(englishAccents).map(([locale,accent])=>`<button type="button" data-action="accent" data-accent="${locale}" aria-pressed="${pref().accent===locale}"><span class="accent-code">${locale==='en-US'?'US':'UK'}</span><span>${accent.name}</span>${icon('check')}</button>`).join('')}</div></fieldset>`;
}
function learningBar() {
  return `<div class="learning-bar">${accentControls()}<button class="plan-link" data-action="learning-plan">${icon('target')}每日 ${pref().goal} 个单词<span>调整计划</span>${icon('arrow')}</button></div>${!state.onboardingComplete?'<div class="notice">先选一个适合自己的学习目标。<button class="text-button" data-action="learning-plan">设置每日单词数</button></div>':''}`;
}
function pronunciationText(entry) {
  return entry.pronunciation?`美式音标 ${entry.pronunciation}`:'';
}
function ring(value, label = '') {
  return `<span class="ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="ring-track" cx="20" cy="20" r="16"/>${value?`<circle class="ring-value" cx="20" cy="20" r="16" pathLength="100" stroke-dasharray="${value} 100"/>`:''}</svg>${label?`<span class="ring-label">${label}</span>`:''}</span>`;
}
function weekChart(big = false) {
  const days = Array.from({length:7}, (_, index) => { const d = new Date(); d.setDate(d.getDate()-6+index); const key = dayKey(d); return { key, label: ['日','一','二','三','四','五','六'][d.getDay()], count: state.history.filter(item => item.language === state.language && dayKey(item.at) === key).length }; });
  const max = Math.max(5, ...days.map(day => day.count));
  return `<div class="week-bars ${big?'big':''}" role="img" aria-label="近七天练习次数：${days.map(day=>`周${day.label} ${day.count} 次`).join('，')}">${days.map((day, i) => `<div class="week-day ${i===6?'today':''}" title="${e(day.key)}：${day.count} 次"><span class="week-count">${day.count||''}</span><span class="week-bar"><i style="height:${Math.max(4,day.count/max*100)}%"></i></span><span>${i===6?'今':day.label}</span></div>`).join('')}</div>`;
}
function sidePanels() {
  const stats = summarize(state, state.language), goal = percent(stats.todayWords, stats.goal), ja = state.language==='ja';
  return `<aside class="stack aside-stack"><section class="panel goal-card"><div class="metric-top"><span>今日目标</span>${icon('target')}</div><div class="goal-body">${ring(goal,`${goal}%`)}<div><div class="metric-big">${stats.todayWords}<span>/ ${stats.goal} 个词</span></div><p class="goal-note">${stats.todayWords>=stats.goal?'今天的目标完成了':`还差 ${stats.goal-stats.todayWords} 个单词`}</p></div></div><div class="stats-pair"><div><strong>${stats.accuracy===null?'—':stats.accuracy+'%'}</strong><small>独立答对率</small></div><div><strong>${stats.wrong}</strong><small>待复习错词</small></div><div><strong>${stats.streak}</strong><small>连续天数</small></div></div><button class="button secondary daily-start" data-action="daily-plan">${icon('play')}练今日单词</button><p class="goal-help">从全部单词词本安排；今天练过的词不会重复加入。</p></section><section class="panel week-card"><div class="panel-title compact"><h3>这一周</h3><span class="muted small">每一次练习都算数</span></div>${weekChart()}</section><section class="panel tip-panel"><span class="tip-icon">${icon('sparkle')}</span><h3>${ja?'假名，也要仔细听':'把声音和拼写连起来'}</h3><p>${ja?'留意长音、促音和小假名。先听一遍，写完后再对照读音。':'先听完整发音，再尝试作答。遇到难词，可以慢放并在下一轮独立写一次。'}</p></section></aside>`;
}
function shell(content, subtitle) {
  const stats = summarize(state, state.language), goal = percent(stats.todayWords, stats.goal);
  const views = { train:['开始练习','headphones'], library:['我的词本','book'], review:['错词复习','repeat'], records:['学习记录','chart'] };
  const mark = `<div class="brand-mark">${logoBars}</div>`, night = isNight();
  return `<div class="shell"><aside class="sidebar"><div class="brand">${mark}<div><div class="brand-name">听读</div><small>LISTEN &amp; LEARN</small></div></div><nav class="nav" aria-label="主要导航">${Object.entries(views).map(([key,[name,symbol]]) => `<button data-action="nav" data-view="${key}" class="${view===key?'active':''}" ${view===key?'aria-current="page"':''}>${icon(symbol)}<span>${name}</span>${key==='review'&&stats.wrong?`<span class="nav-count" aria-label="${stats.wrong} 个待复习">${stats.wrong}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note"><div class="sidebar-goal">${ring(goal)}<div><strong>今日学习目标</strong><small>已练 ${stats.todayWords} / ${stats.goal} 个词</small></div></div>${stats.streak?`<div class="streak">${icon('flame')}连续练习 ${stats.streak} 天</div>`:''}</div><button class="sidebar-settings" data-action="settings">${icon('settings')}声音与备份</button><small class="storage-label">${storageLabel()}</small></div></aside><div class="workspace"><header class="topbar"><div class="topbar-brand">${mark}<span>听读</span></div><span class="topbar-meta"><strong>${greeting()}</strong> · ${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())}</span><div class="topbar-actions"><button class="icon-button theme-toggle" data-action="toggle-night" aria-pressed="${night}" aria-label="夜间模式" title="${night?'切换到白天模式':'切换到夜间模式'}"><span class="theme-icon sun">${icon('sun')}</span><span class="theme-icon moon">${icon('moon')}</span></button><div class="lang-switch" role="group" aria-label="学习语言">${Object.entries(languages).map(([key,lang]) => `<button data-action="language" data-language="${key}" class="${state.language===key?'active':''}" aria-pressed="${state.language===key}">${lang.name}</button>`).join('')}</div><button class="icon-button mobile-settings" data-action="settings" aria-label="声音与备份">${icon('settings')}</button></div></header><main class="content" id="content" tabindex="-1"><div class="page-heading"><div><h1>${views[view][0]}</h1><p>${e(subtitle)}</p></div><span class="tag">${languages[state.language].native} · ${allEntries(state).filter(item=>item.language===state.language).length} 条内容</span></div>${learningBar()}<div class="notice" id="storage-notice" ${storageProblem?'':'hidden'}>${e(storageProblem)} <button class="text-button" data-action="settings">备份与恢复</button></div>${content}</main></div></div>`;
}
const selectControl = (id, key, options, current) => `<div class="select"><select id="${id}" ${key?`data-pref="${key}"`:''}>${options.map(([value,text])=>`<option value="${e(value)}" ${String(value)===String(current)?'selected':''}>${e(text)}</option>`).join('')}</select></div>`;
const rateControl = (id, rate) => `<div class="range-row"><input id="${id}" type="range" min="0.5" max="1.5" step="0.05" value="${rate}" data-pref="rate" style="--fill:${Math.round((rate-.5)*100)}%"><output id="${id}-output" for="${id}">${rate.toFixed(2)}×</output></div>`;
function setupView() {
  const p = pref(), s = activeSession(), books = allBooks(state).filter(book=>book.language===state.language), count = allEntries(state).filter(item=>item.language===state.language&&(p.book==='all'||item.book===p.book)).length;
  const resume = !s ? '' : s.index<s.ids.length ? `<div class="resume-banner">${icon('clock')}<div><strong>还有一组练习没有完成</strong><small>${modes[s.settings.mode].name} · ${isBatch(s)?`整组 ${s.ids.length} 题`:`第 ${s.index+1} / ${s.ids.length} 题`}</small></div><button class="button small" data-action="resume">继续练习${icon('arrow')}</button></div>` : `<div class="resume-banner done">${icon('check')}<div><strong>上一组已经练完</strong><small>${modes[s.settings.mode].name} · ${s.ids.length} 题</small></div><button class="button outline small" data-action="resume">查看结果</button></div>`;
  const fields = [
    `<div class="field"><label for="book">练习词本</label>${selectControl('book','book',[['all','全部内容 · 单词与短句'],...books.map(book=>[book.id,book.name])],p.book)}<small id="book-count">本词本 ${count} 条内容</small></div>`,
    `<div class="field"><label for="limit">每组题数</label>${selectControl('limit','limit',[5,10,20,30,50,100].map(n=>[n,`${n} 题`]),p.limit)}<small>内容不足时使用实际条数</small></div>`,
    state.language==='ja'&&typedMode(p.mode)?`<div class="field full"><label for="form">日语答案要求</label>${selectControl('form','form',[['reading','练读音 · 用假名回答'],['written','练标准写法 · 按词条原文回答']],p.form)}<small>长音、促音和小假名都参与判题</small></div>`:'',
    p.mode==='dictation'?`<div class="field full"><label for="dictation-style">听写方式</label>${selectControl('dictation-style','dictationStyle',[['step','逐题练习 · 每题即时反馈'],['batch','整组听写 · 结束后统一判分']],p.dictationStyle)}</div>`:'',
    p.mode!=='recall'?`<div class="field"><label for="repeat-count">每题朗读次数</label>${selectControl('repeat-count','repeat',[1,2,3].map(n=>[n,`${n} 遍`]),p.repeat)}</div>`:'',
    p.mode==='dictation'&&p.dictationStyle==='batch'?`<div class="field"><label for="question-pause">整组题间停顿</label>${selectControl('question-pause','pause',[2,4,6,8].map(n=>[n,`${n} 秒`]),p.pause)}</div>`:'',
    `<div class="field full"><label for="rate">朗读速度</label>${rateControl('rate',p.rate)}</div>`
  ];
  return `<div class="main-grid"><section class="panel setup-panel">${resume}<div class="panel-title"><div><h2>准备一组练习</h2><p class="muted small">选一种训练方式，再挑词本和题数。</p></div><span class="tag blue">${languages[state.language].name}</span></div><p class="panel-label">训练方式</p><div class="mode-grid">${Object.entries(modes).map(([key,mode])=>`<button class="mode-card ${key===p.mode?'selected':''}" data-action="mode" data-mode="${key}" data-tone="${mode.tone}" aria-pressed="${key===p.mode}"><span class="mode-icon">${icon(mode.icon)}</span><span class="mode-text"><strong>${mode.name}</strong><small>${mode.subtitle}</small></span><span class="mode-check">${icon('check')}</span></button>`).join('')}</div><form id="setup-form"><div class="form-grid">${fields.join('')}</div><div class="form-footer"><label class="switch"><input type="checkbox" role="switch" data-pref="shuffle" ${p.shuffle?'checked':''}><span class="switch-track" aria-hidden="true"></span><span>打乱顺序</span></label><button class="button big" type="submit">${icon('play')}开始练习</button></div></form><div class="voice-notice" data-voice-notice></div></section>${sidePanels()}</div>`;
}
function readingText(entry, kana = true) {
  return `<div class="word-display ${entry.kind==='phrase'?'phrase':''}" lang="${entry.language}">${e(entry.text)}</div>${entry.language==='ja'&&kana?`<p class="reading-line" lang="ja">${e(entry.reading)}</p>`:entry.pronunciation?`<p class="reading-line">${e(pronunciationText(entry))}</p>`:''}`;
}
function playback(entry, reveal = false) {
  const mode = activeSession()?.settings.mode, title = mode==='meaning' ? '听声音，选择意思' : '听一听，写下来';
  return `<div class="audio-stage">${reveal?readingText(entry,activeSession()?.settings.kana):`<h2>${title}</h2><p>${kindName(entry)} · ${languages[entry.language].name}</p>`}<button class="play-circle" data-action="speak" data-id="${e(entry.id)}" aria-label="播放${languages[entry.language].name}示范发音"><span class="play-waves" aria-hidden="true"></span>${icon('volume')}</button><div class="audio-actions"><button data-action="speak" data-id="${e(entry.id)}">${icon('repeat')}重新听</button><button data-action="speak" data-id="${e(entry.id)}" data-slow="true">${icon('clock')}慢速听</button></div></div>`;
}
function diffMarkup(answer, expected, language, form) {
  return diffAnswer(normalizeAnswer(answer,language,form),normalizeAnswer(expected,language,form)).map(part=>part.type==='equal'?e(part.expected):`${part.actual?`<span class="removed">${e(part.actual)}</span>`:''}${part.expected?`<span class="added">${e(part.expected)}</span>`:''}`).join('');
}
function feedback(entry, session) {
  const r = session.currentResult;
  if (!r) return '';
  const wrong = r.correct === false;
  const diff = wrong&&typedMode(r.mode)&&!r.skipped ? diffMarkup(r.answer,expectedAnswer(entry,r.form),entry.language,r.form) : '';
  const title = r.correct===null?'本次跟读已记录':wrong?r.skipped?'已查看答案，下次再试':'这里需要再练一次':r.assisted?'提示后答对了':'独立答对了';
  return `<div class="feedback ${r.correct===null?'neutral':wrong?'wrong':''}" role="status"><div class="feedback-head"><span class="feedback-badge">${icon(wrong?'close':'check')}</span><h3>${title}</h3></div><p class="correct-text" lang="${entry.language}">${e(entry.text)}</p>${entry.reading?`<p lang="ja">读音：${e(entry.reading)}</p>`:''}<p>${e(entry.meaning)}</p>${diff?`<div class="diff" aria-label="答案差异">${diff}<p class="legend"><i class="swatch removed"></i>多写或写错 <i class="swatch added"></i>应补上的字符</p></div>`:''}</div>`;
}
function typedPractice(entry, s) {
  const typedLabel = state.language==='ja' ? s.settings.form==='reading'?'请用假名作答':'请按词条原文写法作答' : s.settings.mode==='recall'?'写出对应的英文'+kindName(entry):'输入你听到的英文'+kindName(entry);
  const prompt = s.settings.mode==='recall'?`<div class="meaning-prompt"><span class="eyebrow">根据中文写出${languages[state.language].name}</span><div class="meaning-text">${e(entry.meaning)}</div><span class="tag">${kindName(entry)}</span></div>`:playback(entry);
  const expected = Array.from(normalizeAnswer(expectedAnswer(entry,s.settings.form),entry.language,s.settings.form));
  const r = s.currentResult;
  return `${prompt}<form class="answer-form" id="answer-form"><label class="field-label" for="answer">${typedLabel}</label><input class="answer-field ${r?r.correct?'is-correct':'is-wrong':''}" id="answer" name="answer" type="text" lang="${entry.language}" value="${e(s.draft)}" placeholder="在这里写下答案…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" maxlength="300" ${r?'disabled':''} aria-describedby="answer-help"><p class="answer-help" id="answer-help">${state.language==='ja'?'先确认输入法候选字，再按回车提交。':'忽略大小写和句末标点，保留单词与缩写的差别。'}</p>${s.hints&&!r?`<div class="hint">${icon('bulb')}<span>${e(expected.slice(0,s.hints).join(''))}${'＿'.repeat(Math.max(0,expected.length-s.hints))}</span><small>已使用提示</small></div>`:''}${feedback(entry,s)}<div class="answer-buttons"><div class="left">${!r?`<button type="button" class="text-button" data-action="hint">${icon('bulb')}给个提示</button><button type="button" class="text-button" data-action="skip">${icon('eye')}查看答案</button>`:''}</div>${r?`<button class="button" type="button" data-action="next">${nextLabel(s)}${icon('arrow')}</button>`:`<button class="button" type="submit">${icon('check')}检查答案</button>`}</div></form>`;
}
function resultItem(r) {
  const typed = typedMode(r.mode), expected = r.language==='ja'&&r.form==='reading'?r.reading:r.text;
  const detail = r.correct!==false ? '' : !r.answer ? `<p class="result-answer">${typed?'未填写':'未选择'} · 答案：<span lang="${r.language}">${e(expected)}</span></p>` : `<p class="result-answer">${typed?'你写的':'你选的'}：${e(r.answer)}</p>${typed?`<div class="diff">${diffMarkup(r.answer,expected,r.language,r.form)}</div>`:''}`;
  return `<div class="result-item"><div><strong lang="${r.language}">${e(r.text)}</strong><small>${e(r.meaning)}</small>${detail}</div><span class="tag ${r.correct===false?'orange':r.correct?'green':''}">${r.correct===null?'已跟读':r.correct?r.assisted?'提示后正确':'独立正确':'待复习'}</span></div>`;
}
function completionView(s) {
  const independent = s.results.filter(r=>r.correct&&!r.assisted).length, assisted = s.results.filter(r=>r.correct&&r.assisted).length, wrong = s.results.filter(r=>r.correct===false).length, graded = s.settings.mode!=='shadow';
  const score = graded ? percent(independent, s.results.length) : 100;
  // A strong group earns a short burst of confetti; positions are spread deterministically so re-renders look the same.
  const confetti = graded&&score>=80 ? `<div class="confetti" aria-hidden="true">${Array.from({length:26},(_,i)=>`<i style="--x:${(i*37+11)%100}%;--delay:${(i%9)*.05}s;--drift:${(i*53)%140-70}px;--spin:${(i*97)%360}deg"></i>`).join('')}</div>` : '';
  return `<div class="completion">${confetti}<div class="completion-score ${graded&&score<60?'low':''}">${ring(score,graded?`${score}%`:icon('check'))}</div><h2>这一组，练完了</h2><p>${languages[state.language].name} · ${modes[s.settings.mode].name} · ${s.ids.length} 题${graded?' · 独立答对率':''}</p><div class="summary-grid">${graded?`<div class="good"><strong>${independent}</strong><small>独立答对</small></div><div class="assist"><strong>${assisted}</strong><small>提示后答对</small></div><div class="bad"><strong>${wrong}</strong><small>需要再练</small></div>`:`<div><strong>${s.results.length}</strong><small>跟读练习</small></div><div><strong>—</strong><small>不自动评分</small></div><div><strong>${s.ids.length}</strong><small>本组内容</small></div>`}</div><div class="completion-actions">${wrong?`<button class="button" data-action="retry">${icon('repeat')}再练本组错题</button>`:''}<button class="button ${wrong?'outline':''}" data-action="new">${icon('play')}准备下一组</button></div><div class="result-list">${s.results.map(resultItem).join('')}</div></div>`;
}
function choicePractice(entry,s) {
  const choices=makeChoices(entry,allEntries(state),`${s.id}-${s.index}`), result=s.currentResult;
  const prompt = s.settings.mode==='reading'?`<div class="meaning-prompt"><span class="eyebrow">读一读，选择对应的中文意思</span>${readingText(entry,s.settings.kana)}<div class="prompt-actions"><button class="chip-button" data-action="speak" data-id="${e(entry.id)}">${icon('volume')}听示范</button>${entry.language==='ja'?`<button class="chip-button" data-action="toggle-kana">${icon('eye')}${s.settings.kana?'隐藏':'显示'}假名读音</button>`:''}</div></div>`:playback(entry);
  return `${prompt}<div class="choices" role="group" aria-label="选择中文意思">${choices.map((choice,index)=>{const mark=result&&choice===entry.meaning?'correct':result&&choice===result.answer&&!result.correct?'incorrect':'';return `<button class="choice ${mark}" data-action="choice" data-value="${e(choice)}" ${result?'disabled':''}><span class="choice-letter">${String.fromCharCode(65+index)}</span><span class="choice-text">${e(choice)}</span>${mark?`<span class="choice-mark">${icon(mark==='correct'?'check':'close')}</span>`:''}</button>`;}).join('')}</div>${feedback(entry,s)}<div class="answer-buttons"><span class="muted small">${result?'再读一次，让声音和意思连起来。':touchOnly()?'请选择一个答案':'请选择一个答案 · 也可以按 1–4'}</span>${result?`<button class="button" data-action="next">${nextLabel(s)}${icon('arrow')}</button>`:''}</div>`;
}
function shadowPractice(entry,s) {
  const status=recorder.status;
  return `${playback(entry,true)}<p class="shadow-meaning">${e(entry.meaning)}</p>${entry.language==='ja'?`<div class="center"><button class="chip-button" data-action="toggle-kana">${icon('eye')}${s.settings.kana?'隐藏':'显示'}假名读音</button></div>`:''}<div class="recorder-panel ${status}"><span class="recorder-icon">${icon('mic')}</span><h3>${status==='ready'?'听听自己的朗读':status==='recording'?'正在录音…':'轮到你读一遍'}</h3><p>录音只用于本题对照，切换题目后释放；每次最多 60 秒。</p>${status==='recording'?'<button class="button danger" data-action="record-stop"><span class="record-dot"></span>停止录音</button>':`<button class="button outline" data-action="record" ${['requesting','processing'].includes(status)?'disabled':''}>${icon('mic')}${status==='requesting'?'等待麦克风权限…':status==='processing'?'正在保存录音…':status==='ready'?'重新录一次':'开始录音'}</button>`}${recorder.url?`<audio controls src="${e(recorder.url)}" aria-label="回放我的朗读"></audio>`:''}<p>可以对照节奏和发音自行检查；本模式不自动评分。</p></div>${feedback(entry,s)}<div class="answer-buttons"><span class="muted small">${s.currentResult?'跟读练习已保存':'不用录音也可以听示范跟读'}</span>${s.currentResult?`<button class="button" data-action="next">${nextLabel(s)}${icon('arrow')}</button>`:`<button class="button" data-action="shadow-done">${icon('check')}记录这次跟读</button>`}</div>`;
}
function practiceView() {
  const s = activeSession();
  if (!s || showSetup) return setupView();
  if (s.index>=s.ids.length) return `<div class="main-grid"><section class="panel">${completionView(s)}</section>${sidePanels()}</div>`;
  if(isBatch(s))return batchPractice(s);
  const entry = currentEntry(), mode = modes[s.settings.mode], form = formName(s.settings.mode,s.settings.form);
  if(!entry)return setupView();
  const activity=['meaning','reading'].includes(s.settings.mode)?choicePractice(entry,s):s.settings.mode==='shadow'?shadowPractice(entry,s):typedPractice(entry,s);
  const keys = s.settings.mode==='recall' ? '<kbd>Enter</kbd> 提交 / 下一题' : `${typedMode(s.settings.mode)?'<kbd>Enter</kbd> 提交 / 下一题 · ':''}<kbd>Alt</kbd> + <kbd>P</kbd> 重听`;
  return `<div class="main-grid"><section class="panel practice-panel" data-tone="${mode.tone}"><div class="practice-head"><div class="practice-mode"><span class="mode-icon">${icon(mode.icon)}</span><div><strong>${mode.name}</strong><small>${kindName(entry)}${form?' · '+form:''}</small></div></div><button class="button ghost small" data-action="new">${icon('settings')}练习设置</button></div><div class="progress-row"><progress class="progress-track" value="${s.index+(s.currentResult?1:0)}" max="${s.ids.length}" aria-label="本组完成进度"></progress><span class="progress-count">${s.index+1}<small> / ${s.ids.length}</small></span></div>${activity}<div class="voice-notice" data-voice-notice></div><p class="practice-footer">${keys}</p></section>${sidePanels()}</div>`;
}
function libraryView() {
  const books=allBooks(state).filter(book=>book.language===state.language), entries=allEntries(state).filter(item=>item.language===state.language&&(libraryBook==='all'||item.book===libraryBook));
  const archived=state.customBooks.filter(book=>book.language===state.language&&book.archived), glyph=state.language==='ja'?'あ':'Aa';
  const cards=books.map(book=>{const custom=book.id.startsWith('custom-'),count=allEntries(state).filter(item=>item.book===book.id).length;return `<section class="book-card ${libraryBook===book.id?'selected':''}" data-tone="${custom?'violet':book.kind==='phrase'?'teal':'blue'}"><div class="book-top"><span class="book-cover" lang="${state.language}">${glyph}</span><span class="tag">${book.kind==='phrase'?'短句':'单词'} · ${count} 条</span></div><h2>${e(book.name)}</h2><p>${e(book.description||'自己整理的学习内容')}</p><div class="book-actions"><button class="button small" data-action="practice-book" data-book="${e(book.id)}">${icon('play')}练这本</button><button class="button outline small" data-action="choose-book" data-book="${e(book.id)}">查看词条</button>${custom?`<span class="book-tools"><button class="icon-button" data-action="edit-book" data-book="${e(book.id)}" aria-label="编辑词本 ${e(book.name)}" title="编辑词本">${icon('edit')}</button><button class="icon-button" data-action="archive-book" data-book="${e(book.id)}" aria-label="归档词本 ${e(book.name)}" title="归档词本">${icon('archive')}</button></span>`:''}</div></section>`;}).join('');
  const archivedList=archived.length?`<details class="archived-books"><summary>${icon('archive')}已归档词本 · ${archived.length} 本</summary><p class="muted small">过去的学习记录仍保留。恢复后可以继续练习。</p>${archived.map(book=>`<div class="review-entry"><strong>${e(book.name)}</strong><button class="button outline small" data-action="unarchive-book" data-book="${e(book.id)}">恢复词本</button></div>`).join('')}</details>`:'';
  return `<div class="list-header"><div><h2>我的${languages[state.language].name}词本</h2><p class="muted small">${books.length} 本可练习${archived.length?` · ${archived.length} 本已归档`:''}</p></div><button class="button" data-action="import">${icon('plus')}新建词本</button></div><div class="books-grid">${cards}</div>${archivedList}<section class="panel"><div class="list-header"><div><h2>${libraryBook==='all'?'全部词条':e(books.find(book=>book.id===libraryBook)?.name||'词条')}</h2>${libraryBook!=='all'?'<button class="text-button" data-action="choose-book" data-book="all">查看全部</button>':`<p class="muted small">${entries.length} 条内容</p>`}</div><label class="search">${icon('search')}<input id="word-search" type="search" aria-label="搜索原文、读音或释义" placeholder="搜索原文、读音或释义" autocomplete="off"></label></div><table class="word-table"><thead><tr><th>原文 / 读音</th><th>中文释义</th><th><span class="sr-only">听音</span></th></tr></thead><tbody>${entries.map(entry=>`<tr data-search="${e([entry.text,entry.reading,entry.meaning].join(' ').toLowerCase())}"><td><strong lang="${entry.language}">${e(entry.text)}</strong>${entry.reading?`<small lang="ja">${e(entry.reading)}</small>`:entry.pronunciation?`<small>${e(pronunciationText(entry))}</small>`:''}</td><td>${e(entry.meaning)}</td><td><button class="icon-button" data-action="speak" data-id="${e(entry.id)}" aria-label="朗读 ${e(entry.text)}">${icon('volume')}</button></td></tr>`).join('')}</tbody></table><p id="search-empty" class="footer-note" hidden>没有找到匹配内容，试试原文或中文释义。</p></section>`;
}
function reviewView() {
  const groups=reviewGroups(state,state.language,Date.now(),reviewFilter==='mistakes');
  const filter=`<div class="segmented" role="group" aria-label="复习范围">${[['due','错题与到期复习'],['mistakes','只看错题']].map(([key,name])=>`<button data-action="review-filter" data-value="${key}" class="${reviewFilter===key?'active':''}" aria-pressed="${reviewFilter===key}">${name}</button>`).join('')}</div>`;
  if(!groups.length)return `${filter}<section class="panel"><div class="empty">${icon('check')}<h2>${reviewFilter==='mistakes'?'暂时没有待复习错词':'今天没有待复习内容'}</h2><p>独立答对的题目会按 1、3、7、14 天安排复习。答错或使用提示的内容会更早出现。</p><button class="button" data-action="nav" data-view="train">${icon('play')}开始一组练习</button></div></section>`;
  return `${filter}${groups.map(group=>{const mode=modes[group.mode],form=formName(group.mode,group.form);return `<section class="panel review-card" data-tone="${mode.tone}"><div class="panel-title"><div class="practice-mode"><span class="mode-icon">${icon(mode.icon)}</span><div><h2>${mode.name}${form?' · '+form:''}</h2><small>${group.items.length} 条 · 按原题要求复习</small></div></div><button class="button small" data-action="review-group" data-group="${e(group.key)}">${icon('play')}复习这组</button></div>${group.items.map(item=>{const entry=entryById(item.entryId);return `<div class="review-entry"><div><strong lang="${entry.language}">${e(entry.text)}</strong>${entry.reading?`<p lang="ja">${e(entry.reading)}</p>`:''}<p>${e(entry.meaning)}</p><span class="review-meta ${item.mistake?'':'due'}">${item.mistake?'需要巩固':'已到复习时间'} · ${item.incorrect} 次未答对${item.lastAnswer?` · 上次：${e(item.lastAnswer)}`:''}</span></div><button class="button outline small" data-action="review-one" data-group="${e(group.key)}" data-id="${e(entry.id)}">原题再练</button></div>`;}).join('')}</section>`;}).join('')}`;
}
function recordsView() {
  const stats=summarize(state,state.language), goal=percent(stats.todayWords,stats.goal), history=state.history.filter(item=>item.language===state.language&&(recordFilter==='all'||item.mode===recordFilter)).slice(-30).reverse();
  const tile=(tone,symbol,label,value,note)=>`<section class="panel record-stat" data-tone="${tone}"><span class="stat-icon">${icon(symbol)}</span><span class="eyebrow">${label}</span><strong>${value}</strong><small>${note}</small></section>`;
  return `<section class="goal-hero">${ring(goal,`${goal}%`)}<div class="goal-hero-text"><span class="eyebrow">今日目标 ${stats.goal} 个单词</span><h2>${stats.todayWords>=stats.goal?'今天的目标完成了':`还差 ${Math.max(0,stats.goal-stats.todayWords)} 个单词`}</h2><p>${icon('flame')}连续练习 ${stats.streak} 天 · 英日分别统计</p></div><button class="button outline small" data-action="learning-plan">调整目标</button></section><div class="record-stats">${tile('blue','clock','今日练习',stats.today,'次作答 / 跟读')}${tile('teal','target','独立答对率',stats.accuracy===null?'—':stats.accuracy+'%',`${stats.independent} / ${stats.graded} 次计分作答`)}${tile('amber','bulb','提示后正确',stats.assisted,'练习时使用了提示')}${tile('violet','book','练过的内容',stats.practiced,`条${languages[state.language].name}内容`)}</div><section class="panel record-chart"><div class="panel-title"><h2>近七天的练习</h2><span class="tag">${languages[state.language].name}</span></div>${weekChart(true)}</section><section class="panel"><div class="panel-title"><h2>最近记录</h2><button class="button outline small" data-action="export">${icon('download')}导出备份</button></div><div class="history-filters">${selectControl('record-filter','',[['all','全部训练方式'],...Object.entries(modes).map(([key,mode])=>[key,mode.name])],recordFilter)}</div>${history.length?history.map(item=>`<div class="history-row"><span class="history-dot ${item.correct===false?'bad':item.correct?'good':''}"></span><div class="history-main"><strong lang="${item.language}">${e(item.text)}</strong><small>${e(item.meaning)}</small><small>${modes[item.mode].name}${formName(item.mode,item.form,item.language)?' · '+formName(item.mode,item.form,item.language):''}${item.correct===false&&item.answer?' · 你的答案：'+e(item.answer):''}</small></div><div class="history-right"><span class="tag ${item.correct===false?'orange':item.correct?'green':''}">${item.correct===null?'已跟读':item.correct?item.assisted?'提示后正确':'独立正确':item.skipped?'查看了答案':'待复习'}</span><small>${formatTime(item.at)}</small></div></div>`).join(''):`<div class="empty">${icon('chart')}<h2>还没有这类练习记录</h2><p>完成一次作答后，这里会显示真实练习结果。</p></div>`}<p class="footer-note">列表展示最近 30 条；统计来自本机保留的最近 5000 条记录，跟读不计入答对率。</p></section>`;
}
function render() {
  const subtitles = {train:'把听到的声音，变成记得住的词。',library:'从内置内容开始，也可以加入自己的学习材料。',review:'用原来的题目要求，再给自己一次机会。',records:'看看练过什么，以及哪些内容还需要巩固。'};
  root.innerHTML = shell(view==='train'?practiceView():view==='library'?libraryView():view==='review'?reviewView():recordsView(),subtitles[view]);
  if(renderedView!==view)root.querySelector('.content').classList.add('view-enter');
  renderedView=view;
  updateVoiceNotice();
  speech.syncPlaying();
}
function batchPractice(s){
  const entries=s.ids.map(entryById), filled=entries.filter(entry=>s.batchDrafts?.[entry.id]?.trim()).length;
  return `<div class="main-grid"><section class="panel practice-panel" data-tone="blue"><div class="practice-head"><div class="practice-mode"><span class="mode-icon">${icon('headphones')}</span><div><strong>整组听写</strong><small>${entries.length} 题 · ${state.language==='ja'?(s.settings.form==='reading'?'用假名回答':'按标准写法回答'):'用英语回答'}</small></div></div><button class="button ghost small" data-action="new">${icon('settings')}练习设置</button></div><div class="batch-toolbar"><button class="button" data-action="batch-play">${icon('play')}播放整组</button><button class="button outline" data-action="audio-stop">${icon('stop')}停止播放</button><span class="batch-meta">每题 ${s.settings.repeat} 遍 · 题间 ${s.settings.pause} 秒</span></div><p id="batch-status" class="batch-status" role="status" aria-live="polite">点击整组播放，或单独听某一题；提交前不显示答案。</p><form id="batch-form"><div class="batch-list">${entries.map((entry,index)=>`<div class="batch-row ${s.batchDrafts?.[entry.id]?.trim()?'filled':''}" data-batch-row="${e(entry.id)}"><label class="batch-label" for="batch-${index}"><span class="batch-number">${index+1}</span><small>${kindName(entry)}</small></label><input class="answer-field" id="batch-${index}" data-batch-answer="${e(entry.id)}" value="${e(s.batchDrafts?.[entry.id]||'')}" aria-label="第 ${index+1} 题答案" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="${index+1===entries.length?'done':'next'}" maxlength="300" lang="${state.language}"><button type="button" class="icon-button" data-action="speak" data-id="${e(entry.id)}" aria-label="重听第 ${index+1} 题">${icon('volume')}</button></div>`).join('')}</div><div class="form-footer"><span class="muted small" id="batch-filled">已填写 ${filled} / ${entries.length} · 草稿自动保存</span><button class="button" type="submit">${icon('check')}提交整组答案</button></div></form><div class="voice-notice" data-voice-notice></div></section>${sidePanels()}</div>`;
}
function goalControls(){
  return `<div class="field"><label for="daily-goal">${languages[state.language].name}每日单词数</label><input id="daily-goal" type="number" min="1" max="100" step="1" inputmode="numeric" data-pref="goal" value="${pref().goal}" aria-describedby="daily-goal-help"><small id="daily-goal-help">1–100 个；同一天同一个词只计一次，短句不占单词目标。</small></div>`;
}
function learningPlanDialog() {
  const first=!state.onboardingComplete;
  const goalField=lang=>`<fieldset class="plan-goal"><legend>${languages[lang].name} · 每日单词数</legend><div class="goal-presets">${[5,10,20,30].map(n=>`<button type="button" data-action="goal-preset" data-language="${lang}" data-goal="${n}" aria-pressed="${state.prefs[lang].goal===n}">${n}<small>个 / 天</small></button>`).join('')}</div><div class="goal-custom"><label for="plan-goal-${lang}">自定义</label><input id="plan-goal-${lang}" name="${lang}Goal" type="number" inputmode="numeric" min="1" max="100" step="1" required value="${state.prefs[lang].goal}" aria-describedby="plan-goal-help"><span>个 / 天</span></div><small>当前有 ${allEntries(state).filter(entry=>entry.language===lang&&entry.kind==='word').length} 条单词，可在「我的词本」继续添加。</small></fieldset>`;
  openDialog(`${dialogHeading(first?'先定一个小目标':'调整每日学习计划')}<p class="dialog-description">${first?'每天想练多少个单词？先从 10 个开始，也可以按自己的节奏选。':'学习计划可以随时调整，已有练习和错题记录继续保留。'}</p><form id="learning-plan-form" class="dialog-body"><div class="plan-goals">${goalField('en')}<details class="other-language-plan" ${state.language==='ja'?'open':''}><summary>也设置日语单词目标</summary>${goalField('ja')}</details></div><p id="plan-goal-help" class="plan-help">可选 1–100 个。完成作答或跟读就计入；重复练同一个词只计一次，查看答案和短句练习不占单词目标。</p><fieldset class="plan-accent"><legend>英语示范发音</legend><div class="plan-accent-options">${Object.entries(englishAccents).map(([locale,accent])=>`<label><input type="radio" name="accent" value="${locale}" ${state.prefs.en.accent===locale?'checked':''} required><span><strong>${accent.name}</strong><small>${accent.native}</small></span></label>`).join('')}</div><p class="plan-help">同一词本可切换口音；朗读需要设备提供对应音色。</p></fieldset><div id="plan-error" class="dialog-error" role="alert" hidden></div><div class="dialog-actions"><button type="button" class="button outline" data-action="close-dialog">${first?'稍后设置':'取消'}</button><button type="submit" class="button">${icon('check')}${first?'保存并开始':'保存学习计划'}</button></div></form>`);
}
const themes = { system:['跟随系统','monitor','和设备一致'], light:['白天','sun','明亮清爽'], dark:['夜间','moon','星空深色'], auto:['定时夜间','clock','19:00–7:00'] };
const styles = { classic:'经典蓝紫', warm:'温馨暖阳', fresh:'清新薄荷', sakura:'樱花粉黛' };
function currentTheme() { try { const value = localStorage.getItem('tingdu:theme'); return themes[value] ? value : 'system'; } catch { return 'system'; } }
// 定时夜间 uses the night palette from 19:00 to 07:00 local time; theme.js applies the same rule before first paint.
const nightHours = (date = new Date()) => date.getHours() >= 19 || date.getHours() < 7;
const isNight = () => getComputedStyle(document.documentElement).colorScheme === 'dark';
function currentStyle() { try { const value = localStorage.getItem('tingdu:style'); return styles[value] ? value : 'classic'; } catch { return 'classic'; } }
let fadeTimer = 0;
// A brief class on <html> lets every colour glide to the new palette instead of snapping.
function fadeTheme() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('theme-fade');
  clearTimeout(fadeTimer); fadeTimer = setTimeout(() => document.documentElement.classList.remove('theme-fade'), 520);
}
function applyTheme(value) {
  fadeTheme();
  const resolved = value === 'auto' ? (nightHours() ? 'dark' : 'light') : value;
  if (resolved === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = resolved;
  try { if (value === 'system') localStorage.removeItem('tingdu:theme'); else localStorage.setItem('tingdu:theme', value); } catch {}
  syncSystemBars();
}
function refreshTimedTheme() { if (currentTheme() === 'auto' && (document.documentElement.dataset.theme === 'dark') !== nightHours()) applyTheme('auto'); }
function applyStyle(value) {
  if (!styles[value]) value = 'classic';
  fadeTheme();
  if (value === 'classic') delete document.documentElement.dataset.style; else document.documentElement.dataset.style = value;
  try { if (value === 'classic') localStorage.removeItem('tingdu:style'); else localStorage.setItem('tingdu:style', value); } catch {}
  syncSystemBars();
}
// The day/night toggle and the Android status and navigation bars follow whichever palette is showing.
function syncSystemBars() {
  const night = isNight();
  document.documentElement.classList.toggle('night', night);
  document.querySelectorAll('.theme-toggle').forEach(button => { button.setAttribute('aria-pressed', String(night)); button.title = night ? '切换到白天模式' : '切换到夜间模式'; });
  if (!host?.setSystemBars) return;
  const style = getComputedStyle(document.documentElement);
  host.setSystemBars(style.getPropertyValue('--bar').trim(), style.getPropertyValue('--nav-bar').trim(), style.colorScheme === 'dark');
}
function editBookDialog(id){
  const book=state.customBooks.find(item=>item.id===id);if(!book||book.archived)return;
  const source=book.entries.filter(entry=>!entry.archived).map(entry=>[entry.text,...(book.language==='ja'?[entry.reading]:[]),entry.meaning].join(' | ')).join('\n');
  openDialog(`${dialogHeading('编辑词本')}<p class="dialog-description">修改内容会重置对应词条的复习进度，并结束包含它的进行中练习；已完成记录保留。移除的词条会归档。</p><form id="edit-book-form" data-book="${e(id)}" class="dialog-body"><div class="form-grid"><div class="field"><label for="edit-book-name">词本名称</label><input id="edit-book-name" name="bookName" required maxlength="60" value="${e(book.name)}"></div><div class="field"><label for="edit-book-kind">内容类型</label><div class="select"><select id="edit-book-kind" name="kind"><option value="word" ${book.kind==='word'?'selected':''}>单词</option><option value="phrase" ${book.kind==='phrase'?'selected':''}>短句</option></select></div></div><div class="field full"><label for="edit-book-source">${book.language==='ja'?'原文 | 假名读音 | 中文释义':'原文 | 中文释义'}</label><textarea id="edit-book-source" name="source" required spellcheck="false">${e(source)}</textarea></div></div><div id="edit-book-error" class="dialog-error" role="alert" hidden></div><div class="dialog-actions"><button class="button outline" type="button" data-action="close-dialog">取消</button><button class="button" type="submit">${icon('check')}保存修改</button></div></form>`);
}
function finishBatch(){speech.stop();try{submitBatch(state,activeSession());persist();render();window.scrollTo({top:0});}catch(error){notify(error.message);}}
function requestBatchSubmit(){
  if(composing||Date.now()-lastCompositionEnd<60)return;
  const s=activeSession();if(!isBatch(s))return;
  const blank=s.ids.filter(id=>!s.batchDrafts?.[id]?.trim()).length;
  if(blank)confirmDialog('还有未填写的题目',`${blank} 题尚未填写；提交后这些题会判为错误。`,finishBatch,'仍然交卷');else finishBatch();
}
const voiceOptions = () => `<option value="">自动选择${voiceLabel()}音色</option>${availableVoices().map(voice=>`<option value="${e(voice.voiceURI)}" ${voice.voiceURI===pref().voice?'selected':''}>${e(voice.name)} · ${e(voice.lang)}${voice.localService?' · 本机':' · 在线'}</option>`).join('')}`;
function updateVoiceNotice() {
  document.querySelectorAll('[data-voice-notice]').forEach(el=>{ const list = availableVoices(); el.classList.toggle('missing',!list.length&&!speech.loadingNative); el.textContent = list.length?`${voiceLabel()}音色已就绪 · 可在“声音与备份”里更换。`:speech.loadingNative?'正在检测本机音色…':`暂未发现${voiceLabel()}音色。${host?.kind==='android'?'可在“声音与备份”打开系统语音设置安装语音数据；':'可换有对应音色的浏览器，或安装设备语音后重新检测；'}现在可以先练看义默写和阅读。`; });
  const select=dialog.querySelector('#voice');
  if(select)select.innerHTML=voiceOptions();
  const label=dialog.querySelector('label[for="voice"]');if(label)label.textContent=voiceLabel()+'音色';
  const tester=dialog.querySelector('[data-action="test-voice"]');if(tester)tester.innerHTML=icon('play')+'试听'+voiceLabel();
  document.querySelectorAll('[data-action="accent"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.accent===state.prefs.en.accent)));
}
function start(settings = { ...pref(), language: state.language }, ids = null) {
  const begin = () => { try { speech.stop(); recorder.reset(); state.sessions[state.language] = createSession(settings,allEntries(state),Date.now(),ids); showSetup=false; view='train'; persist(); render(); window.scrollTo({top:0}); focusAnswer(); } catch(error) {notify(error.message);} };
  const current = activeSession();
  if (current&&current.index<current.ids.length) confirmDialog('重新开始一组？','当前这组的题目进度将被替换，已经完成的答题记录会保留。',begin,'开始新一组'); else begin();
}
// On phones the keyboard would cover the audio controls, so learners tap the answer box themselves.
function focusAnswer() { if(touchOnly())return; (document.querySelector('#answer')||document.querySelector('[data-batch-answer]'))?.focus({preventScroll:true}); }
function grade(answer, skip=false) { const s=activeSession(),entry=currentEntry(); if(!s||!entry||s.currentResult)return; recordAnswer(state,s,entry,answer,{skip}); speech.stop(); persist(); render(); document.querySelector('[data-action="next"]')?.focus({preventScroll:true}); }
function openDialog(content) { dialog.innerHTML=content; if(!dialog.open)dialog.showModal(); }
function dialogHeading(title) { return `<div class="dialog-heading"><h2 id="dialog-title" tabindex="-1" autofocus>${e(title)}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div>`; }
let confirmCallback;
function confirmDialog(title,message,callback,label='确认') { confirmCallback=callback; openDialog(`${dialogHeading(title)}<p class="dialog-description">${e(message)}</p><div class="dialog-actions"><button class="button outline" data-action="close-dialog">取消</button><button class="button" data-action="confirm">${e(label)}</button></div>`); }
function settingsDialog() {
  const p=pref(), lang=languages[state.language].name; let hasPrevious=false;try{hasPrevious=Boolean(localStorage.getItem('tingdu:previous'));}catch{}
  const where = host?.kind==='desktop' ? '保存位置：本机学习文件，同时保留桌面窗口缓存。第一版浏览器记录可通过备份导入；录音不写入备份。' : host?.kind==='android' ? '保存位置：手机应用内的学习文件，同时保留应用缓存。卸载应用会删除学习记录，请定期导出备份；录音不写入备份。' : '保存位置：当前浏览器。备份包含英日进度、自建词本和未完成的练习；录音只在本题内使用，不写入备份。';
  openDialog(`${dialogHeading('声音与备份')}<div class="dialog-body"><section class="settings-section first"><h3>${icon('volume')}声音</h3>${accentControls()}<div class="field"><label for="voice">${voiceLabel()}音色</label><div class="select"><select id="voice" data-pref="voice">${voiceOptions()}</select></div><small>音色由设备提供；在线音色可能需要网络。首次加载时音色列表可能需要稍等。</small></div><div class="inline-actions"><button class="button secondary small" data-action="test-voice">${icon('play')}试听${voiceLabel()}</button><button class="button ghost small" data-action="refresh-voices">${icon('repeat')}重新检测音色</button>${host?.openSpeechSettings?`<button class="button ghost small" data-action="speech-settings">${icon('settings')}系统语音设置</button>`:''}</div><div class="voice-notice" data-voice-notice></div><div class="field"><label for="settings-rate">朗读速度</label>${rateControl('settings-rate',p.rate)}</div></section><section class="settings-section"><h3>${icon('palette')}目标与外观</h3><div class="form-grid">${goalControls()}<div class="field full"><span class="field-label" id="theme-label">白天与夜间</span><div class="theme-options" role="group" aria-labelledby="theme-label">${Object.entries(themes).map(([key,[name,symbol,note]])=>`<button type="button" class="theme-option${key===currentTheme()?' selected':''}" data-action="theme" data-value="${key}" data-theme-preview="${key}" aria-pressed="${key===currentTheme()}"><span class="theme-preview">${icon(symbol)}</span><strong>${name}</strong><small>${note}</small></button>`).join('')}</div><small>夜间模式换上星空背景和柔和的光，适合晚上练习；也可以点顶部的月亮按钮随时切换。</small></div><div class="field full"><span class="field-label" id="style-label">界面风格</span><div class="style-swatches" role="group" aria-labelledby="style-label">${Object.entries(styles).map(([key,name])=>`<button type="button" class="style-swatch${key===currentStyle()?' selected':''}" data-action="style" data-value="${key}" aria-pressed="${key===currentStyle()}"><span class="swatch-dot ${key}"></span>${name}</button>`).join('')}</div><small>四种配色心情，浅色与深色模式都可以使用。</small></div></div></section><section class="settings-section"><h3>${icon('download')}学习记录与词本</h3><p>${where}</p><div class="backup-actions"><button class="button outline small" data-action="export">${icon('download')}导出学习备份</button><button class="button secondary small" data-action="restore-pick">${icon('upload')}从备份恢复</button>${hasPrevious?'<button class="text-button" data-action="undo-restore">撤销上次恢复</button>':''}${corruptRaw!==null?'<button class="text-button" data-action="export-raw">导出保留的原记录</button>':''}</div><input type="file" id="restore-file" accept=".json,application/json" hidden><p>恢复前会检查备份，并保留恢复前记录。更换浏览器或设备时，需要导入备份。</p><p>最近 5000 条作答用于记录与统计；每种题目的复习状态持续保留。</p>${desktopInfo?`<p class="data-path">${e(host.name)} ${e(desktopInfo.version)} · 数据目录：${e(desktopInfo.dataDirectory)}</p>`:''}</section><div id="settings-error" class="dialog-error" role="alert" hidden></div></div>`);
  updateVoiceNotice();
}
function importDialog() {
  if(state.customBooks.length>=50)return notify('已达到 50 个自建词本，请保留备份后再整理内容。');
  const ja=state.language==='ja';
  openDialog(`${dialogHeading('新建'+languages[state.language].name+'词本')}<p class="dialog-description">每行一条，可用竖线或制表符分隔。整本选择单词或短句。</p><form id="import-form" class="dialog-body"><div class="form-grid"><div class="field"><label for="book-name">词本名称</label><input id="book-name" name="bookName" required maxlength="60" placeholder="例如：这周要复习的内容"></div><div class="field"><label for="book-kind">内容类型</label><div class="select"><select id="book-kind" name="kind"><option value="word">单词</option><option value="phrase">短句</option></select></div></div><div class="field full"><label for="book-source">${ja?'原文 | 假名读音 | 中文释义':'原文 | 中文释义'}</label><textarea id="book-source" name="source" required spellcheck="false" placeholder="${ja?'学校 | がっこう | 学校\n切手 | きって | 邮票':'window | 窗户\npractice | 练习'}"></textarea><small>最多 500 行；每项最多 300 字。${ja?'日语读音必填，不自动猜测汉字读音。':''}</small></div></div><div id="import-error" class="dialog-error" role="alert" hidden></div><div class="dialog-actions"><button class="button outline" type="button" data-action="close-dialog">取消</button><button class="button" type="submit">${icon('plus')}创建词本</button></div></form>`);
}
function importBook(form) {
  const name=form.elements.bookName.value.trim();
  const showError=message=>{const el=document.querySelector('#import-error');el.textContent=message;el.hidden=false;};
  if(!name){showError('请填写词本名称。');form.elements.bookName.focus();return;}
  try {
    const id='custom-'+crypto.randomUUID(), kind=form.elements.kind.value;
    const entries=parseWordList(form.elements.source.value,state.language,kind,id);
    state.customBooks.push({id,name,language:state.language,kind,entries});
    libraryBook=id;view='library';persist();dialog.close();render();notify(`已加入 ${entries.length} 条${languages[state.language].name}内容。`);
  } catch(error) {showError(error.message);document.querySelector('#book-source').setAttribute('aria-describedby','import-error');}
}
function startReview(groupKey, id=null) {
  const group=reviewGroups(state,state.language).find(item=>item.key===groupKey);
  if(!group)return notify('这组内容已完成复习。');
  start({...pref(),language:state.language,book:'all',mode:group.mode,form:group.form,dictationStyle:'step',limit:100,shuffle:false},id?[id]:group.items.map(item=>item.entryId));
}
function applyBackup(candidate) {
  speech.stop();recorder.reset();clearTimeout(saveTimer);
  try {
    localStorage.setItem('tingdu:previous',corruptRaw!==null?corruptRaw:JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY,JSON.stringify(candidate));
    state=dropStaleSessions(candidate);corruptRaw=null;desktopReadProblem=false;storageProblem='';view='train';showSetup=false;libraryBook='all';persist();render();notify('备份已恢复，恢复前记录仍可在“声音与备份”里找回。');
  } catch { notify('没有恢复：浏览器无法写入记录。现有学习数据仍保留，请先导出备份。'); }
}
async function restoreFromFile(file) {
  if(!file)return;
  try {
    if(file.size>10*1024*1024)throw new Error('备份超过 10 MB，请选择由听读导出的学习备份。');
    const candidate=validateState(JSON.parse(await file.text()));
    confirmDialog('恢复这份学习备份？',`备份含 ${candidate.history.length} 条作答、${candidate.customBooks.length} 个自建词本，将替换当前进度。恢复前记录会保留，可撤销本次恢复。`,()=>applyBackup(candidate),'恢复备份');
  } catch(error) {
    const el=document.querySelector('#settings-error');if(el){el.textContent=error instanceof SyntaxError?'文件不是有效的 JSON 学习备份。':error.message;el.hidden=false;}else notify(error.message);
  }
}
// Android saves through a system picker and reports the outcome later; browsers download straight away.
function download(value,name,message,type='application/json') {
  if(host?.saveFile){try{host.saveFile(name,value);}catch{notify('没有打开保存位置，请重试。');}return;}
  const url=URL.createObjectURL(new Blob([value],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  if(message)notify(message);
}
function navigate(target){speech.stop();recorder.reset();persist();view=target;showSetup=false;render();window.scrollTo({top:0});}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(action==='nav')navigate(button.dataset.view);
  else if(action==='language'){speech.stop();recorder.reset();persist();state.language=button.dataset.language;showSetup=false;libraryBook='all';persist();render();}
  else if(action==='mode'){pref().mode=button.dataset.mode;persist();render();document.querySelector(`[data-action="mode"][data-mode="${pref().mode}"]`)?.focus({preventScroll:true});}
  else if(action==='speak'){const entry=entryById(button.dataset.id);if(entry){const s=activeSession();speech.speak(entry,s&&!showSetup&&view==='train'?s.settings:{...pref(),language:state.language},button.dataset.slow==='true');}}
  else if(action==='audio-stop'){speech.stop();const status=document.querySelector('#batch-status');if(status)status.textContent='播放已停止，可以继续填写或重新播放。';}
  else if(action==='batch-play'){
    const s=activeSession();if(!isBatch(s))return;
    speech.playSequence(s.ids.map(entryById),s.settings,({index,repeat,phase})=>{
      const status=document.querySelector('#batch-status');if(status)status.textContent=phase==='finished'?'整组播放结束，检查答案后提交。':phase==='stopped'?'播放已停止，可以继续填写或重新播放。':phase==='failed'?'声音未能播放，请检查音色后重试。':`第 ${index+1} 题 · ${phase==='pause'?'留时间作答':`正在朗读第 ${repeat+1} 遍`}`;
      document.querySelectorAll('[data-batch-row]').forEach((row,i)=>row.classList.toggle('active',i===index&&phase!=='finished'&&phase!=='failed'&&phase!=='stopped'));
    });
  }
  else if(action==='hint'){const s=activeSession(),entry=currentEntry();if(s&&entry&&!s.currentResult){s.hints=Math.min(s.hints+1,Array.from(normalizeAnswer(expectedAnswer(entry,s.settings.form),entry.language,s.settings.form)).length);persist();render();focusAnswer();}}
  else if(action==='skip')grade('',true);
  else if(action==='next'){speech.stop();recorder.reset();if(nextQuestion(activeSession())){persist();render();focusAnswer();}}
  else if(action==='new'){speech.stop();recorder.reset();showSetup=true;render();window.scrollTo({top:0});}
  else if(action==='resume'){showSetup=false;render();focusAnswer();}
  else if(action==='retry'){const s=activeSession();start({...s.settings},s.results.filter(r=>r.correct===false).map(r=>r.entryId));}
  else if(action==='choice')grade(button.dataset.value);
  else if(action==='toggle-kana'){const s=activeSession();s.settings.kana=!s.settings.kana;pref().kana=s.settings.kana;persist();render();}
  else if(action==='record'){speech.stop();recorder.start();}
  else if(action==='record-stop')recorder.stop();
  else if(action==='shadow-done'){if(recorder.status==='requesting')recorder.reset();else recorder.stop();grade('');}
  else if(action==='choose-book'){libraryBook=button.dataset.book;render();}
  else if(action==='practice-book'){pref().book=button.dataset.book;showSetup=true;view='train';persist();render();window.scrollTo({top:0});}
  else if(action==='import')importDialog();
  else if(action==='edit-book')editBookDialog(button.dataset.book);
  else if(action==='archive-book')confirmDialog('归档这个词本？','词本将暂时退出练习和复习列表，相关进行中练习会结束；过去的记录保留，可随时恢复词本。',()=>{archiveCustomBook(state,button.dataset.book);libraryBook='all';speech.stop();recorder.reset();persist();render();notify('词本已归档，记录仍保留。');},'归档词本');
  else if(action==='unarchive-book'){archiveCustomBook(state,button.dataset.book,false);persist();render();notify('词本已恢复。');}
  else if(action==='review-filter'){reviewFilter=button.dataset.value;render();}
  else if(action==='review-group')startReview(button.dataset.group);
  else if(action==='review-one')startReview(button.dataset.group,button.dataset.id);
  else if(action==='settings')settingsDialog();
  else if(action==='learning-plan')learningPlanDialog();
  else if(action==='goal-preset'){
    const input=dialog.querySelector(`#plan-goal-${button.dataset.language}`);input.value=button.dataset.goal;
    input.closest('.plan-goal').querySelectorAll('[data-goal]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.goal===input.value)));
  }
  else if(action==='accent'){
    if(state.prefs.en.accent===button.dataset.accent)return;
    speech.stop();setEnglishAccent(state,button.dataset.accent);persist();render();
    if(!dialog.open)root.querySelector(`[data-action="accent"][data-accent="${pref().accent}"]`)?.focus({preventScroll:true});
  }
  else if(action==='daily-plan'){
    const stats=summarize(state,state.language), ids=dailyWordIds(state,state.language);
    if(!ids.length)return notify(stats.todayWords>=stats.goal?'今天的单词目标完成了，可以自由练习或调整目标。':'今天可安排的单词已练完，可以在「我的词本」添加更多单词。');
    start({...pref(),language:state.language,book:'all',limit:100,shuffle:false},ids);
  }
  else if(action==='toggle-night'){const night=!isNight();applyTheme(night?'dark':'light');document.querySelectorAll('.theme-option').forEach(item=>{const on=item.dataset.value===currentTheme();item.classList.toggle('selected',on);item.setAttribute('aria-pressed',String(on));});notify(night?'已切换到夜间模式。':'已切换到白天模式。');}
  else if(action==='theme'){applyTheme(button.dataset.value);document.querySelectorAll('.theme-option').forEach(item=>{const on=item.dataset.value===button.dataset.value;item.classList.toggle('selected',on);item.setAttribute('aria-pressed',String(on));});}
  else if(action==='style'){applyStyle(button.dataset.value);document.querySelectorAll('.style-swatch').forEach(item=>{const on=item.dataset.value===button.dataset.value;item.classList.toggle('selected',on);item.setAttribute('aria-pressed',String(on));});notify(`界面风格已切换为${styles[button.dataset.value]}。`);}
  else if(action==='test-voice'){const entry=builtinEntries.find(item=>item.language===state.language&&item.kind==='phrase');speech.speak(entry,{...pref(),repeat:1});}
  else if(action==='refresh-voices'){button.disabled=true;speech.loadNative(true).finally(()=>{speech.refresh();button.disabled=false;notify(availableVoices().length?`${voiceLabel()}音色已就绪。`:speech.loadingNative?'正在重新检测音色，请稍候。':`仍未发现${voiceLabel()}音色，请添加设备语音后重试。`);});}
  else if(action==='speech-settings'){try{host.openSpeechSettings();}catch{notify('没有打开系统语音设置，请在手机设置里搜索“文字转语音”。');}}
  else if(action==='close-dialog'){dialog.close();confirmCallback=null;}
  else if(action==='confirm'){const callback=confirmCallback;confirmCallback=null;dialog.close();callback?.();}
  else if(action==='export'){persist();download(JSON.stringify(state,null,2),`听读备份-${dayKey()}.json`,'学习备份已导出。');}
  else if(action==='export-raw'&&corruptRaw!==null)download(corruptRaw,`听读原始记录-${dayKey()}.json`);
  else if(action==='restore-pick')document.querySelector('#restore-file').click();
  else if(action==='undo-restore'){
    try{const candidate=validateState(JSON.parse(localStorage.getItem('tingdu:previous')));confirmDialog('撤销上次恢复？','将回到上次恢复前的记录；当前记录也会保留为可恢复备份。',()=>applyBackup(candidate),'恢复此前记录');}catch{notify('此前记录无法直接恢复，请先导出当前备份并检查原记录。');}
  }
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='restore-file'){restoreFromFile(el.files[0]);el.value='';return;}
  if(el.id==='record-filter'){recordFilter=el.value;render();return;}
  if(!el.dataset.pref)return;
  if(el.dataset.pref==='goal'&&!validDailyGoal(Number(el.value))){el.value=pref().goal;notify('每日单词数请填写 1–100 之间的整数。');return;}
  const key=el.dataset.pref;pref()[key]=el.type==='checkbox'?el.checked:['limit','rate','repeat','pause','goal'].includes(key)?Number(el.value):el.value;
  // Playback choices also apply to the unfinished group, so resuming it uses what the learner just picked.
  if(['voice','rate','repeat','pause'].includes(key)&&activeSession())activeSession().settings[key]=pref()[key];
  persist();
  if(key==='goal')render();
  if(key==='dictationStyle'){render();document.querySelector('#dictation-style')?.focus({preventScroll:true});}
  if(key==='book'){const count=allEntries(state).filter(item=>item.language===state.language&&(el.value==='all'||item.book===el.value)).length;document.querySelector('#book-count').textContent=`本词本 ${count} 条内容`;}
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='plan-goal-en'||el.id==='plan-goal-ja')el.closest('.plan-goal').querySelectorAll('[data-goal]').forEach(item=>item.setAttribute('aria-pressed',String(Number(item.dataset.goal)===Number(el.value))));
  if(el.dataset.batchAnswer&&isBatch(activeSession())){
    const s=activeSession();s.batchDrafts[el.dataset.batchAnswer]=el.value;el.closest('.batch-row')?.classList.toggle('filled',Boolean(el.value.trim()));
    const counter=document.querySelector('#batch-filled');if(counter)counter.textContent=`已填写 ${s.ids.filter(id=>s.batchDrafts[id]?.trim()).length} / ${s.ids.length} · 草稿自动保存`;
    clearTimeout(saveTimer);saveTimer=setTimeout(persist,200);
  }
  if(el.id==='answer'&&!activeSession()?.currentResult){activeSession().draft=el.value;clearTimeout(saveTimer);saveTimer=setTimeout(persist,200);}
  if(el.dataset.pref==='rate'){pref().rate=Number(el.value);el.style.setProperty('--fill',`${Math.round((pref().rate-.5)*100)}%`);document.querySelector(`#${el.id}-output`).textContent=pref().rate.toFixed(2)+'×';}
  if(el.id==='word-search'){const search=el.value.trim().toLowerCase();const rows=[...document.querySelectorAll('[data-search]')];rows.forEach(row=>{row.hidden=!row.dataset.search.includes(search);});document.querySelector('#search-empty').hidden=rows.some(row=>!row.hidden);}
});
document.addEventListener('compositionstart',()=>{composing=true;});
document.addEventListener('compositionend',()=>{composing=false;lastCompositionEnd=Date.now();});
document.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&(composing||event.isComposing||event.keyCode===229))return;
  const target=event.target, s=activeSession(), practising=!dialog.open&&view==='train'&&!showSetup&&s&&s.index<s.ids.length;
  // Enter moves through the batch answers; only the last box hands in the whole group.
  if(event.key==='Enter'&&target.dataset?.batchAnswer!==undefined){
    event.preventDefault();if(Date.now()-lastCompositionEnd<60)return;
    const inputs=[...document.querySelectorAll('[data-batch-answer]')],index=inputs.indexOf(target);
    if(index<inputs.length-1)inputs[index+1].focus();else requestBatchSubmit();
    return;
  }
  if(event.altKey&&event.key.toLowerCase()==='p'&&practising){
    event.preventDefault();
    // In recall mode the audio would give the answer away, so replay unlocks only after submitting.
    if(isBatch(s)){const row=document.activeElement?.closest?.('[data-batch-row]');speech.speak(entryById(row?.dataset.batchRow||s.ids[0]),s.settings);}
    else if(s.settings.mode!=='recall'||s.currentResult)speech.speak(currentEntry(),s.settings);
    return;
  }
  if(practising&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!target.closest?.('input,select,textarea')&&['meaning','reading'].includes(s.settings.mode)&&!s.currentResult){
    const index='1234'.indexOf(event.key)>=0?'1234'.indexOf(event.key):'abcd'.indexOf(event.key.toLowerCase());
    const choice=index>=0&&event.key.length===1?document.querySelectorAll('[data-action="choice"]')[index]:null;
    if(choice){event.preventDefault();choice.click();return;}
  }
  if(event.key==='Enter'&&practising&&s.currentResult&&!target.closest?.('button,select,textarea,input')&&Date.now()-lastCompositionEnd>60){event.preventDefault();document.querySelector('[data-action="next"]')?.click();}
});
document.addEventListener('submit',event=>{
  const form=event.target;
  if(form.id==='setup-form'){event.preventDefault();start();}
  else if(form.id==='learning-plan-form'){
    event.preventDefault();
    const previous=structuredClone(state);
    try{
      speech.stop();saveLearningPlan(state,{enGoal:Number(form.elements.enGoal.value),jaGoal:Number(form.elements.jaGoal.value),accent:form.elements.accent.value});
      if(!persist()){state=previous;throw new Error('学习计划暂未保存，请检查本机存储，或先在「声音与备份」导出记录。');}
      dialog.close();render();notify('学习计划已保存，之后可随时调整。');
    }catch(error){const el=dialog.querySelector('#plan-error');el.textContent=error.message;el.hidden=false;}
  }
  else if(form.id==='import-form'){event.preventDefault();importBook(form);}
  else if(form.id==='answer-form'){event.preventDefault();if(composing||Date.now()-lastCompositionEnd<60)return;const value=document.querySelector('#answer').value;if(!value.trim()){notify('先写下答案，也可以选择“查看答案”。');focusAnswer();return;}grade(value);}
  else if(form.id==='batch-form'){event.preventDefault();requestBatchSubmit();}
  else if(form.id==='edit-book-form'){
    event.preventDefault();
    try{editCustomBook(state,form.dataset.book,{name:form.elements.bookName.value,kind:form.elements.kind.value,source:form.elements.source.value});speech.stop();recorder.reset();persist();dialog.close();render();notify('词本已更新，过去的学习记录保留。');}
    catch(error){const el=document.querySelector('#edit-book-error');el.textContent=error.message;el.hidden=false;}
  }
});
window.addEventListener('pagehide',()=>{if(!desktopClosing)persist();speech.stop();recorder.reset();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(!desktopClosing)persist();speech.stop();if(recorder.status==='recording')recorder.stop();}});
window.addEventListener('tingdu:native',event=>{const detail=event.detail||{};if(detail.type==='file')notify(detail.ok?'已保存到你选择的位置。':detail.cancelled?'已取消导出。':'没有保存成功，请换个位置重试。');});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',syncSystemBars);
// The Android back key closes dialogs, then returns to practice, before leaving the app.
window.tingduHandleBack=()=>{
  if(dialog.open){dialog.close();confirmCallback=null;return true;}
  if(view!=='train'){navigate('train');return true;}
  return false;
};
setInterval(refreshTimedTheme,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshTimedTheme();});
// The opening animation (index.html) stays until its entrance has played and the first page is ready, then lifts away.
// A skip, a repeat launch in the same session or reduced motion reveals the app at once.
const SPLASH_MIN=1700;
function revealApp(){
  const splash=document.querySelector('#splash'),html=document.documentElement;
  if(!splash)return Promise.resolve();
  const seen=()=>html.classList.contains('splash-seen'),skipped=()=>html.classList.contains('splash-skip');
  return new Promise(resolve=>{
    let lifted=false,timer=0;
    // The splash keeps catching pointer events while it fades, so the tap that skipped it never lands on a button.
    const lift=()=>{
      if(lifted)return;lifted=true;clearTimeout(timer);
      document.removeEventListener('pointerdown',lift,true);document.removeEventListener('keydown',lift,true);
      html.classList.add('splash-out');
      // Replay the page's entrance so the cards cascade in as the splash lifts.
      const content=root.querySelector('.content');if(content&&!seen()){content.classList.remove('view-enter');void content.offsetWidth;content.classList.add('view-enter');}
      setTimeout(()=>{splash.remove();html.classList.remove('splash-out','splash-skip');resolve();},seen()?0:skipped()?320:650);
    };
    if(seen()||skipped())return lift();
    document.addEventListener('pointerdown',lift,true);document.addEventListener('keydown',lift,true);
    timer=setTimeout(lift,Math.max(0,SPLASH_MIN-performance.now()));
  });
}
render();
syncSystemBars();
// Dialogs sit in the browser's top layer, so the first-run plan waits until the splash has gone.
revealApp().then(()=>{if(!state.onboardingComplete&&corruptRaw===null&&!dialog.open)learningPlanDialog();});
if(host){
  host.onSettings(settingsDialog);
  host.onCloseRequested(async()=>{desktopClosing=true;persist();await desktopSave;});
  persist();await desktopSave;await speech.nativeReady;
  host.ready({title:document.title,heading:root.querySelector('h1')?.textContent,language:state.language,stateVersion:state.version,entries:allEntries(state).length,history:state.history.length,customBooks:state.customBooks.length,goals:{en:state.prefs.en.goal,ja:state.prefs.ja.goal},nativeVoiceCount:speech.native.length,englishVoiceCount:speech.forLanguage('en').length,japaneseVoiceCount:speech.forLanguage('ja').length});
}
registerLearningTools({
  read(input={}) {
    if(!input||typeof input!=='object'||Object.keys(input).some(key=>key!=='language')||input.language!==undefined&&!Object.hasOwn(languages,input.language))throw new Error('请选择英语 en 或日语 ja。');
    const language=input.language||state.language;
    return {language,...summarize(state,language),books:allBooks(state).filter(book=>book.language===language).map(book=>({id:book.id,name:book.name,count:allEntries(state).filter(entry=>entry.book===book.id).length}))};
  },
  start(input) {
    if(!input||typeof input!=='object'||Object.keys(input).some(key=>!['language','mode','book','form','limit'].includes(key))||!Object.hasOwn(languages,input.language)||!Object.hasOwn(modes,input.mode)||input.form!==undefined&&!['written','reading'].includes(input.form)||input.limit!==undefined&&![5,10,20,30,50,100].includes(input.limit))throw new Error('练习设置无效。');
    const language=input.language, current=state.sessions[language];
    if(current&&current.index<current.ids.length)return {status:'unfinished_session',message:'请先继续当前练习，或在界面上确认重新开始。'};
    const settings={...state.prefs[language],language,mode:input.mode,book:input.book||state.prefs[language].book,form:input.form||state.prefs[language].form,limit:input.limit||state.prefs[language].limit};
    if(settings.book!=='all'&&!allBooks(state).some(book=>book.id===settings.book&&book.language===language))throw new Error('词本不存在或语言不匹配。');
    speech.stop();recorder.reset();state.language=language;state.prefs[language]={...settings};delete state.prefs[language].language;
    state.sessions[language]=createSession(settings,allEntries(state));view='train';showSetup=false;persist();render();focusAnswer();
    return {status:'started',language,mode:settings.mode,count:activeSession().ids.length};
  }
});
