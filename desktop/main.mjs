import { app, BrowserWindow, Menu, protocol, ipcMain, dialog, session, nativeTheme } from 'electron';
import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeVoices, nativeSpeak } from '../web/native-speech.mjs';
import { LearningStore } from './store.mjs';

const directory=path.dirname(fileURLToPath(import.meta.url));
const pageRoot=path.resolve(directory,'../web/dist');
const appUrl='tingdu://app/index.html';
const diagnostic=process.argv.includes('--verify-startup');
const diagnosticOutput=process.argv.find(arg=>arg.startsWith('--diagnostic-output='))?.slice('--diagnostic-output='.length);
protocol.registerSchemesAsPrivileged([{scheme:'tingdu',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
app.setName('Tingdu');
app.setAppUserModelId('local.tingdu.learner');
app.setPath('userData',diagnostic&&diagnosticOutput?path.join(path.dirname(diagnosticOutput),'desktop-test-data'):path.join(app.getPath('appData'),'Tingdu'));
let mainWindow,store,allowQuit=false,closing=false,diagnosticTimer,closeTimer;
const isAppUrl=value=>{try{const url=new URL(value);return url.protocol==='tingdu:'&&url.hostname==='app';}catch{return false;}};
const trusted=event=>event.sender===mainWindow?.webContents&&event.senderFrame===event.sender.mainFrame&&isAppUrl(event.senderFrame?.url);
async function log(message){try{await mkdir(app.getPath('userData'),{recursive:true});await appendFile(path.join(app.getPath('userData'),'desktop.log'),`${new Date().toISOString()} ${message}\n`,'utf8');}catch{}}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const policy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
async function route(request){
  try{
    const url=new URL(request.url);
    if(!isAppUrl(request.url))return new Response('Not found',{status:404});
    if(url.pathname==='/api/voices'&&request.method==='GET')return Response.json(await nativeVoices(url.searchParams.get('refresh')==='1'));
    if(url.pathname==='/api/speech'&&request.method==='POST'){
      const raw=await request.text();if(Buffer.byteLength(raw)>4096)return new Response('Too large',{status:413});
      const audio=await nativeSpeak(JSON.parse(raw));return new Response(new Uint8Array(audio),{headers:{'Content-Type':'audio/wav'}});
    }
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});
    const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const file=path.resolve(pageRoot,`.${pathname}`);
    if(!file.startsWith(pageRoot+path.sep)||!mime[path.extname(file)])return new Response('Not found',{status:404});
    return new Response(new Uint8Array(await readFile(file)),{headers:{'Content-Type':mime[path.extname(file)],'Content-Security-Policy':policy,'X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Resource unavailable',{status:422});}
}
async function createWindow(){
  mainWindow=new BrowserWindow({width:1260,height:900,minWidth:760,minHeight:620,title:'听读 · 英日学习助手',backgroundColor:nativeTheme.shouldUseDarkColors?'#090d1c':'#f3f5fa',show:false,icon:path.join(directory,'assets/icon.png'),webPreferences:{preload:path.join(directory,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'听读',submenu:[{label:'声音与备份',click:()=>mainWindow.webContents.send('tingdu:show-settings')},{type:'separator'},{role:'quit',label:'退出'}]},
    {label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
    {label:'窗口',submenu:[{role:'resetZoom',label:'原始大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'togglefullscreen',label:'全屏'}]},
    {label:'帮助',submenu:[{label:'关于听读',click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'听读',message:`听读 ${app.getVersion()}`,detail:`英日单词与短句学习助手\n数据目录：${app.getPath('userData')}\n录音只留在当前题目，不自动评分。`})}]}
  ]));
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(!isAppUrl(url))event.preventDefault();});
  mainWindow.webContents.on('render-process-gone',(_,details)=>log('renderer-gone '+details.reason));
  mainWindow.webContents.on('did-fail-load',(_,code,description)=>log(`load-failed ${code} ${description}`));
  mainWindow.on('close',event=>{
    if(allowQuit)return;
    event.preventDefault();
    if(closing)return;closing=true;
    mainWindow.webContents.send('tingdu:prepare-close');
    closeTimer=setTimeout(()=>store.flush().catch(error=>log('flush-failed '+error.message)).finally(()=>{allowQuit=true;app.quit();}),3000);
  });
  // Show the window once its first frame (the opening animation) has painted, so launch never flashes an empty window.
  if(!diagnostic){mainWindow.once('ready-to-show',()=>mainWindow.show());setTimeout(()=>{if(!mainWindow.isDestroyed()&&!mainWindow.isVisible())mainWindow.show();},4000);}
  await mainWindow.loadURL(appUrl);await log('window-loaded '+app.getVersion());
}
const lock=diagnostic||app.requestSingleInstanceLock();
if(!lock)app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
  app.whenReady().then(async()=>{
    store=new LearningStore(app.getPath('userData'));protocol.handle('tingdu',route);
    let microphoneAllowed=false;
    session.defaultSession.setPermissionCheckHandler((contents,permission,origin,details)=>permission==='media'&&microphoneAllowed&&isAppUrl(origin)&&details?.mediaType!=='video');
    session.defaultSession.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
      if(contents!==mainWindow?.webContents||permission!=='media'||!isAppUrl(details.requestingUrl||contents.getURL())||!details.mediaTypes?.length||details.mediaTypes.some(type=>type!=='audio'))return callback(false);
      if(microphoneAllowed)return callback(true);
      const choice=await dialog.showMessageBox(mainWindow,{type:'question',title:'允许录音？',message:'允许听读使用麦克风吗？',detail:'只用于你点开的跟读录音，录音不上传，切题后释放。',buttons:['允许本次运行','暂不允许'],defaultId:1,cancelId:1});
      microphoneAllowed=choice.response===0;callback(microphoneAllowed);
    });
    ipcMain.handle('tingdu:load',event=>{if(!trusted(event))throw new Error('来源无效');return store.load();});
    ipcMain.handle('tingdu:save',(event,raw)=>{if(!trusted(event))throw new Error('来源无效');return store.save(raw);});
    ipcMain.handle('tingdu:info',event=>{if(!trusted(event))throw new Error('来源无效');return {version:app.getVersion(),dataDirectory:app.getPath('userData')};});
    ipcMain.on('tingdu:close-ready',async event=>{if(!trusted(event)||!closing)return;clearTimeout(closeTimer);try{await store.flush();await log('close-saved');}catch(error){await log('flush-failed '+error.message);}allowQuit=true;app.quit();});
    ipcMain.on('tingdu:ready',async(event,details)=>{
      if(!trusted(event))return;
      await log('renderer-ready '+JSON.stringify(details));
      if(diagnostic&&diagnosticOutput){
        try{
          await store.flush();const voices=await nativeVoices(),english=voices.find(voice=>voice.lang.toLowerCase().startsWith('en'));
          const wave=english?await nativeSpeak({language:'en',voice:english.name,text:'apple',rate:.85}):null;
          await mkdir(path.dirname(diagnosticOutput),{recursive:true});
          await writeFile(diagnosticOutput,JSON.stringify({version:app.getVersion(),electron:process.versions.electron,packaged:app.isPackaged,renderer:details,voices,nativeAudio:wave?{bytes:wave.length,wav:wave.subarray(0,4).toString()==='RIFF'}:null,data:(await store.load()).exists},null,2));
          clearTimeout(diagnosticTimer);mainWindow.close();
        }
        catch(error){await log('diagnostic-failed '+error.message);app.exit(1);}
      }
    });
    if(diagnostic)diagnosticTimer=setTimeout(()=>app.exit(2),20000);
    await createWindow();
  }).catch(async error=>{await log('startup-failed '+error.stack);if(!diagnostic)dialog.showErrorBox('听读未能打开',error.message);app.exit(1);});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',event=>{if(!allowQuit&&mainWindow&&!mainWindow.isDestroyed()){event.preventDefault();mainWindow.close();}});
}
