import { languages, englishAccents } from './data.js';

export class SpeechPlayer {
  constructor(notify, onChange = () => {}) {
    this.notify = notify; this.onChange = onChange; this.voices = []; this.native = []; this.cache = new Map(); this.token = 0; this.playingId = null;
    this.android = window.TingduAndroid || null;
    if ('speechSynthesis' in window) {
      this.refresh();
      window.speechSynthesis.addEventListener('voiceschanged', () => this.refresh());
    }
    // Android starts its speech engine asynchronously and announces voices once it is ready or after a change.
    if (this.android) window.addEventListener('tingdu:native', event => { if (event.detail?.type === 'voices') this.loadNative(); });
    this.nativeReady=this.android||['127.0.0.1','localhost'].includes(location.hostname)||window.tingduDesktop?this.loadNative():Promise.resolve();
  }
  async loadNative(refresh = false) {
    this.loadingNative=true;let pending=false;
    try {
      if (this.android) {
        const reply = JSON.parse(this.android.voices(refresh));pending=!reply.ready;
        this.native = reply.voices.map(voice => ({...voice, voiceURI:'android:'+voice.name, provider:'android'}));
        return;
      }
      const response = await fetch('/api/voices'+(refresh?'?refresh=1':'')); if (!response.ok) return;
      const voices = await response.json();
      this.native = voices.map(voice => ({...voice, voiceURI:'windows:'+voice.name, localService:true, provider:'windows'}));
    } catch {} finally {this.loadingNative=pending;this.refresh();}
  }
  refresh() { this.voices = [...(window.speechSynthesis?.getVoices() || []), ...this.native]; this.onChange(); }
  forLanguage(lang, accent) {
    const locale=lang==='en'&&accent?accent.toLowerCase():lang.toLowerCase();
    return this.voices.filter(voice=>{const tag=voice.lang.toLowerCase().replace(/_/g,'-');return tag===locale||tag.startsWith(locale+'-');});
  }
  stop() {
    this.sequenceToken=(this.sequenceToken||0)+1;
    clearTimeout(this.pauseTimer);this.pauseResolve?.(false);this.pauseResolve=null;
    this.sequenceProgress?.({index:-1,repeat:0,phase:'stopped'});this.sequenceProgress=null;
    this.stopPlayback();
  }
  stopPlayback() {
    this.token++;this.resolvePlayback?.(false);this.resolvePlayback=null;this.detachPlayback?.();this.detachPlayback=null; clearTimeout(this.timer); this.abort?.abort();
    if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.remove();this.audio=null;}
    window.speechSynthesis?.cancel(); try{this.android?.stopSpeech();}catch{} this.setPlaying(false);
  }
  pause(milliseconds){return new Promise(resolve=>{this.pauseResolve=resolve;this.pauseTimer=setTimeout(()=>{this.pauseResolve=null;resolve(true);},milliseconds);});}
  // Only the controls for the entry being spoken show the playing state.
  setPlaying(active, id = this.playingId) {
    this.playingId = active ? id : null;
    document.querySelectorAll('[data-action="speak"]').forEach(button => { const on = active && button.dataset.id === id; button.classList.toggle('playing', on); button.setAttribute('aria-busy', String(on)); });
    // The logo's sound bars dance while any demonstration plays.
    document.documentElement?.classList.toggle('is-speaking', Boolean(active));
  }
  syncPlaying() { if (this.playingId) this.setPlaying(true); }
  speak(entry, settings, slow = false) {
    return this.playSequence([entry],settings,null,slow);
  }
  async playSequence(entries,settings,onProgress=null,slow=false){
    this.stop();const sequenceToken=this.sequenceToken;this.sequenceProgress=onProgress;
    const repeats=[1,2,3].includes(settings.repeat)?settings.repeat:1;
    for(let index=0;index<entries.length;index++){
      for(let repeat=0;repeat<repeats;repeat++){
        if(sequenceToken!==this.sequenceToken)return false;
        onProgress?.({index,repeat,phase:'playing'});
        const played=await this.speakOnce(entries[index],settings,slow);
        if(sequenceToken!==this.sequenceToken)return false;
        if(!played){onProgress?.({index,repeat,phase:'failed'});this.sequenceProgress=null;return false;}
        if(repeat+1<repeats&&!await this.pause(650))return false;
      }
      if(index+1<entries.length){onProgress?.({index,repeat:repeats-1,phase:'pause'});if(sequenceToken!==this.sequenceToken||!await this.pause((settings.pause||4)*1000))return false;}
    }
    this.sequenceProgress=null;onProgress?.({index:entries.length-1,repeat:repeats-1,phase:'finished'});return true;
  }
  spokenText(entry) { return entry.language === 'ja' && entry.kind === 'word' ? entry.reading : entry.text; }
  speakOnce(entry, settings, slow = false) {
    this.stopPlayback();
    if(this.ai?.readAloud)return this.speakAI(entry,settings,slow);
    const accent=entry.language==='en'?(settings.accent||'en-US'):null;
    const voices = this.forLanguage(entry.language,accent), label=accent?englishAccents[accent]?.name:languages[entry.language].name;
    if (!voices.length) {this.notify(this.loadingNative?'正在检测本机音色，请稍后再点击播放。':`尚未发现${label}音色。${this.android?'请在系统语音设置里安装对应语言的语音数据后重新检测。':'请使用提供对应音色的浏览器，或添加设备语音后重新检测。'}`);return Promise.resolve(false);}
    const voice = voices.find(v => v.voiceURI === settings.voice) || voices.find(v => v.localService) || voices[0];
    if (voice.provider === 'windows') return this.speakNative(entry,settings,voice,slow);
    if (voice.provider === 'android') return this.speakAndroid(entry,settings,voice,slow);
    if (!('speechSynthesis' in window)) {this.notify('当前浏览器无法朗读，请换支持朗读的浏览器后再做听力题。');return Promise.resolve(false);}
    const utterance = new SpeechSynthesisUtterance(this.spokenText(entry));
    utterance.voice = voice; utterance.lang = voice.lang || languages[entry.language].locale;
    utterance.rate = slow ? Math.max(.5, settings.rate * .7) : settings.rate;
    this.utterance = utterance; const token = this.token;
    this.setPlaying(true, entry.id);
    return new Promise(resolve=>{
      this.resolvePlayback=resolve;
      const finish=success=>{if(token!==this.token)return;clearTimeout(this.timer);this.resolvePlayback=null;this.setPlaying(false);resolve(success);};
      utterance.onend=()=>finish(true);
      utterance.onerror=event=>{finish(false);if(token===this.token&&!['canceled','interrupted'].includes(event.error))this.notify('朗读没有成功。请检查音量、音色或网络，然后重试。');};
      this.timer=setTimeout(()=>{if(token===this.token){this.stopPlayback();this.notify('朗读未返回结果，请重试或更换音色。');}},Math.max(20000,entry.text.length*1000));
      try{window.speechSynthesis.speak(utterance);}catch{finish(false);this.notify('朗读未能开始，请更换音色后重试。');}
    });
  }
  async speakAI(entry,settings,slow){
    const token=this.token;this.abort=new AbortController();this.setPlaying(true,entry.id);
    try{
      if(!this.ai.verified)throw new Error('请先在“AI 语音”中连接并测试语音能力。');
      const key=JSON.stringify(['ai',this.ai.revision,entry.language,settings.accent,this.spokenText(entry)]);
      let url=this.cache.get(key);
      if(!url){const bytes=await this.ai.synthesize(this.spokenText(entry),entry.language,settings.accent,this.abort.signal);if(token!==this.token)return false;url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));this.cache.set(key,url);if(this.cache.size>24){const first=this.cache.keys().next().value;URL.revokeObjectURL(this.cache.get(first));this.cache.delete(first);}}
      if(token!==this.token)return false;
      this.audio=new Audio(url);this.audio.id='ai-demonstration';this.audio.hidden=true;this.audio.playbackRate=slow?Math.max(.5,settings.rate*.7):settings.rate;document.body.append(this.audio);
      const ended=new Promise(resolve=>{this.resolvePlayback=resolve;const finish=ok=>{if(token!==this.token)return;clearTimeout(this.timer);this.resolvePlayback=null;this.setPlaying(false);resolve(ok);};this.audio.onended=()=>finish(true);this.audio.onerror=()=>{finish(false);this.notify('AI 音频无法播放，请检查音频格式。');};});
      this.timer=setTimeout(()=>{if(token===this.token){this.stopPlayback();this.notify('AI 音频播放超时。');}},120000);
      await this.audio.play();return await ended;
    }catch(error){if(token===this.token){clearTimeout(this.timer);this.resolvePlayback?.(false);this.resolvePlayback=null;this.setPlaying(false);this.notify(error.name==='NotAllowedError'?'AI 声音已准备好，请再点击播放。':error.message||'AI 朗读失败，请重试。');}return false;}
  }
  // Android speaks through the system engine and reports completion as a "speech" native event.
  speakAndroid(entry, settings, voice, slow) {
    const token=this.token, id=`utterance-${token}`;
    this.setPlaying(true, entry.id);
    return new Promise(resolve=>{
      this.resolvePlayback=resolve;
      const finish=success=>{if(token!==this.token)return;this.detachPlayback?.();this.detachPlayback=null;clearTimeout(this.timer);this.resolvePlayback=null;this.setPlaying(false);resolve(success);};
      const listener=event=>{if(event.detail?.type==='speech'&&event.detail.id===id){finish(event.detail.ok);if(!event.detail.ok)this.notify('朗读没有成功。请检查音量，或在系统语音设置里确认语音数据已安装。');}};
      window.addEventListener('tingdu:native',listener);this.detachPlayback=()=>window.removeEventListener('tingdu:native',listener);
      this.timer=setTimeout(()=>{if(token===this.token){this.stopPlayback();this.notify('朗读未返回结果，请重试或更换音色。');}},Math.max(20000,entry.text.length*1000));
      try{
        const reply=JSON.parse(this.android.speak(JSON.stringify({id,language:entry.language,voice:voice.name,text:this.spokenText(entry),rate:slow?Math.max(.5,settings.rate*.7):settings.rate})));
        if(!reply.ok){finish(false);this.notify('朗读未能开始，请更换音色后重试。');}
      }catch{finish(false);this.notify('朗读未能开始，请更换音色后重试。');}
    });
  }
  async speakNative(entry, settings, voice, slow) {
    const token=this.token;
    const input={language:entry.language, voice:voice.name, text:this.spokenText(entry), rate:slow?Math.max(.5,settings.rate*.7):settings.rate};
    const key=JSON.stringify(input);this.setPlaying(true, entry.id);
    try {
      let url=this.cache.get(key);
      if(!url){
        this.abort=new AbortController();
        const response=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:key,signal:this.abort.signal});
        if(!response.ok)throw new Error('Speech failed');
        const blob=await response.blob();if(token!==this.token)return false;
        url=URL.createObjectURL(blob);this.cache.set(key,url);
        if(this.cache.size>24){const first=this.cache.keys().next().value;URL.revokeObjectURL(this.cache.get(first));this.cache.delete(first);}
      }
      if(token!==this.token)return false;
      this.audio=new Audio(url);this.audio.id='native-demonstration';this.audio.hidden=true;document.body.append(this.audio);
      const ended=new Promise(resolve=>{
        this.resolvePlayback=resolve;
        this.audio.onended=()=>{if(token===this.token){this.resolvePlayback=null;this.setPlaying(false);resolve(true);}};
        this.audio.onerror=()=>{if(token===this.token){this.resolvePlayback=null;this.setPlaying(false);this.notify('声音没有播放成功，请检查设备后重试。');resolve(false);}};
      });
      await this.audio.play();
      return await ended;
    } catch(error) {if(token===this.token){this.resolvePlayback?.(false);this.resolvePlayback=null;this.setPlaying(false);this.notify(error.name==='NotAllowedError'?'声音已准备好，请再点一次播放。':'本机朗读未成功，请重试或更换音色。');}return false;}
  }
}

export class VoiceRecorder {
  constructor(notify, onChange, maxSeconds=60) { this.notify = notify; this.onChange = onChange; this.maxSeconds=maxSeconds; this.status = 'idle'; this.token = 0; this.url = null; this.blob=null; }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return this.notify('当前浏览器不能录音。仍可播放示范并自行跟读。');
    this.reset(); const token = this.token; this.status = 'requesting'; this.onChange();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== this.token) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream; this.chunks = [];
      this.recorder = new MediaRecorder(stream);
      this.recorder.ondataavailable = event => { if (token === this.token && event.data.size) this.chunks.push(event.data); };
      this.recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (token !== this.token) return;
        clearTimeout(this.timer);
        this.blob=new Blob(this.chunks, { type: this.recorder.mimeType || 'audio/webm' });
        this.url = URL.createObjectURL(this.blob);
        this.status = 'ready'; this.onChange();
      };
      this.recorder.onerror = () => { if(token!==this.token)return;this.reset(); this.notify('录音中断，请检查麦克风后重试。'); this.onChange(); };
      this.recorder.start(); this.startedAt = Date.now(); this.status = 'recording';
      this.timer = setTimeout(() => { this.stop(); this.notify(`已保留本次录音，单次最多 ${this.maxSeconds} 秒。`); }, this.maxSeconds*1000);
      this.onChange();
    } catch (error) {
      if (token !== this.token) return;
      this.reset(); this.onChange();
      this.notify(error.name === 'NotAllowedError' ? '麦克风权限未开启。请允许听读使用麦克风后重试。' : '没有找到可用麦克风，请检查设备后重试。');
    }
  }
  stop() { if (this.recorder?.state === 'recording') { this.status = 'processing'; this.recorder.stop(); this.onChange(); } }
  reset() {
    this.token++; clearTimeout(this.timer);
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null; this.blob=null; this.status = 'idle'; this.stream = null;
  }
}
