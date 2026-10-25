import { prepareOnlineRequest } from './dist/ai-protocol.js';

export async function requestOnline(input, {signal, fetcher=fetch}={}) {
  const request=prepareOnlineRequest(input);
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),request.timeout);
  const abort=()=>controller.abort(); signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted) controller.abort();
  try {
    const response=await fetcher(request.url,{method:request.method,headers:request.headers,body:request.body,redirect:'manual',signal:controller.signal});
    // Never forward a credential to a redirected destination, nor echo provider error bodies.
    if (!response.ok) { await response.body?.cancel(); return {status:response.status}; }
    const reader=response.body.getReader(); const chunks=[]; let size=0;
    while(true){ const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>request.limit){await reader.cancel();throw new Error('接口回复过大，已停止接收。');} chunks.push(value); }
    let data; try { data=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('接口返回的不是有效 JSON，请检查根地址与兼容协议。'); }
    return {status:200,data};
  } catch(error) {
    if(controller.signal.aborted) throw new Error(signal?.aborted?'已取消联网请求。':'联网超时，请检查服务地址和网络后重试。');
    if(error instanceof TypeError) throw new Error('无法连接服务，请检查网络和接口地址。');
    if(['接口回复过大，已停止接收。','接口返回的不是有效 JSON，请检查根地址与兼容协议。'].includes(error.message))throw error;
    throw new Error('联网请求未完成，请检查服务设置后重试。');
  } finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
