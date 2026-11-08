import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.DOMMatrix=class {};
const {ContinuousPdf}=await import('../dist/lib/continuous-pdf.js');

test('wheel preview changes page geometry without redrawing every annotation until zoom settles',()=>{
 const previous={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle};
 const textLayer={style:{}},pageStyle={setProperty(){}};let draws=0,cancels=0;
 const page={base:{width:600},page:{getViewport:({scale})=>({scale,width:600*scale,height:800*scale})},el:{style:pageStyle,querySelector:()=>textLayer},task:{cancel(){cancels++;}},text:{cancel(){cancels++;}},serial:0,ready:true};
 const scroll={clientWidth:620,scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:0})};
 globalThis.document={querySelector:()=>({textContent:''})};globalThis.getComputedStyle=()=>({paddingLeft:'10px'});
 const reader=Object.create(ContinuousPdf.prototype);Object.assign(reader,{scroll,pages:[page],zoom:1,zooming:false,onRender:()=>draws++,anchor:()=>null,visible:()=>{},previewing:false});
 try{reader.layout(false,null,true);assert.equal(draws,0);assert.equal(cancels,2);assert.equal(page.el.style.width,'600px');reader.zoom=1.4;reader.layout(false,null,true);assert.equal(draws,0);assert.equal(cancels,2);reader.finishZoom();assert.equal(draws,1);}
 finally{globalThis.document=previous.document;globalThis.getComputedStyle=previous.getComputedStyle;clearTimeout(reader.renderTimer);}
});
