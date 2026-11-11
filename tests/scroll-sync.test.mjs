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
