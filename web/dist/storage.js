import { STORAGE_KEY, freshState, validateState } from './core.js';

export async function loadLearningState(local, desktop) {
  const result={state:freshState(),corruptRaw:null,storageProblem:'',desktopInfo:null,desktopReadProblem:false};
  let raw=null,pending=false;
  try{const cache=typeof local==='function'?local():local;raw=cache.getItem(STORAGE_KEY);pending=!!cache.getItem('tingdu:desktop-pending');}
  catch{result.storageProblem='桌面或浏览器缓存暂时无法读取，请先导出学习备份。';}
  if(desktop){
    try{const saved=await desktop.loadState();if(saved.exists&&!pending)raw=saved.raw;}
    catch{result.desktopReadProblem=true;result.storageProblem='本机学习文件暂时无法读取，当前只使用桌面缓存，不覆盖原文件；请导出备份后检查保存位置。';}
    try{result.desktopInfo=await desktop.info();}catch{}
  }
  if(raw){
    try{result.state=validateState(JSON.parse(raw));}
    catch{result.corruptRaw=raw;result.storageProblem='原学习记录无法读取，已保留原记录。当前练习暂不保存，请导出原记录或恢复完整备份。';}
  }
  return result;
}
