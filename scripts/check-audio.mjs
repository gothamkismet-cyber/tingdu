const origin='http://127.0.0.1:4173';
const response=await fetch(`${origin}/api/voices`);
if(!response.ok)throw new Error('Local voice API failed');
const voices=await response.json();
const en=voices.find(voice=>voice.lang.toLowerCase().startsWith('en'));
if(en){
  const result=await fetch(`${origin}/api/speech`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'en',voice:en.name,text:'apple',rate:.85})});
  const bytes=Buffer.from(await result.arrayBuffer());
  if(!result.ok||bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WAVE')throw new Error('English synthesis did not produce WAV audio');
  console.log(`English WAV generated: ${bytes.length} bytes, voice: ${en.name}`);
}else console.log('No installed English native voice. Browser voices remain available where supported.');
const rejected=await fetch(`${origin}/api/speech`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'ja',voice:en?.name||'missing',text:'学校',rate:1})});
if(rejected.status!==422)throw new Error('Mismatched voice must be rejected');
const crossOrigin=await fetch(`${origin}/api/voices`,{headers:{Origin:'https://example.invalid'}});
if(crossOrigin.status!==403)throw new Error('External origins must be rejected');
console.log(`Native audio validation passed. Installed Japanese voices: ${voices.filter(voice=>voice.lang.toLowerCase().startsWith('ja')).length}`);
