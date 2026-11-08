import test from 'node:test';
import assert from 'node:assert/strict';
import {createInlineDisclosure} from '../dist/lib/translation-layout.js';

test('the full translation disclosure is anchored to its original PDF block',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:tag=>({tagName:tag.toUpperCase(),style:{},dataset:{},children:[],attributes:{},setAttribute(name,value){this.attributes[name]=value;},getAttribute(name){return this.attributes[name];},append(...children){this.children.push(...children);}})};
 try{const detail=createInlineDisclosure(3,{x:100,y:200,width:220,height:40},{width:600,height:800},'完整的段落譯文');assert.equal(detail.tagName,'DETAILS');assert.equal(detail.dataset.detailIndex,3);assert.equal(detail.style.left,'53.333333333333336%');assert.equal(detail.style.top,'30%');assert.equal(detail.children[0].tagName,'SUMMARY');assert.equal(detail.children[0].textContent,'⋯');assert.equal(detail.children[0].getAttribute('aria-label'),'展開第 4 段完整譯文');assert.equal(detail.children[1].textContent,'完整的段落譯文');}
 finally{globalThis.document=previous;}
});
