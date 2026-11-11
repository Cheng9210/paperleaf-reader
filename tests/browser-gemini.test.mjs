import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserGemini} from '../dist/lib/browser-gemini.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const success=inputs=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(({id,text})=>({id,translated:text==='Hello.'?'你好。':'設計靈感。',pairs:[]}))})}]}}]}));

test('static Gemini saves a validated key only in the current browser and translates sentences',async()=>{
 const storage=memory(),calls=[];
 const client=createBrowserGemini({storage,fetchImpl:async(url,init)=>{calls.push({url,init});return success(JSON.parse(JSON.parse(init.body).contents[0].parts[0].text));},pause:async()=>{}});
 assert.equal((await client.status()).configured,false);
 assert.equal((await client.configure({key:'a'.repeat(39),freeTierConfirmed:true})).configured,true);
 assert.equal((await client.translate({texts:['Design inspiration.']})).results[0].translated,'設計靈感。');
 assert.equal(calls[1].init.headers['x-goog-api-key'],'a'.repeat(39));
 assert.equal((await createBrowserGemini({storage}).status()).configured,true);
 assert.ok(!JSON.stringify(await client.status()).includes('a'.repeat(39)));
});

test('static Gemini rejects unverified keys and incomplete model output',async()=>{
 const storage=memory(),client=createBrowserGemini({storage,fetchImpl:async()=>new Response('{}',{status:429}),pause:async()=>{}});
 await assert.rejects(client.configure({key:'a'.repeat(39),freeTierConfirmed:false}));
 await assert.rejects(client.configure({key:'a'.repeat(39),freeTierConfirmed:true}),/額度/);
 assert.equal((await client.status()).configured,false);
});

test('successive static requests have a short pacing delay',async()=>{
 const waits=[],storage=memory(),client=createBrowserGemini({storage,pause:async ms=>waits.push(ms),fetchImpl:async(url,init)=>success(JSON.parse(JSON.parse(init.body).contents[0].parts[0].text))});
 await client.configure({key:'a'.repeat(39),freeTierConfirmed:true});
 await client.translate({texts:['Design inspiration.']});
 assert.ok(waits[1]>0&&waits[1]<=6000,`unexpected delay ${waits[1]}ms`);
});

test('an incomplete Gemini reply is retried as smaller sentence groups',async()=>{
 const calls=[],client=createBrowserGemini({storage:{getItem:()=> 'a'.repeat(39)},pause:async()=>{},fetchImpl:async(url,init)=>{
  const inputs=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);calls.push(inputs.length);
  if(inputs.length>2)return new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[]}}]}));
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(({id})=>({id,translated:'譯文。',pairs:[]}))})}]}}]}));
 }});
 const first=await client.translate({texts:['One. Two. Three. Four.']});
 assert.equal(first.results[0].translated,'譯文。'.repeat(4));assert.deepEqual(calls,[4,2,2]);
});

test('malformed word pairs do not discard an otherwise valid translation',async()=>{
 const client=createBrowserGemini({storage:{getItem:()=> 'a'.repeat(39)},pause:async()=>{},fetchImpl:async()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:[{id:0,translated:'第一。',pairs:[null,{}, {source:'One',sourceOccurrence:0,target:'第一',targetOccurrence:0}]}]})}]}}]}))});
 const result=await client.translate({texts:['One.']});assert.equal(result.results[0].translated,'第一。');assert.equal(result.results[0].alignment,'0:2-0:1');
});

test('a temporary quota limit waits once, slows later requests, and resumes',async()=>{
 let calls=0;const waits=[],client=createBrowserGemini({storage:{getItem:()=> 'a'.repeat(39)},pause:async ms=>waits.push(ms),fetchImpl:async(url,init)=>{
  if(++calls===1)return new Response('{}',{status:429,headers:{'Retry-After':'2'}});
  return success(JSON.parse(JSON.parse(init.body).contents[0].parts[0].text));
 }});
 assert.equal((await client.translate({texts:['Design inspiration.']})).results[0].translated,'設計靈感。');
 assert.equal(calls,2);assert.ok(waits.some(ms=>ms>=12000));
 await client.translate({texts:['Another idea.']});
 assert.ok(waits.some(ms=>ms>6000),`pacing did not adapt: ${waits}`);
});

test('changing the API key always checks the new key instead of a cached response',async()=>{
 const storage=memory();let calls=0;const client=createBrowserGemini({storage,pause:async()=>{},fetchImpl:async(url,init)=>++calls===1?success(JSON.parse(JSON.parse(init.body).contents[0].parts[0].text)):new Response('{}',{status:401})});
 await client.configure({key:'a'.repeat(39),freeTierConfirmed:true});
 await assert.rejects(client.configure({key:'b'.repeat(39),freeTierConfirmed:true}),/無效/);
 assert.equal(calls,2);assert.equal((await client.status()).configured,true);
});

test('English-only output is retried automatically with a stronger translation instruction',async()=>{
 let calls=0;const client=createBrowserGemini({storage:{getItem:()=> 'a'.repeat(39)},pause:async()=>{},fetchImpl:async(url,init)=>{
  const inputs=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);calls++;
  if(calls===2)assert.match(JSON.parse(init.body).systemInstruction.parts[0].text,/previous response/i);
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(({id,text})=>({id,translated:calls===1?text:'這篇論文描述設計靈感來源。',pairs:[]}))})}]}}]}));
 }});
 const input={texts:['This paper describes the sources of inspiration in design.']};
 assert.equal((await client.translate(input)).results[0].translated,'這篇論文描述設計靈感來源。');assert.equal(calls,2);
});

test('persistent English-only output stops after one focused retry',async()=>{
 let calls=0;const client=createBrowserGemini({storage:{getItem:()=> 'a'.repeat(39)},pause:async()=>{},fetchImpl:async(url,init)=>{
  calls++;const inputs=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(({id,text})=>({id,translated:text,pairs:[]}))})}]}}]}));
 }});
 await assert.rejects(client.translate({texts:['This paper describes the sources of inspiration in design.']}),/未翻譯/);assert.equal(calls,2);
});

test('focused retry preserves other translated paragraphs in the batch',async()=>{
 const calls=[],client=createBrowserGemini({storage:{getItem:()=> 'a'.repeat(39)},pause:async()=>{},fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body),inputs=JSON.parse(body.contents[0].parts[0].text);calls.push(inputs.map(item=>item.text));
  const strict=/previous response/i.test(body.systemInstruction.parts[0].text);
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:inputs.map(({id,text})=>({id,translated:text.startsWith('This paper')?(strict?'這篇論文討論設計靈感。':text):'蓮花自行車的設計。',pairs:[]}))})}]}}]}));
 }});
 const texts=['This paper describes the sources of inspiration in design.','The Lotus bicycle design.'];
 assert.deepEqual((await client.translate({texts})).results.map(item=>item.translated),['這篇論文討論設計靈感。','蓮花自行車的設計。']);
 assert.deepEqual(calls,[texts,[texts[0]]]);
});
