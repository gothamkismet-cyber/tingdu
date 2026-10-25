const { contextBridge, ipcRenderer }=require('electron');
contextBridge.exposeInMainWorld('tingduDesktop',{
  loadState:()=>ipcRenderer.invoke('tingdu:load'),
  saveState:raw=>ipcRenderer.invoke('tingdu:save',raw),
  loadAIProfile:()=>ipcRenderer.invoke('tingdu:ai-load'),
  saveAIProfile:profile=>ipcRenderer.invoke('tingdu:ai-save',profile),
  info:()=>ipcRenderer.invoke('tingdu:info'),
  ready:details=>ipcRenderer.send('tingdu:ready',details),
  onSettings:callback=>{ipcRenderer.on('tingdu:show-settings',()=>callback());},
  onCloseRequested:callback=>{ipcRenderer.on('tingdu:prepare-close',async()=>{try{await callback();}finally{ipcRenderer.send('tingdu:close-ready');}});}
});
