import test from 'node:test';
import assert from 'node:assert/strict';
import {mappedScrollTop} from '../dist/lib/scroll-sync.js';

test('a source page scroll maps to the same relative place in a taller translation page',()=>{
  assert.equal(mappedScrollTop({top:-300,height:1000},{top:200,height:1500},100,100,500),1200);
});

test('page progress is clamped at both ends',()=>{
  assert.equal(mappedScrollTop({top:300,height:1000},{top:200,height:1500},100,100,500),600);
  assert.equal(mappedScrollTop({top:-1300,height:1000},{top:200,height:1500},100,100,500),2100);
});

test('visible page breaks line up even when the two papers have different heights',()=>{
  const source={top:-300,height:784},target={top:-600,height:1284};
  const sourceNext={top:500},targetNext={top:700};
  assert.equal(mappedScrollTop(source,target,100,100,500,{sourceNext,targetNext,viewportHeight:800}),700);
});

test('a page break outside the viewport does not change ordinary page progress',()=>{
  const source={top:-300,height:1000},target={top:200,height:1500};
  assert.equal(mappedScrollTop(source,target,100,100,500,{sourceNext:{top:901},targetNext:{top:1700},viewportHeight:800}),1200);
});
