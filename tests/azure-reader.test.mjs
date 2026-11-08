import test from 'node:test';import assert from 'node:assert/strict';
import {AzureReader} from '../dist/lib/azure-reader.js';
test('pause and immediate resume reuse the in-flight worker',async()=>{
 const original=globalThis.fetch;let release,calls=0;
 globalThis.fetch=async()=>{calls++;await new Promise(r=>release=r);return new Response(JSON.stringify({results:[{translated:'注意力',alignment:'0:8-0:2'}]}));};
 try{
  const reader=Object.assign(Object.create(AzureReader.prototype),{generation:1,doc:{numPages:1},page:1,status:{configured:true},records:new Map([[1,{blocks:[{text:'Attention'}],done:false}]]),controls(){},showPage(){}});
  const work=reader.start();await Promise.resolve();reader.pause();await reader.start();assert.equal(calls,1);release();await work;
  assert.equal(reader.records.get(1).done,true);assert.equal(reader.running,false);assert.equal(reader.workerGeneration,null);
 }finally{globalThis.fetch=original;}
});
