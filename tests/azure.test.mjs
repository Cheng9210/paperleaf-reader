import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createAzureService} from '../scripts/azure-service.mjs';
const key='a'.repeat(32);
async function fixture(t,fetchImpl){const dir=await mkdtemp(path.join(os.tmpdir(),'paperleaf-azure-'));t.after(()=>rm(dir,{recursive:true,force:true}));return{dir,service:createAzureService({directory:dir,fetchImpl,pause:async()=>{}})};}
const reply=texts=>new Response(JSON.stringify(texts.map(()=>({translations:[{to:'zh-Hant',text:'注意力模型',alignment:{proj:'0:8-0:2 10:14-3:4'}}]}))),{status:200});
test('monthly guard rejects new requests but permits cached translations',async t=>{
 let calls=0;const {service,dir}=await fixture(t,async()=>{calls++;return reply(['Attention']);});
 await service.configure({key,region:'global',freeTierConfirmed:true});await service.translate({texts:['Attention']});
 await writeFile(path.join(dir,'usage.json'),JSON.stringify({month:new Date().toISOString().slice(0,7),characters:2000000}));
 assert.equal((await service.translate({texts:['Attention']})).cached,true);
 await assert.rejects(service.translate({texts:['New text']}),e=>e.status===403);assert.equal(calls,2);
});
test('server sends credentials only to the fixed Azure endpoint and caches identical text',async t=>{
 const calls=[];const {service,dir}=await fixture(t,async(url,init)=>{calls.push({url,init});return reply(JSON.parse(init.body));});
 await service.configure({key,region:'global',freeTierConfirmed:true});
 const first=await service.translate({texts:['Attention model']});const second=await service.translate({texts:['Attention model']});
 assert.equal(calls.length,2);assert.equal(second.cached,true);assert.equal(first.results[0].alignment,'0:8-0:2 10:14-3:4');
 const url=new URL(calls[1].url);assert.equal(url.origin,'https://api.cognitive.microsofttranslator.com');assert.equal(url.searchParams.get('to'),'zh-Hant');assert.equal(url.searchParams.get('includeAlignment'),'true');assert.equal(calls[1].init.headers['Ocp-Apim-Subscription-Key'],key);
 assert.ok(!JSON.stringify(await service.status()).includes(key));assert.equal(JSON.parse(await readFile(path.join(dir,'azure.json'),'utf8')).key,key);
});
test('configuration requires explicit F0 selection and never saves a rejected key',async t=>{
 const {service}=await fixture(t,async()=>new Response('{}',{status:401}));
 await assert.rejects(service.configure({key,region:'global',freeTierConfirmed:false}),/F0/);
 await assert.rejects(service.configure({key,region:'global',freeTierConfirmed:true}),/金鑰/);
 assert.equal((await service.status()).configured,false);
});
test('translation validates input before calling Azure and hides upstream secrets',async t=>{
 let calls=0;const {service}=await fixture(t,async()=>{calls++;return calls===1?reply(['Hello.']):new Response(JSON.stringify({error:{message:key}}),{status:403});});
 await service.configure({key,region:'eastasia',freeTierConfirmed:true});
 await assert.rejects(service.translate({texts:['x'.repeat(10001)]}),/字數/);assert.equal(calls,1);
 await assert.rejects(service.translate({texts:['Attention']}),e=>e.status===403&&!e.message.includes(key));
});
