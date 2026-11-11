import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPageBlocks,selectionMatch} from '../dist/lib/pdf-text.js';
import {sentenceUnits,joinSentenceTranslations} from '../dist/lib/sentences.js';
import {translatedBlockTag} from '../dist/lib/translation-layout.js';
const item=(str,x,y,width=220,height=12)=>({str,width,height,transform:[height,0,0,height,x,y]});
test('keeps a spanning title, two columns, and paragraph breaks',()=>{
 const blocks=extractPageBlocks({items:[item('Paper title',40,760,500,22),item('Left first line.',40,700),item('Continued line.',40,685),item('New paragraph.',55,655,205),item('Right column.',320,700),item('Next line.',320,685)]});
 assert.equal(blocks.length,4);
 assert.equal(blocks[0].kind,'heading');assert.equal(blocks[0].column,'full');
 assert.equal(blocks[1].column,'left');assert.equal(blocks[3].column,'right');
 assert.ok(blocks[2].gap>0);
});
test('sentence fallback maps a repeated word to its own sentence, across PDF lines',()=>{
 const text='It works. It takes time.';
 const units=sentenceUnits(text);
 const translated=joinSentenceTranslations(units,[{translated:'它有效。',alignment:'0:1-0:0'},{translated:'這需要時間。',alignment:''}]);
 const block={text,...translated,spans:[{itemIndex:0,start:0,end:13},{itemIndex:1,start:14,end:text.length}]};
 const match=selectionMatch(block,[{itemIndex:1,start:0,end:5}]);
 assert.equal(match.mode,'sentence');assert.deepEqual(match.ranges,[{start:4,end:10}]);
 assert.deepEqual(match.source,[{start:10,end:24}]);
 assert.deepEqual(selectionMatch(block,[{itemIndex:0,start:0,end:2}]).ranges,[{start:0,end:1}]);
});
test('unknown sentence correspondence is never guessed from paragraph length',()=>{
 const b={text:'One. Two.',translated:'一。二。',alignment:'',spans:[{itemIndex:0,start:0,end:9}]};
 assert.deepEqual(selectionMatch(b,[{itemIndex:0,start:5,end:8}]).ranges,[]);
});
test('superscript citations stay in their sentence and preserve selection offsets',()=>{
 const blocks=extractPageBlocks({items:[item('Research works',165,500,90),item('1',257,504,4,7),item(' across lines.',262,500,80),item('It continues.',165,485,160)]});
 assert.equal(blocks.length,1);assert.equal(blocks[0].text,'Research works1 across lines. It continues.');
 assert.equal(blocks[0].spans[1].start,14);
});
test('narrow references sidebar keeps its original proportion',()=>{
 const blocks=extractPageBlocks({items:[item('Reference one',40,500,90,9),item('Reference two',40,485,90,9),item('Main text',160,700,290),item('Continued text',160,685,290)]});
 assert.equal(blocks[0].column,'left');assert.equal(blocks.at(-1).column,'right');
 assert.ok(blocks[0].columnRatio<.35);
});

test('small reference type does not turn the main column into headings',()=>{
 const content={items:[
  item('1 Reference author',40,700,100,6),item('Reference title and details',40,690,100,6),item('More reference details',40,680,100,6),item('2 Another reference',40,660,100,6),item('Another reference title',40,650,100,6),item('Reference page details',40,640,100,6),
  item('Main paragraph starts here.',160,700,280,9),item('It continues normally.',160,687,280,9),
  item('Another main paragraph.',160,655,280,9),item('More ordinary prose.',160,642,280,9)
 ]};
 const blocks=extractPageBlocks(content);assert.equal(blocks.filter(b=>b.column==='right').every(b=>b.kind==='paragraph'),true);
});

test('long prose remains body text when saved metadata labels it a heading',()=>{
 assert.equal(translatedBlockTag({kind:'heading',text:'A section of ordinary academic prose. '.repeat(8)}),'p');
 assert.equal(translatedBlockTag({kind:'heading',text:'2 Research directions'}),'h3');
});
