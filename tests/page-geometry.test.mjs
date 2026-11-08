import test from 'node:test';import assert from 'node:assert/strict';
import {extractPageBlocks} from '../dist/lib/pdf-text.js';
import {pageBlockRect} from '../dist/lib/page-geometry.js';
test('drop cap joins its body text without promoting the paragraph to a title',()=>{
 const items=[{str:'T',width:25,height:48,transform:[48,0,0,48,40,670]},{str:'he Enterprise encounters a star.',width:220,height:12,transform:[12,0,0,12,65,700]},{str:'A new paragraph.',width:220,height:12,transform:[12,0,0,12,40,640]}];
 const blocks=extractPageBlocks({items});assert.equal(blocks[0].text,'The Enterprise encounters a star.');assert.equal(blocks[0].kind,'paragraph');assert.equal(blocks[0].fontSize,12);assert.equal(blocks[0].spans[1].start,1);
});
test('PDF coordinates retain text geometry relative to the original page',()=>{
 const viewport={width:600,height:800,convertToViewportRectangle:([x,y,r,t])=>[x,800-y,r,800-t]};
 assert.deepEqual(pageBlockRect({x:40,y:700,right:260,bottom:660,fontSize:12},viewport),{x:40,y:88,width:220,height:52});
});

import {readingBlockRects} from '../dist/lib/page-geometry.js';
test('heading expands to its text column and never overlaps following prose',()=>{
 const viewport={width:600,height:800,convertToViewportRectangle:([x,y,r,t])=>[x,800-y,r,800-t]};
 const blocks=[{kind:'heading',x:180,y:400,right:320,bottom:370,fontSize:18},{kind:'paragraph',x:180,y:380,right:520,bottom:200,fontSize:12}];
 const [heading,body]=readingBlockRects(blocks,viewport);
 assert.equal(heading.width,body.width);assert.ok(heading.y+heading.height<=body.y-2);
});

import {sourceTextRect} from '../dist/lib/page-geometry.js';
test('PDF text mask covers the glyph area with padding',()=>{
 const viewport={scale:2,convertToViewportPoint:(x,y)=>[x*2,1600-y*2]};
 const r=sourceTextRect({str:'reference',width:80,height:10,transform:[10,0,0,10,40,500]},viewport);
 assert.ok(r.x<80&&r.y<580);assert.ok(r.width>160&&r.height>20);
});
