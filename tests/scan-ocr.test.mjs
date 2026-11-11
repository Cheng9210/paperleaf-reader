import test from 'node:test';
import assert from 'node:assert/strict';
import {ocrBlocksFromResponse,shouldOcrPage} from '../dist/lib/scan-ocr.js';
import {recognizeScan} from '../dist/lib/gemini-ocr.js';

test('OCR boxes become positioned PDF blocks and discard malformed rows',()=>{
 const blocks=ocrBlocksFromResponse({blocks:[
  {text:'Creative design',box:[100,100,700,150],kind:'heading'},
  {text:'A body paragraph.',box:[100,170,700,250],kind:'paragraph'},
  {text:'wrong',box:[200,200,100,300],kind:'paragraph'}
 ]},600,800);
 assert.equal(blocks.length,2);
 assert.equal(blocks[0].kind,'heading');assert.equal(blocks[0].x,60);assert.equal(blocks[0].right,420);
 assert.equal(blocks[0].bottom,680);assert.equal(blocks[1].text,'A body paragraph.');
});

test('scan request sends only a consented page image and validates the OCR reply',async()=>{
 let sent;const result=await recognizeScan({image:'YWJj',key:'test-key',model:'test-model',fetchImpl:async(url,options)=>{sent={url,options};return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({blocks:[{text:'Title',box:[1,2,3,4],kind:'heading'}]})}]}}]}),{status:200});}});
 assert.match(sent.url,/test-model:generateContent$/);assert.equal(sent.options.headers['x-goog-api-key'],'test-key');
 const body=JSON.parse(sent.options.body);assert.equal(body.contents[0].parts[1].inlineData.data,'YWJj');assert.equal(result.blocks[0].text,'Title');
 await assert.rejects(recognizeScan({image:'bad data',key:'key',model:'test',fetchImpl:()=>{throw Error('network request should not happen');}}),/格式錯誤/);
});

test('a page number or sparse partial text layer still needs page OCR',()=>{
 const viewport={width:468,height:670};
 assert.equal(shouldOcrPage([{text:'71',y:24,bottom:18}],viewport),true);
 assert.equal(shouldOcrPage([{text:'Creative design of the Lotus bicycle',y:610,bottom:590},{text:'A short caption.',y:180,bottom:165}],viewport),true);
 assert.equal(shouldOcrPage([{text:'This paragraph has substantial extractable text. '.repeat(9),y:610,bottom:400},{text:'Another paragraph lower on the page. '.repeat(8),y:300,bottom:80}],viewport),false);
});
