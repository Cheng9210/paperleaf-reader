import test from 'node:test';import assert from 'node:assert/strict';
import {extractPageBlocks,alignedRanges} from '../dist/lib/pdf-text.js';
const item=(str,x,y,eol=true)=>({str,transform:[12,0,0,12,x,y],width:str.length*6,height:12,hasEOL:eol});
test('selected phrase can span adjacent PDF text items',()=>{
 const block={text:'New York',translated:'紐約',alignment:'0:7-0:1',spans:[{itemIndex:0,start:0,end:3},{itemIndex:1,start:4,end:8}]};
 assert.deepEqual(alignedRanges(block,[{itemIndex:0,start:0,end:3},{itemIndex:1,start:0,end:4}]),[{start:0,end:2}]);
 assert.deepEqual(alignedRanges(block,[{itemIndex:0,start:1,end:3},{itemIndex:1,start:0,end:4}]),[]);
});
test('joins prose across PDF lines and retains offsets for repeated words',()=>{
 const blocks=extractPageBlocks({items:[item('Attention helps.',50,700),item('Attention models learn.',50,685)]});
 assert.equal(blocks.length,1);assert.equal(blocks[0].text,'Attention helps. Attention models learn.');assert.equal(blocks[0].spans[1].start,17);
 const translated={...blocks[0],translated:'注意力有幫助。注意力模型會學習。',alignment:'0:8-0:2 17:25-7:9 27:32-10:11'};
 assert.deepEqual(alignedRanges(translated,[{itemIndex:1,start:0,end:9}]),[{start:7,end:10}]);
});
test('does not highlight an entire phrase when only part of a source word was selected',()=>{
 const block={text:'Attention',translated:'注意力',spans:[{itemIndex:0,start:0,end:9}],alignment:'0:8-0:2'};
 assert.deepEqual(alignedRanges(block,[{itemIndex:0,start:0,end:4}]),[]);
 assert.deepEqual(alignedRanges({...block,alignment:''},[{itemIndex:0,start:0,end:9}]),[]);
 assert.deepEqual(alignedRanges({...block,alignment:'0:8-0:999'},[{itemIndex:0,start:0,end:9}]),[]);
});
test('separates headings and column changes instead of joining unrelated text',()=>{
 const blocks=extractPageBlocks({items:[item('Left column.',40,700),item('Right column.',320,700),item('Another paragraph.',320,600)]});
 assert.equal(blocks.length,3);assert.deepEqual(blocks.map(b=>b.text),['Left column.','Right column.','Another paragraph.']);
});
