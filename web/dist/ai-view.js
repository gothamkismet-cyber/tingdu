import { VoiceRecorder } from './audio.js';
import { onlineRequest, recordingWave } from './ai-client.js';
import { parseLessonReply, wikiSearchReply, wikiSummaryReply } from './ai-protocol.js';
import { generatedLesson, saveCustomLesson, CUSTOM_LESSON_LIMIT } from './generated-lessons.js';

export function createAIView({ client, getState, render, visible, notify, persist, speech, confirm, openLesson, e, icon }) {
  let initialized = false, loading = null, draft = { ...client.config }, remember = client.remember;
  let busy = '', error = '', controller = null, epoch = 0, testUrl = '', messages = [];
  let chatText = '', topic = '', level = '入门', results = [], source = null, preview = null, savedId = '';
  const refresh = () => { if (visible()) render(); };
  const recorder = new VoiceRecorder(notify, refresh, 30);
  const language = () => getState().language;
  const languageName = () => language() === 'ja' ? '日语' : '英语';
  const disabled = condition => condition ? 'disabled' : '';
  const dirty = () => Object.keys(client.config).some(key => draft[key] !== client.config[key]) || remember !== client.remember;
  const usable = () => client.verified && !dirty();
  const revoke = url => { if (url) URL.revokeObjectURL(url); };
  const makeAudio = bytes => URL.createObjectURL(new Blob([bytes], { type:'audio/wav' }));
  const audio = (url, label) => `<audio controls preload="none" src="${e(url)}" aria-label="${e(label)}"></audio>`;

  async function enter() {
    if (initialized) return;
    if (!loading) loading = client.load();
    try { await loading; } catch (err) { error = err.message; }
    if (!initialized) { initialized = true; draft = { ...client.config }; remember = client.remember; }
    refresh();
  }
  function cancel() {
    epoch++; controller?.abort(); controller = null; busy = '';
    speech.stop(); document.querySelectorAll('.ai-page audio').forEach(el => el.pause());
  }
  function leave(clear = false) {
    cancel(); recorder.reset(); revoke(testUrl); testUrl = '';
    if (clear) {
      messages.forEach(message => revoke(message.url)); messages = []; chatText = '';
      topic = ''; results = []; source = null; preview = null; savedId = ''; error = '';
    }
  }
  async function run(label, job) {
    if (busy) return;
    const token = ++epoch, lang = language(); controller = new AbortController();
    const signal = controller.signal, active = () => epoch === token && visible() && language() === lang && !signal.aborted;
    busy = label; error = ''; speech.stop(); refresh();
    try { await job(signal, active); }
    catch (err) { if (active() && err.name !== 'AbortError') error = err.message || '本次操作未完成，请重试。'; }
    finally { if (epoch === token) { controller = null; busy = ''; refresh(); } }
  }
  const requireReady = () => { if (!usable()) throw new Error('请先保存当前连接并通过语音测试。'); };
  function connectionView() {
    const field = (key, label, placeholder, type = 'text', max = 120) => `<div class="field ${key === 'baseUrl' || key === 'apiKey' ? 'full' : ''}"><label for="ai-${key}">${label}</label><input id="ai-${key}" data-ai-config="${key}" type="${type}" value="${e(draft[key])}" placeholder="${e(placeholder)}" maxlength="${max}" autocomplete="off" autocapitalize="none" spellcheck="false" ${disabled(busy || !initialized)}></div>`;
    return `<details class="panel ai-connection" ${!client.verified || dirty() ? 'open' : ''}><summary><span>${icon('settings')}连接自己的语音 AI</span><span class="tag ${usable() ? 'green' : ''}">${usable() ? '语音测试通过' : dirty() ? '设置待测试' : '尚未连接'}</span></summary><div class="ai-connection-body"><p class="muted small">使用 OpenAI 兼容的音频对话接口。API 是服务商提供的调用入口；密钥、支持音频输入和输出的模型、音色均由你填写。纯文本模型不能启用语音。</p><form id="ai-connect-form"><div class="form-grid">${field('baseUrl','API 根地址','https://api.openai.com/v1','url',500)}${field('apiKey','API 密钥','粘贴服务商提供的密钥','password',4096)}${field('model','音频模型','gpt-audio-1.5')}${field('voice','音色名称','alloy','text',80)}</div><label class="ai-check"><input type="checkbox" data-ai-remember ${remember ? 'checked' : ''} ${disabled(!client.secureAvailable || busy)}>在本设备加密记住连接</label><p class="muted small">${client.secureAvailable ? '使用系统加密保存；取消勾选后，已保存的密钥会在下次连接测试时移除。' : '当前环境仅在本次运行持有密钥，关闭或刷新后需重填。'}密钥不进入学习备份。每次启动后需手动测试；测试和使用 AI 都可能消耗服务商额度。</p><div class="inline-actions"><button type="submit" class="button" ${disabled(busy || !initialized)}>${icon('volume')}保存并测试语音</button><button type="button" class="button ghost" data-action="ai-forget" ${disabled(busy || !initialized)}>清除连接密钥</button></div></form>${testUrl ? `<div class="ai-test-audio"><p>已收到有效 WAV 音频，请试听确认声音。测试仅证明接口接受了音频参数并返回音频，识别和音质请在陪练中体验。</p>${audio(testUrl,'连接测试音频')}</div>` : ''}</div></details>`;
  }
  function chatView() {
    const recording = ['recording','requesting','processing'].includes(recorder.status);
    return `<section class="panel ai-chat"><div class="panel-title"><div><span class="eyebrow">SPEAK & CONNECT</span><h2>${languageName()}语音陪练</h2></div><button class="text-button" data-action="ai-clear-chat" ${disabled(busy)}>清空对话</button></div><p class="muted small">输入文字或录一段话，让 AI 用声音回应。对话只保留在本次运行中，不写入学习备份；切换语言会清空。</p><div class="ai-messages" role="log" aria-label="语音对话">${messages.length ? messages.map(item => `<div class="ai-message ${item.role}"><span class="eyebrow">${item.role === 'user' ? '你' : 'AI 陪练'}</span><p>${e(item.content)}</p>${item.url ? audio(item.url,'AI 回复音频') : ''}</div>`).join('') : `<div class="ai-chat-empty">${icon('mic')}<strong>从一句简单的问候开始</strong><p>${language() === 'ja' ? 'こんにちは。今日は何をしましたか？' : 'Hi! Can we practice ordering a coffee?'}</p></div>`}</div><form id="ai-chat-form"><div class="field ai-chat-input"><label class="sr-only" for="ai-chat-text">给 AI 的消息</label><textarea id="ai-chat-text" maxlength="1200" rows="3" placeholder="写一句话，或在下方录音…" ${disabled(busy)}>${e(chatText)}</textarea></div><div class="inline-actions"><button class="button" type="submit" ${disabled(busy || !usable() || recording)}>${icon('arrow')}发送文字</button>${recorder.status === 'recording' ? `<button type="button" class="button outline" data-action="ai-record-stop">${icon('stop')}结束录音</button>` : `<button type="button" class="button outline" data-action="ai-record" ${disabled(busy || !usable() || recording)}>${icon('mic')}${recording ? '准备录音…' : '录音 · 最多 30 秒'}</button>`}</div></form>${recorder.url ? `<div class="ai-record-preview"><strong>本机录音预听 · 尚未上传</strong>${audio(recorder.url,'本次录音预听')}<div class="inline-actions"><button class="button secondary" data-action="ai-send-recording" ${disabled(busy || !usable())}>发送录音给 AI</button><button class="text-button" data-action="ai-discard-recording" ${disabled(busy)}>丢弃录音</button></div></div>` : ''}<p class="ai-privacy">${recorder.status === 'recording' ? '正在录音，结束后可预听。' : '点击发送时，当前消息、录音（如有）和最近对话会发给你配置的服务。AI 回复可能有误，不提供发音评分。'}</p></section>`;
  }
  function networkView() {
    return `<section class="panel ai-network"><div class="panel-title"><div><span class="eyebrow">EXPLORE & LISTEN</span><h2>把感兴趣的主题变成听力题</h2></div>${icon('book')}</div><p class="muted small">联网查找维基百科摘要，再由已连接的 AI 改写成${languageName()}听力。也可以按主题创作日常对话情景。</p><form id="ai-search-form"><div class="field"><label for="ai-topic">想了解什么？</label><input id="ai-topic" value="${e(topic)}" maxlength="100" placeholder="${language() === 'ja' ? '例：京都、寿司、電車' : '例：London、coffee、ocean'}" ${disabled(busy)}><small>百科搜索使用当前学习语言，试试英文或日文关键词。</small></div><div class="ai-topic-examples">${(language() === 'ja' ? ['京都','寿司','電車'] : ['London','Coffee','Ocean']).map(value => `<button type="button" class="tag" data-action="ai-topic" data-topic="${e(value)}" ${disabled(busy)}>${e(value)}</button>`).join('')}</div><div class="inline-actions"><button class="button secondary" type="submit" ${disabled(busy)}>${icon('search')}联网查资料</button><label class="ai-level" for="ai-level">难度 <select id="ai-level" ${disabled(busy)}><option ${level === '入门' ? 'selected' : ''}>入门</option><option ${level === '进阶' ? 'selected' : ''}>进阶</option></select></label></div></form>${results.length ? `<ul class="ai-search-results">${results.map((item,index) => `<li><button data-action="ai-source" data-index="${index}" ${disabled(busy)}><strong>${e(item.title)}</strong><small>${e(item.description)}</small>${icon('arrow')}</button></li>`).join('')}</ul>` : ''}${source ? `<div class="ai-source-note"><strong>已选资料：${e(source.title)}</strong><p>${e(source.extract)}</p><a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">阅读维基百科原文</a><small> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · 将改写并添加翻译、练习题</small><button class="text-button" data-action="ai-source-clear" ${disabled(busy)}>取消选择资料</button></div>` : ''}<div class="inline-actions ai-generate"><button class="button" data-action="ai-generate" ${disabled(busy || !usable())}>${icon('sparkle')}${source ? '用这份资料生成听力' : '按主题创作听力'}</button></div><p class="muted small">生成时会发送主题和所选摘要。题目有格式检查，但事实和答案仍需你核对。已保存 ${getState().listening.customLessons.length} / ${CUSTOM_LESSON_LIMIT} 篇。</p>${preview ? `<div class="ai-lesson-preview"><span class="tag green">${savedId ? '已保存到听力题' : '生成完成'}</span><h3>${e(preview.title)}</h3><p>${preview.segments.length} 段${languageName()}原文 · 3 道选择题 · ${preview.source ? '含百科来源' : 'AI 原创情景'}</p><details><summary>预览原文、答案与解析</summary>${preview.segments.map(s => `<p lang="${preview.language}">${e(s.text)}</p><p class="muted small">${e(s.translation)}</p>`).join('')}${preview.questions.map((q,i) => `<p><strong>${i+1}. ${e(q.prompt)}</strong></p><p>${q.options.map((option,j) => `${'ABCD'[j]}. ${e(option)}`).join(' / ')}</p><p class="muted small">答案 ${'ABCD'[q.answer]} · ${e(q.explanation)}</p>`).join('')}</details><button class="button secondary" data-action="${savedId ? 'ai-open-lesson' : 'ai-save-lesson'}" ${disabled(busy)}>${savedId ? '开始这篇听力' : '保存到听力题'}</button></div>` : ''}</section>`;
  }
  function view() {
    return `<div class="ai-page"><section class="ai-intro"><span class="tag blue">YOUR VOICE, YOUR PACE</span><h2>听一句，也说一句。</h2><p>连接自己的语音 AI，让练习围绕你的兴趣展开。</p><label class="ai-check"><input type="checkbox" data-ai-read ${client.readAloud ? 'checked' : ''} ${disabled(busy)}>单词和听力题也使用 AI 朗读</label><small>${client.readAloud ? 'AI 朗读已选择；每次启动需先连接测试。失败时会提示，可取消勾选恢复设备语音。' : '当前练习使用设备语音；联网与 AI 都由你手动开启。'}</small></section>${connectionView()}<div class="ai-operation-status" role="status" aria-live="polite">${busy ? `<span>${e(busy)}…</span><button class="text-button" data-action="ai-cancel">取消</button>` : ''}</div>${error ? `<div class="notice ai-error" role="alert">${e(error)}</div>` : ''}<div class="ai-grid">${chatView()}${networkView()}</div></div>`;
  }
  function connect() {
    return run('正在测试语音接口', async (signal, active) => {
      revoke(testUrl); testUrl = ''; await client.configure(draft, remember);
      const reply = await client.complete('test', {}, { signal });
      if (active()) { testUrl = makeAudio(reply.bytes); notify('语音测试通过，可开始陪练或启用 AI 朗读。'); }
    });
  }
  function send(recorded = false) {
    return run('AI 正在回复', async (signal, active) => {
      requireReady(); const text = chatText.trim(), blob = recorded ? recorder.blob : null;
      if (recorded && !blob) throw new Error('请先完成录音。');
      if (!recorded && !text) throw new Error('先写一句话，或录音后点击发送。');
      const wave = blob ? await recordingWave(blob) : undefined;
      if (!active()) return;
      const reply = await client.complete('chat', { language:language(), accent:getState().prefs.en.accent, text, audio:wave, history:messages.map(({role,content}) => ({role,content})) }, { signal });
      if (!active()) return;
      messages.push({ role:'user', content:recorded ? `[已发送语音]${text ? ' '+text : ''}` : text }, { role:'assistant', content:reply.transcript || '已收到语音回复，请点击播放。', url:makeAudio(reply.bytes) });
      while (messages.length > 12) revoke(messages.shift().url);
      chatText = ''; if (recorded) recorder.reset();
    });
  }
  function search() {
    return run('正在查找百科资料', async (signal, active) => {
      if (!topic.trim()) throw new Error('先填写一个想了解的主题。');
      const data = await onlineRequest({ kind:'wiki', language:language(), query:topic.trim() }, { signal });
      if (active()) { results = wikiSearchReply(data); source = null; if (!results.length) error = '没有找到资料，试试当前学习语言的其他关键词。'; }
    });
  }
  function input(el) {
    if (el.dataset.aiConfig) {
      draft[el.dataset.aiConfig] = el.value;
      const tag = document.querySelector('.ai-connection summary .tag'); if (tag) tag.textContent = dirty() ? '设置待测试' : client.verified ? '语音测试通过' : '尚未连接';
      return true;
    }
    if (el.id === 'ai-chat-text') { chatText = el.value; return true; }
    if (el.id === 'ai-topic') {
      topic = el.value; source = null; results = [];
      document.querySelector('.ai-network .ai-source-note')?.remove(); document.querySelector('.ai-search-results')?.remove();
      const button = document.querySelector('[data-action="ai-generate"]'); if (button) button.innerHTML = icon('sparkle') + '按主题创作听力';
      return true;
    }
    return false;
  }
  function change(el) {
    if (el.hasAttribute('data-ai-remember')) { remember = el.checked; refresh(); return true; }
    if (el.hasAttribute('data-ai-read')) {
      speech.stop(); client.readAloud = el.checked;
      try { client.savePublicPreferences(); } catch (err) { notify(err.message); } refresh(); return true;
    }
    if (el.id === 'ai-level') { level = el.value; return true; }
    if (el.dataset.aiConfig || el.id === 'ai-topic') return true;
    return false;
  }
  function submit(form) {
    if (form.id === 'ai-connect-form') { void connect(); return true; }
    if (form.id === 'ai-chat-form') { void send(); return true; }
    if (form.id === 'ai-search-form') { void search(); return true; }
    return false;
  }
  function action(button) {
    const name = button.dataset.action;
    if (!name.startsWith('ai-')) return false;
    if (name === 'ai-cancel') { cancel(); refresh(); return true; }
    if (busy) return true;
    try {
      if (name === 'ai-forget') confirm('清除 AI 密钥？', '删除本设备加密保存的连接密钥，并关闭 AI 朗读。学习记录和自建听力会保留。', () => void run('正在清除连接', async () => { await client.forget(); draft = {...client.config}; remember = false; revoke(testUrl); testUrl = ''; }),'清除密钥');
      else if (name === 'ai-record') { requireReady(); speech.stop(); void recorder.start(); }
      else if (name === 'ai-record-stop') recorder.stop();
      else if (name === 'ai-discard-recording') { recorder.reset(); refresh(); }
      else if (name === 'ai-send-recording') void send(true);
      else if (name === 'ai-clear-chat') { messages.forEach(item => revoke(item.url)); messages = []; recorder.reset(); refresh(); }
      else if (name === 'ai-topic') { topic = button.dataset.topic; source = null; results = []; refresh(); }
      else if (name === 'ai-source-clear') { source = null; refresh(); }
      else if (name === 'ai-source') void run('正在获取资料摘要', async (signal, active) => {
        const selected = results[Number(button.dataset.index)]; if (!selected) return;
        const data = await onlineRequest({ kind:'wiki', language:language(), title:selected.key }, { signal });
        if (active()) source = wikiSummaryReply(data, language());
      });
      else if (name === 'ai-generate') void run('AI 正在编写听力题', async (signal, active) => {
        requireReady();
        if (getState().listening.customLessons.length >= CUSTOM_LESSON_LIMIT) throw new Error('自建听力已达 30 篇，请备份后整理材料。');
        const data = await client.complete('lesson', { language:language(), level, topic:source?.title || topic, source:source?.extract }, { signal });
        if (active()) { preview = generatedLesson(parseLessonReply(data), { language:language(), level, source }); savedId = ''; }
      });
      else if (name === 'ai-save-lesson' && preview && !savedId) {
        const state = getState(); saveCustomLesson(state, preview);
        if (!persist()) { state.listening.customLessons.pop(); throw new Error('材料没有保存成功，请先检查本机存储。'); }
        savedId = preview.id; refresh(); notify('已保存到听力题，也会包含在学习备份中。');
      } else if (name === 'ai-open-lesson' && savedId) openLesson(savedId);
    } catch (err) { error = err.message; refresh(); }
    return true;
  }
  return { render:view, enter, leave, action, input, change, submit, stopRecording:() => recorder.stop() };
}
