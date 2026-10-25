import {AI_DEFAULTS,validateAIConfig,prepareOnlineRequest,buildAIMessage,audioReply,httpError,pcmWave,bytesBase64} from './ai-protocol.js';

export async function onlineRequest(request,{signal}={}) {
  prepareOnlineRequest(request);
  let result;
  if(window.TingduAndroid?.online){
    result=await new Promise((resolve,reject)=>{
      const id=crypto.randomUUID();
      const cleanup=()=>{clearTimeout(timer);window.removeEventListener('tingdu:native',receive);signal?.removeEventListener('abort',abort);};
      const abort=()=>{cleanup();try{window.TingduAndroid.cancelOnline(id);}catch{}reject(new DOMException('已取消','AbortError'));};
      const receive=event=>{if(event.detail?.type!=='online'||event.detail.id!==id)return;cleanup();event.detail.error?reject(new Error(event.detail.error)):resolve(event.detail.result);};
      const timer=setTimeout(()=>{cleanup();try{window.TingduAndroid.cancelOnline(id);}catch{}reject(new Error('联网超时，请稍后重试。'));},65000);
      window.addEventListener('tingdu:native',receive);signal?.addEventListener('abort',abort,{once:true});
      if(signal?.aborted)return abort();
      try{const reply=JSON.parse(window.TingduAndroid.online(id,JSON.stringify(request)));if(reply.error){cleanup();reject(new Error(reply.error));}}catch{cleanup();reject(new Error('手机联网功能未能启动，请更新应用后重试。'));}
    });
  }else{
    const response=await fetch('/api/online',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
    if(!response.ok)throw new Error('本机联网服务不可用，请从听读应用或本机启动入口打开。');
    result=await response.json();
  }
  if(result.error)throw new Error(result.error);
  if(result.status!==200)throw new Error(httpError(result.status));
  return result.data;
}

export class AIClient {
  constructor(){
    this.config={...AI_DEFAULTS};this.verified=false;this.remember=false;this.readAloud=false;this.secureAvailable=false;this.revision=0;
    try{const prefs=JSON.parse(localStorage.getItem('tingdu:ai-preferences')||'{}');for(const key of ['baseUrl','model','voice'])if(typeof prefs[key]==='string')this.config[key]=prefs[key];this.readAloud=prefs.readAloud===true;}catch{}
  }
  async load(){
    let reply;
    if(window.tingduDesktop?.loadAIProfile)reply=await window.tingduDesktop.loadAIProfile();
    else if(window.TingduAndroid?.loadAIProfile)reply=JSON.parse(window.TingduAndroid.loadAIProfile());
    if(reply){this.secureAvailable=reply.available===true;if(reply.error)throw new Error(reply.error);if(reply.profile){this.config=validateAIConfig(reply.profile);this.remember=true;}}
  }
  savePublicPreferences(){
    const {baseUrl,model,voice}=this.config;
    try{localStorage.setItem('tingdu:ai-preferences',JSON.stringify({baseUrl,model,voice,readAloud:this.readAloud}));}catch{throw new Error('连接已在本次运行生效，但偏好未能保存。');}
  }
  async saveSecure(profile){
    if(window.tingduDesktop?.saveAIProfile)return window.tingduDesktop.saveAIProfile(profile);
    if(window.TingduAndroid?.saveAIProfile){const reply=JSON.parse(window.TingduAndroid.saveAIProfile(JSON.stringify(profile)));if(reply.error)throw new Error(reply.error);return reply;}
    if(profile)throw new Error('浏览器不保存 API 密钥，请保持“仅本次使用”。');
  }
  async configure(input,remember=false){
    const config=validateAIConfig(input);
    if(remember&&!this.secureAvailable)throw new Error('本机加密不可用，请选择仅本次使用。');
    await this.saveSecure(remember?config:null);
    this.revision++;this.config=config;this.verified=false;this.remember=remember;this.savePublicPreferences();
  }
  async forget(){await this.saveSecure(null);this.revision++;this.config.apiKey='';this.verified=false;this.remember=false;this.readAloud=false;this.savePublicPreferences();}
  async complete(operation,input={},options={}){
    if(operation==='test')this.verified=false;
    if(operation!=='test'&&!this.verified)throw new Error('请先在“AI 语音”中连接并测试语音能力。');
    const revision=this.revision, config={...this.config};
    const result=await onlineRequest({kind:'ai',config,body:buildAIMessage(config,operation,input)},options);
    if(options.signal?.aborted||revision!==this.revision)throw new DOMException('连接已改变','AbortError');
    if(operation==='lesson')return result;
    const audio=audioReply(result);
    if(operation==='test')this.verified=true;
    return audio;
  }
  async synthesize(text,language,accent,signal){return (await this.complete('speak',{text,language,accent},{signal})).bytes;}
}

// Convert the local recording to the WAV input accepted by audio-chat models.
export async function recordingWave(blob){
  if(!blob||blob.size>4*1024*1024)throw new Error('录音为空或过大，请重新录制。');
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)throw new Error('此设备暂不能转换录音，可先发送文字体验 AI 语音。');
  const context=new AudioContext();
  try{
    const audio=await context.decodeAudioData(await blob.arrayBuffer());
    if(audio.duration>31||audio.duration<.1)throw new Error('请录制 0.1 至 30 秒的语音。');
    const count=Math.ceil(audio.duration*16000), mono=new Float32Array(count);
    for(let channel=0;channel<audio.numberOfChannels;channel++){
      const input=audio.getChannelData(channel);
      for(let i=0;i<count;i++){const pos=i*audio.sampleRate/16000,at=Math.floor(pos),t=pos-at;mono[i]+=((input[at]||0)*(1-t)+(input[Math.min(at+1,input.length-1)]||0)*t)/audio.numberOfChannels;}
    }
    return bytesBase64(pcmWave(mono));
  }catch(error){if(error.name==='EncodingError')throw new Error('设备无法读取这段录音，请重录或发送文字。');throw error;}finally{await context.close();}
}
