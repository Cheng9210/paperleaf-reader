import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMode,clampSplit,initReadingModes} from '../dist/lib/reading-modes.js';

test('unknown saved modes and invalid split ratios recover safely',()=>{
  assert.equal(normalizeMode('broken'),'en-left');assert.equal(normalizeMode('zh-left'),'en-left');
  for(const mode of ['en-left','en-only','zh-only'])assert.equal(normalizeMode(mode),mode);
  assert.equal(clampSplit(NaN),55);assert.equal(clampSplit(0),25);assert.equal(clampSplit(99),75);
});
test('mode changes reorder accessible DOM, preserve physical split, and survive blocked storage',()=>{
  const node=()=>({hidden:false,style:{setProperty(){}},dataset:{},setAttribute(k,v){this[k]=v;},addEventListener(){}});
  const panes=node(),original=node(),translation=node(),splitter=node(),select=node();
  panes.append=(...nodes)=>panes.children=nodes;
  const els={'#reading-panes':panes,'#original-pane':original,'#translation-pane':translation,'#splitter':splitter,'#reading-mode':select};
  let changes=0;const modes=initReadingModes({root:{querySelector:s=>els[s]},storage:{getItem(){throw Error();},setItem(){throw Error();}},onChange(){changes++;}});
  modes.setSplit(60);modes.setMode('zh-left');
  assert.deepEqual(panes.children,[original,splitter,translation]);assert.equal(splitter['aria-valuenow'],60);
  modes.setMode('zh-only');assert.equal(original.hidden,true);assert.equal(translation.hidden,false);assert.equal(splitter.hidden,true);
  modes.setMode('en-only');assert.equal(original.hidden,false);assert.equal(translation.hidden,true);
  modes.setMode('en-left');assert.deepEqual(panes.children,[original,splitter,translation]);assert.equal(changes,3);
});
test('saved mode restores without writing and subsequent changes persist',()=>{
  const nodes=new Map();const root={querySelector(s){if(!nodes.has(s))nodes.set(s,{dataset:{},style:{setProperty(){}},append(){},setAttribute(){},addEventListener(){}});return nodes.get(s);}};
  const writes=[];const modes=initReadingModes({root,storage:{getItem:()=> 'zh-only',setItem:(...args)=>writes.push(args)}});
  assert.equal(modes.mode,'zh-only');assert.equal(writes.length,0);modes.setMode('en-only');assert.deepEqual(writes,[['paperleaf-reading-mode','en-only']]);
});
