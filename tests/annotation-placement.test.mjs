import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/lib/core.js';

test('text starts at the clicked point even near the right and bottom edges',()=>{
  const rect=core.textRectAt?.(.9,.96,600,800,14);
  assert.ok(rect,'text placement helper exists');
  assert.equal(rect.x,.9);assert.equal(rect.y,.96);
  assert.ok(rect.width<=.100001);assert.ok(rect.height<=.040001);
});

test('text placement uses PDF coordinates independently of screen zoom',()=>{
  const rect=core.textRectAt?.(.2,.3,600,800,16);
  assert.ok(rect);assert.equal(rect.x,.2);assert.equal(rect.y,.3);
  assert.equal(rect.height,.025);assert.ok(Math.abs(rect.width-230/600)<.000001);
});
