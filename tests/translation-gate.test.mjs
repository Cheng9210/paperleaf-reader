import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AzureReader} from '../dist/lib/azure-reader.js';

test('new papers keep Chinese hidden until all pages are translated',async()=>{
 const original=globalThis.document,root={hidden:false,replaceChildren(){this.cleared=true;},classList:{remove(){},add(){}}},pending={hidden:true};
 globalThis.document={querySelector:selector=>selector==='#translation-content'?root:selector==='#translation-pending'?pending:null};
 try{const reader=Object.assign(Object.create(AzureReader.prototype),{doc:{numPages:2},records:new Map(),demo:false,revealed:false,generation:1,controls(){},preparePage(){throw Error('page rendered before translation finished');}});
  await reader.showPage(1);assert.equal(root.hidden,true);assert.equal(pending.hidden,false);assert.equal(root.cleared,true);
 }finally{globalThis.document=original;}
});

test('the upload flow starts translation and offers a full-paper progress bar',async()=>{
 const app=await readFile('dist/app.js','utf8'),html=await readFile('dist/index.html','utf8');
 assert.match(app,/translator\.start\(\)/);assert.match(html,/id="translation-pending"/);assert.match(html,/id="translation-progress-bar"/);
});

test('a fully restored paper reveals Chinese and completes the progress bar',()=>{
 const original=globalThis.document,elements=new Map();globalThis.document={querySelector:selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector);}};
 try{const reader=Object.assign(Object.create(AzureReader.prototype),{doc:{numPages:2},records:new Map([[1,{done:true,blocks:[]}],[2,{done:true,blocks:[]}]]),demo:false,running:false,status:{configured:true}});reader.controls();
  assert.equal(reader.revealed,true);assert.equal(elements.get('#translation-pending').hidden,true);assert.equal(elements.get('#translation-pending-bar').value,2);assert.equal(elements.get('#translation-pending-bar').max,2);
 }finally{globalThis.document=original;}
});

test('the public entrypoint loads versioned translation modules after deployment',async()=>{
 const html=await readFile('dist/index.html','utf8'),app=await readFile('dist/app.js','utf8'),reader=await readFile('dist/lib/azure-reader.js','utf8');
 assert.match(html,/app\.js\?v=/);assert.match(html,/theme\.css\?v=/);assert.match(app,/azure-reader\.js\?v=/);assert.match(reader,/browser-gemini\.js\?v=/);assert.match(reader,/translation-layout\.js\?v=/);
});
