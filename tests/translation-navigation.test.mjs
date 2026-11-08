import test from 'node:test';
import assert from 'node:assert/strict';
import {AzureReader} from '../dist/lib/azure-reader.js';

test('a hidden translation pane cannot change the English page while scrolling',()=>{
 const previous=globalThis.document;
 const root={clientHeight:480,closest:()=>({hidden:true}),querySelectorAll:()=>{throw Error('hidden slots must not be measured');}};
 globalThis.document={querySelector:()=>root};
 try{let changes=0;AzureReader.prototype.scrollChanged.call({page:7,onPageVisible:()=>changes++});assert.equal(changes,0);}
 finally{globalThis.document=previous;}
});

test('Chinese zoom scales every loaded page without forcing horizontal overflow',()=>{
 const previous=globalThis.document;
 const pages=[{style:{},dataset:{}},{style:{},dataset:{}}],label={textContent:''};
 const mode={dataset:{readingMode:'zh-only'}};
 globalThis.document={querySelector:selector=>({'#reading-panes':mode,'#original-pane':{hidden:true},'#zoom-label':label})[selector],querySelectorAll:()=>pages};
 try{const reader=Object.create(AzureReader.prototype);reader.setZoom(1.5);assert.equal(reader.zoom,1.5);assert.equal(label.textContent,'150%');for(const page of pages){assert.equal(page.style.width,'150%');assert.equal(page.style.minWidth,'0px');}
 mode.dataset.readingMode='en-left';AzureReader.prototype.setZoom.call(reader,.8);for(const page of pages){assert.equal(page.style.minWidth,'0px');assert.equal(page.style.width,'80%');}}
 finally{globalThis.document=previous;}
});

test('Chinese wheel zoom previews with a transform and reflows pages only after the gesture',()=>{
 const previous=globalThis.document,papers=[{style:{},dataset:{},isConnected:true,classList:{add(){},remove(){}},getBoundingClientRect(){return {left:10,top:20,width:100,height:200};}},{style:{},dataset:{}}],label={textContent:''},scroller={scrollLeft:0,scrollTop:0};
 globalThis.document={querySelector:selector=>({'#original-pane':{hidden:true},'#zoom-label':label})[selector],querySelectorAll:()=>papers};
 const reader=Object.create(AzureReader.prototype);reader.zoom=1;reader.committedZoom=1;
 try{reader.previewZoom(1.5,60,120,papers[0],scroller);assert.equal(papers[0].style.transform,'scale(1.5)');assert.equal(papers[0].style.width,undefined);assert.equal(papers[1].style.width,undefined);reader.previewZoom(1.8,60,120,papers[0],scroller);assert.equal(papers[0].style.transform,'scale(1.8)');reader.finishZoom();assert.equal(papers[0].style.transform,'');assert.equal(papers[0].style.width,'180%');assert.equal(papers[1].style.width,'180%');assert.equal(label.textContent,'180%');}
 finally{clearTimeout(reader.zoomTimer);globalThis.document=previous;}
});
