import test from 'node:test';import assert from 'node:assert/strict';
import {fetchWithRetry} from '../scripts/gemini-retry.mjs';
import {translationPlaceholder} from '../dist/lib/translation-layout.js';
test('503 recovers with bounded delayed retries',async()=>{
 let calls=0;const delays=[];
 const response=await fetchWithRetry(async()=>new Response('{}',{status:++calls<3?503:200}),async ms=>delays.push(ms));
 assert.equal(response.status,200);assert.equal(calls,3);assert.deepEqual(delays,[15000,30000]);
});
test('persistent outage stops after three attempts; quota and credentials never retry',async()=>{
 for(const status of [503,429,401,400]){let calls=0;const result=await fetchWithRetry(async()=>{calls++;return new Response('{}',{status});},async()=>{});assert.equal(result.status,status);assert.equal(calls,status===503?3:1);}
});
test('network retries are bounded',async()=>{
 let calls=0;await assert.rejects(fetchWithRetry(async()=>{calls++;throw Error('network');},async()=>{}));assert.equal(calls,3);
});
test('failed and paused translations never claim to be translating',()=>{
 assert.equal(translationPlaceholder({running:true,error:'503'}),'尚未翻譯');
 assert.equal(translationPlaceholder({running:false}),'尚未翻譯（已暫停）');
 assert.equal(translationPlaceholder({running:true}),'等待翻譯…');
});
