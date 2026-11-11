import test from 'node:test';
import assert from 'node:assert/strict';
import * as PDFLib from 'pdf-lib';
import {exportTranslatedPdf,paintTranslatedBlock} from '../dist/lib/translated-export.js';

const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl1+uUAAAAASUVORK5CYII=';

test('translated export requires every page and block to be complete',async()=>{
 const doc={numPages:1};
 await assert.rejects(exportTranslatedPdf(doc,new Map(),{PDFLib,renderPage:async()=>({image:pixel,width:1,height:1,overflow:[]})}),/尚未完成/);
 await assert.rejects(exportTranslatedPdf(doc,new Map([[1,{done:true,blocks:[{text:'Text'}]}]]),{PDFLib,renderPage:async()=>({image:pixel,width:1,height:1,overflow:[]})}),/尚未完成/);
});

test('translated export preserves page count and dimensions',async()=>{
 const doc={numPages:2,getPage:async()=>({})};const records=new Map([[1,{done:true,blocks:[{text:'One',translated:'一'}]}],[2,{done:true,blocks:[{text:'Two',translated:'二'}]}]]);
 const result=await exportTranslatedPdf(doc,records,{PDFLib,renderPage:async()=>({image:pixel,width:600,height:800,overflow:[]})});
 const output=await PDFLib.PDFDocument.load(result.bytes);
 assert.equal(output.getPageCount(),2);assert.equal(output.getPage(0).getWidth(),600);assert.equal(result.overflowCount,0);
});

test('translated block text is clipped to its assigned rectangle',()=>{
 const steps=[],ctx={fillStyle:'',save(){steps.push('save');},restore(){steps.push('restore');},beginPath(){steps.push('begin');},rect(...args){steps.push(['rect',...args]);},clip(){steps.push('clip');},fillRect(...args){steps.push(['fillRect',...args]);}};
 const element={getBoundingClientRect:()=>({left:20,top:30,width:60,height:40})};
 paintTranslatedBlock(ctx,element,{left:10,top:15},()=>{steps.push('text');assert.ok(steps.includes('clip'));assert.ok(!steps.includes('restore'));});
 assert.deepEqual(steps,['save','begin',['rect',10,15,60,40],'clip',['fillRect',10,15,60,40],'text','restore']);
});
