import test from 'node:test';import assert from 'node:assert/strict';import {displayTranslation} from '../dist/lib/reference-display.js';
test('incomplete English reference title becomes a compact author label',()=>{
 const block={text:'2 Eckert, C M Intelligent sup-',translated:'2 Eckert, C M Intelligent sup-'};
 assert.equal(displayTranslation(block,{translated:'針織品設計博士論文報告'}),'2 Eckert，C·M 等');
 assert.equal(displayTranslation(block,{translated:'English continuation'}),block.translated);
});
