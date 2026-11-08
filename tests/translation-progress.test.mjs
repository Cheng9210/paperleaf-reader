import test from 'node:test';
import assert from 'node:assert/strict';
import {AzureReader} from '../dist/lib/azure-reader.js';
function reader(extra={}){return Object.assign(Object.create(AzureReader.prototype),{generation:1,doc:{numPages:2},page:2,key:'paper',status:{configured:true},records:new Map([[1,{blocks:[{text:'First'}],done:false}],[2,{blocks:[{text:'Second'}],done:false}]]),controls(){},showPage(){},...extra});}
test('whole-paper run proceeds in page order and saves each finished batch',async()=>{
 const original=globalThis.fetch, sent=[],saved=[];
 globalThis.fetch=async(url,options)=>{sent.push(JSON.parse(options.body).texts[0]);return new Response(JSON.stringify({results:[{translated:'譯文'}]}));};
 try{const r=reader({store:{async save(key,records){saved.push(structuredClone([...records]));return true;}}});await r.start();assert.deepEqual(sent,['First','Second']);assert.equal(saved.length,2);assert.equal(saved[0][0][1].blocks[0].translated,'譯文');}finally{globalThis.fetch=original;}
});
test('start waits for restored progress and does not repeat completed pages',async()=>{
 let release;const restoration=new Promise(r=>release=r);const r=reader({restoration});const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error('should not run');};
 try{const work=r.start();await Promise.resolve();assert.equal(requests,0);r.records.forEach(x=>x.done=true);release();await work;assert.equal(requests,0);}finally{globalThis.fetch=original;}
});
test('stale document extraction never inserts its page in a new document',async()=>{
 let release;const r=reader({records:new Map(),doc:{getPage:()=>new Promise(resolve=>release=resolve)}});assert.equal(typeof r.preparePage,'function');const pending=r.preparePage(1);r.generation++;r.records=new Map();release({getTextContent:async()=>({items:[]}),getViewport:()=>({width:100,height:200})});await pending;assert.equal(r.records.size,0);
});
import {TranslationStore} from '../dist/lib/translation-store.js';
test('unavailable browser storage retains independent document snapshots for the session',async()=>{
 const store=new TranslationStore(null),records=new Map([[1,{blocks:[{text:'Source',translated:'譯文'}],done:true,pageProxy:{uncloneable(){}}}]]);
 assert.equal(await store.save('a',records),false);records.get(1).blocks[0].translated='changed';
 assert.equal((await store.load('a')).get(1).blocks[0].translated,'譯文');assert.equal((await store.load('b')).size,0);
});
test('opening another document ignores an older restoration that finishes last',async()=>{
 const originalDocument=globalThis.document;globalThis.document={querySelector:()=>({})};let release;
 const r=reader({store:{persistent:true,load:key=>key==='old'?new Promise(resolve=>release=resolve):Promise.resolve(new Map([[2,{blocks:[],done:true}]]))}});
 try{const first=r.open({numPages:2},'old',false);await r.open({numPages:2},'new',false);release(new Map([[1,{blocks:[],done:true}]]));await first;assert.equal(r.key,'new');assert.deepEqual([...r.records.keys()],[2]);}finally{globalThis.document=originalDocument;}
});
test('a failed later API batch retains earlier progress and stops the worker',async()=>{
 const original=globalThis.fetch;let calls=0;const snapshots=[];
 const r=reader({doc:{numPages:1},page:1,records:new Map([[1,{blocks:[{text:'a'.repeat(3000)},{text:'b'.repeat(3000)}],done:false}]]),store:{async save(key,records){snapshots.push(structuredClone([...records]));return true;}}});
 globalThis.fetch=async()=>++calls===1?new Response(JSON.stringify({results:[{translated:'第一段'}]})):new Response(JSON.stringify({error:'今日額度已用完'}),{status:429});
 try{await r.start();assert.equal(r.running,false);assert.equal(r.records.get(1).done,false);assert.equal(snapshots.length,1);assert.equal(snapshots[0][0][1].blocks[0].translated,'第一段');assert.match(r.error,/額度/);}finally{globalThis.fetch=original;}
});
