export function registerLearningTools(actions) {
  if(!document.modelContext?.registerTool)return;
  const lifecycle=new AbortController();
  const tools=[
    { name:'get_learning_summary', title:'查看学习记录', description:'Read English or Japanese practice counts and book choices. Does not submit answers.', inputSchema:{type:'object',properties:{language:{type:'string',enum:['en','ja']}},additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){return actions.read(input);} },
    { name:'start_practice', title:'开始一组练习', description:'Start a visible practice session using an existing word book. Refuses to replace an unfinished session. Does not answer or grade exercises.', inputSchema:{type:'object',properties:{language:{type:'string',enum:['en','ja']},mode:{type:'string',enum:['dictation','meaning','recall','reading','shadow']},book:{type:'string'},form:{type:'string',enum:['written','reading']},limit:{type:'integer',enum:[5,10,20,30,50,100]}},required:['language','mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){return actions.start(input);} }
  ];
  for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
