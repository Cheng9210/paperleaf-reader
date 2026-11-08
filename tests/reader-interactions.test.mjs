import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/lib/core.js';
import * as translation from '../dist/lib/translation.js';

test('overlapping text rectangles do not darken a highlight twice', () => {
  assert.equal(typeof core.cleanSelectionRects, 'function');
  const r = {x:0.1,y:0.2,width:0.2,height:0.02};
  assert.deepEqual(core.cleanSelectionRects([r,{...r}, {...r,x:0.32,width:0.1}]),[r,{...r,x:0.32,width:0.1}]);
});
test('inline text stays on the page after a drag', () => {
  assert.equal(typeof core.moveAnnotation, 'function');
  const a={kind:'text',rects:[{x:.1,y:.2,width:.3,height:.1}],text:'筆記'};
  const b=core.moveAnnotation(a,1,-1);
  assert.equal(b.rects[0].x,.7);assert.equal(b.rects[0].y,0);
  assert.equal(a.rects[0].x,.1);
});
test('old sticky comments become editable text while keeping content and location', () => {
  assert.equal(typeof core.migrateAnnotations, 'function');
  const [a]=core.migrateAnnotations([{id:'a',kind:'comment',page:2,text:'保留舊筆記',image:'old',rects:[{x:.2,y:.3,width:.4,height:.1}]}]);
  assert.equal(a.kind,'text');assert.equal(a.text,'保留舊筆記');assert.equal(a.rects[0].x,.2);assert.equal(a.page,2);assert.equal(a.fontSize,14);
});
test('selected attention maps to the exact Chinese term, never the paragraph', () => {
  assert.equal(typeof translation.resolveDemoAlignment,'function');
  const match=translation.resolveDemoAlignment('Attention',1,'Attention mechanisms allow a model');
  assert.equal(match.sectionId,'abstract');assert.equal(match.target,'注意力');
  assert.equal(match.end-match.start,3);
});
test('unknown selected words do not fall back to paragraph highlighting', () => {
  assert.equal(typeof translation.resolveDemoAlignment,'function');
  assert.equal(translation.resolveDemoAlignment('unmappedword',1,''),null);
});
test('space is left untouched in inline text annotations',()=>{
  assert.equal(core.shouldSpeak({code:'Space',target:{tagName:'DIV',isContentEditable:true}},'model'),false);
});
import {wheelZoom} from '../dist/lib/core.js';
test('ordinary wheel scrolls while Ctrl wheel and pinch zoom within safe bounds',()=>{
  assert.equal(wheelZoom({deltaY:100},1),null);
  assert.ok(wheelZoom({ctrlKey:true,deltaY:-100},1)>1);
  assert.ok(wheelZoom({ctrlKey:true,deltaY:100},1)<1);
  assert.equal(wheelZoom({ctrlKey:true,deltaY:-10000},1),3);
  assert.equal(wheelZoom({ctrlKey:true,deltaY:10000},1),.6);
  assert.equal(wheelZoom({ctrlKey:true,deltaY:1,deltaMode:1},1),wheelZoom({ctrlKey:true,deltaY:16,deltaMode:0},1));
});
