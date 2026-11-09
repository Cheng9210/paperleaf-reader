import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createGeminiService,projectAlignment} from '../scripts/gemini-service.mjs';
test('sentence translations preserve paragraph context and exact fallback offsets',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const service=createGeminiService({directory:dir,pause:async()=>{},fetchImpl:async(url,init)=>{
  const inputs=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(x=>({id:x.id,translated:x.text==='It works.'?'它有效。':'這需要時間。',pairs:[]}))})}]}}]}));
 }});
 await service.configure({key:'a'.repeat(39),freeTierConfirmed:true});
 const {results}=await service.translate({texts:['It works. It takes time.']});
 assert.equal(results[0].translated,'它有效。這需要時間。');
 assert.deepEqual(results[0].sentences,[{start:0,end:9,targetStart:0,targetEnd:4},{start:10,end:24,targetStart:4,targetEnd:10}]);
});
test('local Gemini uses the same short pacing delay',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));const waits=[];
 const service=createGeminiService({directory:dir,pause:async ms=>waits.push(ms),fetchImpl:async(url,init)=>{
  const inputs=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(({id})=>({id,translated:'設計靈感。',pairs:[]}))})}]}}]}));
 }});
 await service.configure({key:'a'.repeat(39),freeTierConfirmed:true});await service.translate({texts:['Design inspiration.']});
 assert.ok(waits[1]>0&&waits[1]<=6000,`unexpected delay ${waits[1]}ms`);
});
test('configuration uses the supported Flash-Lite endpoint without legacy thinking budget',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));let request;
 const service=createGeminiService({directory:dir,pause:async()=>{},fetchImpl:async(url,init)=>{request={url,body:JSON.parse(init.body)};return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:[{id:0,translated:'你好。',pairs:[]}]})}]}}]}));}});
 const status=await service.configure({key:'a'.repeat(39),freeTierConfirmed:true});
 assert.equal(status.model,'gemini-3.1-flash-lite');
 assert.equal(new URL(request.url).pathname,'/v1beta/models/gemini-3.1-flash-lite:generateContent');
 assert.equal(request.body.generationConfig.thinkingConfig?.thinkingBudget,undefined);
});
test('auth keys containing a dot reach Gemini unchanged; embedded whitespace is rejected',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));let calls=0;
 const key='AQ.'+'synthetic_test-key'.repeat(3);
 const service=createGeminiService({directory:dir,pause:async()=>{},fetchImpl:async(url,init)=>{calls++;assert.equal(init.headers['x-goog-api-key'],key);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:[{id:0,translated:'你好。',pairs:[]}]})}]}}]}));}});
 assert.equal((await service.configure({key,freeTierConfirmed:true})).configured,true);
 for(const separator of [' ','\n','\r\n'])await assert.rejects(service.configure({key:key+separator+'extra',freeTierConfirmed:true}),e=>e.status===400);
 assert.equal(calls,1);
});
test('completed subbatches survive a later quota failure',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));let calls=0;
 const service=createGeminiService({directory:dir,pause:async()=>{},fetchImpl:async(url,init)=>{calls++;if(calls===3)return new Response('{}',{status:429});const inputs=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(x=>({id:x.id,translated:'譯文',pairs:[]}))})}]}}]}));}});
 await service.configure({key:'a'.repeat(39),freeTierConfirmed:true});const request={texts:['a'.repeat(3000),'b'.repeat(3000)]};await assert.rejects(service.translate(request),e=>e.status===429);const result=await service.translate(request);assert.equal(result.results.length,2);assert.equal(calls,4);
});
test('truncated model output is rejected rather than cached as a translation',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const service=createGeminiService({directory:dir,pause:async()=>{},fetchImpl:async()=>new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]}))});
 await assert.rejects(service.configure({key:'a'.repeat(39),freeTierConfirmed:true}),e=>e.status===502);assert.equal((await service.status()).configured,false);
});
test('alignment uses exact occurrences and rejects invented substrings',()=>{
 assert.equal(projectAlignment('Attention and attention','注意力與注意力',[{source:'attention',sourceOccurrence:0,target:'注意力',targetOccurrence:1}]),'14:22-4:6');
 assert.equal(projectAlignment('cat','貓',[{source:'dog',sourceOccurrence:0,target:'貓',targetOccurrence:0}]),'');
});
test('Gemini keeps credentials server-side and caches validated results',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));let calls=0;
 const service=createGeminiService({directory:dir,pause:async()=>{},fetchImpl:async(url,init)=>{calls++;assert.equal(new URL(url).origin,'https://generativelanguage.googleapis.com');assert.equal(init.headers['x-goog-api-key'],'a'.repeat(39));const source=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:source.map(x=>({id:x.id,translated:'注意力',pairs:[{source:x.text,sourceOccurrence:0,target:'注意力',targetOccurrence:0}]}))})}]}}]}));}});
 await service.configure({key:'a'.repeat(39),freeTierConfirmed:true});const one=await service.translate({texts:['Attention']});assert.equal(one.results[0].alignment,'0:8-0:2');assert.equal((await service.translate({texts:['Attention']})).cached,true);assert.equal(calls,2);assert.ok(!JSON.stringify(await service.status()).includes('a'.repeat(39)));
});
test('quota error is sanitized and rejected credentials are not saved',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const service=createGeminiService({directory:dir,pause:async()=>{},fetchImpl:async()=>new Response('secret',{status:429})});
 await assert.rejects(service.configure({key:'a'.repeat(39),freeTierConfirmed:true}),e=>e.status===429&&!e.message.includes('secret'));assert.equal((await service.status()).configured,false);
});

test('English-only prose is rejected and not cached',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-gemini-'));t.after(()=>rm(dir,{recursive:true,force:true}));let calls=0;
 const service=createGeminiService({directory:dir,pause:async()=>{},fetchImpl:async(url,init)=>{calls++;const inputs=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(x=>({id:x.id,translated:x.text==='Hello.'?'你好。':x.text,pairs:[]}))})}]}}]}));}});
 await service.configure({key:'a'.repeat(39),freeTierConfirmed:true});
 const input={texts:['This paper describes the sources of inspiration in design.']};
 await assert.rejects(service.translate(input),e=>e.status===502);
 await assert.rejects(service.translate(input),e=>e.status===502);assert.equal(calls,3);
});
