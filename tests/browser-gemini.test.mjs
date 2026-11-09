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
