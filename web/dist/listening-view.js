import { deleteCustomLesson } from './generated-lessons.js';
import { allListeningLessons, lessonById, beginListening, answerListening, submitListening, listeningResult, listeningStats, listeningEntries } from './listening.js';

export function createListeningView({ getState, speech, persist, render, notify, confirm, visible, e, icon }) {
  let catalog = false;
  const current = () => getState().listening.sessions[getState().language];
  const lessons = () => allListeningLessons(getState()).filter(lesson => lesson.language === getState().language);
  const focusHeading = () => document.querySelector('#listening-heading')?.focus({ preventScroll: true });
  const label = kind => kind === 'dialogue' ? '短对话' : '短文';
  const time = at => new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at);

  function sourceNote(lesson) {
    if (!lesson.createdAt) return '';
    const source = lesson.source;
    return '<div class="ai-source-note"><strong>AI 生成材料 · 请结合原文核对答案</strong>' + (source ? `<p>改编自 <a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">维基百科：${e(source.title)}</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">${e(source.license)}</a>。已改写并添加翻译和练习题；改编部分按相同许可分享。资料获取于 ${time(source.retrievedAt)}。</p>` : '<p>按主题创作的学习情景，未使用联网资料。</p>') + '</div>';
  }

  function historySummary() {
    const state = getState(), stats = listeningStats(state, state.language);
    return `<section class="panel listening-records"><div class="panel-title"><div><h2>听力题记录</h2><p class="muted small">已完成 ${stats.attempts} 组 · ${stats.total} 题 · 答对率 ${stats.accuracy === null ? '—' : stats.accuracy + '%'}</p></div><button class="button outline small" data-action="nav" data-view="listening">练听力题${icon('arrow')}</button></div><p class="muted small">听力理解按题统计，不占每日单词目标；最近 100 组成绩随学习备份保存。</p></section>`;
  }

  function catalogView() {
    const state = getState(), language = state.language, session = current(), stats = listeningStats(state, language);
    const history = state.listening.history.filter(item => item.language === language);
    const resume = session && session.submittedAt === null ? `<div class="resume-banner">${icon('clock')}<div><strong>${e(lessonById(session.lessonId, getState()).title)} · 还有一组未交卷</strong><small>已选 ${Object.keys(session.answers).length} / ${session.questionIds.length} 题，草稿已保存</small></div><button class="button small" data-action="listen-resume">继续答题${icon('arrow')}</button></div>` : '';
    return `${resume}<section class="panel listening-intro"><span class="tag blue">LISTEN & UNDERSTAND</span><h2 id="listening-heading" tabindex="-1">听懂一段话，再找到答案</h2><p>先听短对话或短文，再选择答案；交卷后查看原文、中文翻译和逐题解析。可重听、慢速听，也可以稍后回来继续。</p><div class="listening-metrics"><span><strong>${lessons().length}</strong> 篇材料</span><span><strong>${stats.attempts}</strong> 组已完成</span><span><strong>${stats.accuracy === null ? '—' : stats.accuracy + '%'}</strong> 答对率</span></div><div class="voice-notice" data-voice-notice></div></section><div class="inline-actions listening-create"><button class="button secondary" data-action="nav" data-view="ai">${icon('sparkle')}联网找资料 · 生成新听力</button><span class="muted small">支持英语和日语，最多保存 30 篇</span></div><div class="listening-grid">${lessons().map(lesson => {
      const attempts = history.filter(item => item.lessonId === lesson.id), latest = attempts.at(-1);
      const mistakes = stats.mistakes.filter(item => item.lessonId === lesson.id);
      return `<section class="panel listening-card"><div class="panel-title"><span class="mode-icon">${icon(lesson.kind === 'dialogue' ? 'headphones' : 'book')}</span><span class="tag">${label(lesson.kind)} · ${e(lesson.level)}${lesson.createdAt?' · AI 生成':''}</span></div><h3>${e(lesson.title)}</h3><p class="muted small">${lesson.questions.length} 道选择题 · 可重听 · 交卷后看解析</p><p class="listening-last">${latest ? `最近答对 ${listeningResult(latest, getState()).correct} / ${latest.questionIds.length} 题 · 已练 ${attempts.length} 次` : '还没练过，从这一篇开始吧'}</p><div class="inline-actions"><button class="button small" data-action="listen-start" data-lesson="${lesson.id}">${icon('play')}开始听力题</button>${mistakes.length ? `<button class="button outline small" data-action="listen-mistakes" data-lesson="${lesson.id}">重练 ${mistakes.length} 道错题</button>` : ''}${lesson.createdAt?`<button class="text-button" data-action="listen-delete" data-lesson="${lesson.id}">删除</button>`:''}</div></section>`;
    }).join('')}</div>${history.length ? `<section class="panel"><div class="panel-title"><h2>最近听力成绩</h2><span class="muted small">最近 10 组</span></div>${history.slice(-10).reverse().map(item => `<div class="history-row"><span class="history-dot ${listeningResult(item, getState()).percent === 100 ? 'good' : 'bad'}"></span><div class="history-main"><strong>${e(lessonById(item.lessonId, getState()).title)}</strong><small>${time(item.submittedAt)}</small></div><span class="tag">${listeningResult(item, getState()).correct} / ${item.questionIds.length} 题</span></div>`).join('')}</section>` : ''}<p class="footer-note">材料可用设备语音或已连接的 AI 朗读；听力成绩单独统计，不占每日单词目标。</p>`;
  }

  function exerciseView(session) {
    const lesson = lessonById(session.lessonId, getState()), done = session.submittedAt !== null, result = listeningResult(session, getState());
    const form = `<div class="listening-questions">${result.items.map(({ question, selected, correct }, index) => `<fieldset class="listening-question"><legend><span class="batch-number">${index + 1}</span>${e(question.prompt)}</legend><div class="choices">${question.options.map((option, optionIndex) => `<label class="choice listening-option ${done ? optionIndex === question.answer ? 'correct' : optionIndex === selected ? 'incorrect' : '' : ''}"><input class="sr-only" type="radio" name="${question.id}" data-listening-choice="${question.id}" value="${optionIndex}" ${selected === optionIndex ? 'checked' : ''} ${done ? 'disabled' : ''}><span class="choice-letter">${'ABCD'[optionIndex]}</span><span class="choice-text">${e(option)}</span></label>`).join('')}</div>${done ? `<div class="listening-explanation ${correct ? '' : 'needs-review'}"><strong>${correct ? '答对了' : '需要再练'} · 正确答案 ${'ABCD'[question.answer]}</strong><p>${e(question.explanation)}</p></div>` : ''}</fieldset>`).join('')}</div>`;
    const transcript = done ? `<section class="panel listening-transcript"><div class="panel-title"><h2>听力原文与翻译</h2><span class="tag">${label(lesson.kind)}</span></div>${sourceNote(lesson)}${lesson.segments.map((segment, index) => `<div class="transcript-line"><div><span class="eyebrow">${e(segment.speaker)}</span><p lang="${lesson.language}">${e(segment.text)}</p><p class="muted small">${e(segment.translation)}</p></div><button class="icon-button" data-action="listen-segment" data-index="${index}" aria-label="重听第 ${index + 1} 段">${icon('volume')}</button></div>`).join('')}</section>` : '';
    return `<section class="panel listening-player"><div class="practice-head"><div><span class="tag blue">${label(lesson.kind)} · ${e(lesson.level)}${lesson.createdAt?' · AI 生成':''} · ${session.questionIds.length} 题</span><h2 id="listening-heading" tabindex="-1">${e(lesson.title)}</h2></div><button class="button ghost small" data-action="listen-catalog">${icon('book')}材料列表</button></div><div class="listening-controls"><button class="button" data-action="listen-play">${icon('play')}播放整篇</button><button class="button outline" data-action="listen-slow">${icon('clock')}慢速听</button><button class="button ghost" data-action="listen-stop">${icon('stop')}停止</button></div><p id="listening-status" class="batch-status" role="status" aria-live="polite">${session.plays ? `已完整播放 ${session.plays} 遍，可以继续作答或再次重听。` : '点击播放开始；可以边听边选答案，交卷前不显示原文。'}</p><div class="voice-notice" data-voice-notice></div></section>${done ? `<section class="panel listening-score" role="status"><span class="score-number">${result.correct}<small>/ ${result.total}</small></span><div><h2>${result.correct === result.total ? '这一组全部答对了' : '交卷完成，一起看看关键线索'}</h2><p>答对率 ${result.percent}% · 成绩已记入听力记录</p><div class="inline-actions">${result.correct < result.total ? `<button class="button small" data-action="listen-retry">${icon('repeat')}只练本组错题</button>` : ''}<button class="button outline small" data-action="listen-start" data-lesson="${lesson.id}">重新练整篇</button><button class="button ghost small" data-action="listen-catalog">选择下一篇${icon('arrow')}</button></div></div></section>` : ''}<section class="panel"><div class="panel-title"><h2>${done ? '逐题解析' : '听后作答'}</h2><span id="listening-answered" class="muted small">已选 ${Object.keys(session.answers).length} / ${session.questionIds.length} 题</span></div>${form}${done ? '' : `<div class="form-footer"><span class="muted small">可修改选项，答案自动保存</span><button class="button" data-action="listen-submit">${icon('check')}交卷看解析</button></div>`}</section>${transcript}`;
  }

  function start(lessonId, ids = null) {
    const state = getState(), language = state.language, previous = current();
    const begin = () => {
      speech.stop();
      beginListening(state, language, lessonId, ids);
      catalog = false; persist(); render(); window.scrollTo({ top: 0 }); focusHeading();
    };
    if (previous && previous.submittedAt === null && (Object.keys(previous.answers).length || previous.plays)) confirm('开始另一组听力题？', '当前听力草稿将被替换，已交卷的成绩和原来的单词练习都会保留。', begin, '开始新一组');
    else begin();
  }

  async function play(slow = false, segmentIndex = null) {
    const state = getState(), language = state.language, session = current();
    if (!session) return;
    const lesson = lessonById(session.lessonId, getState()), all = listeningEntries(lesson);
    if (segmentIndex !== null && (session.submittedAt === null || !Number.isInteger(segmentIndex) || !all[segmentIndex])) return;
    const entries = segmentIndex === null ? all : [all[segmentIndex]];
    const stillHere = () => visible() && getState().language === language && current()?.id === session.id && !catalog;
    const status = text => { if (stillHere()) { const el = document.querySelector('#listening-status'); if (el) el.textContent = text; } };
    const success = await speech.playSequence(entries, { ...state.prefs[language], repeat: 1, pause: .5 }, ({ index, phase }) => {
      status(phase === 'finished' ? '播放完毕，可以作答或再次重听。' : phase === 'stopped' ? '已停止播放，可以继续作答。' : phase === 'failed' ? '本次播放未完成，请检查音色后重试。' : `正在播放第 ${(segmentIndex ?? index) + 1} / ${all.length} 段${slow ? ' · 慢速' : ''}…`);
    }, slow);
    if (success && stillHere() && segmentIndex === null && session.submittedAt === null) {
      session.plays = Math.min(10000, session.plays + 1); persist();
      status(`已完整播放 ${session.plays} 遍，可以作答或再次重听。`);
    }
  }

  function action(button) {
    const name = button.dataset.action;
    if (!name.startsWith('listen-')) return false;
    try {
      if (name === 'listen-start') start(button.dataset.lesson);
      else if (name === 'listen-mistakes') start(button.dataset.lesson, listeningStats(getState(), getState().language).mistakes.filter(item => item.lessonId === button.dataset.lesson).map(item => item.question.id));
      else if (name === 'listen-resume') { catalog = false; render(); focusHeading(); }
      else if (name === 'listen-catalog') { speech.stop(); catalog = true; render(); window.scrollTo({ top: 0 }); focusHeading(); }
      else if (name === 'listen-play' || name === 'listen-slow') void play(name === 'listen-slow');
      else if (name === 'listen-stop') speech.stop();
      else if (name === 'listen-segment') void play(false, Number(button.dataset.index));
      else if (name === 'listen-retry') start(current().lessonId, listeningResult(current(), getState()).items.filter(item => !item.correct).map(item => item.question.id));
      else if (name === 'listen-delete') confirm('删除这篇自建听力？', '这篇材料、对应草稿和听力成绩都会删除。建议先导出学习备份。', () => { speech.stop(); deleteCustomLesson(getState(), button.dataset.lesson); persist(); render(); }, '删除材料');
      else if (name === 'listen-submit') {
        submitListening(getState(), getState().language); speech.stop(); persist(); render(); window.scrollTo({ top: 0 }); focusHeading();
      }
    } catch (error) { notify(error.message); }
    return true;
  }

  function change(input) {
    if (!input.dataset.listeningChoice) return false;
    try {
      answerListening(current(), input.dataset.listeningChoice, Number(input.value), getState()); persist();
      const counter = document.querySelector('#listening-answered');
      if (counter) counter.textContent = `已选 ${Object.keys(current().answers).length} / ${current().questionIds.length} 题`;
    } catch (error) { notify(error.message); }
    return true;
  }

  return { render: () => catalog || !current() ? catalogView() : exerciseView(current()), action, change, historySummary, openLesson: start };
}
