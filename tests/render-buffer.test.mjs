import test from 'node:test';
import assert from 'node:assert/strict';
// PDF.js needs DOMMatrix during module initialization; no PDF drawing is mocked here.
globalThis.DOMMatrix=class {};
const {ContinuousPdf}=await import('../dist/lib/continuous-pdf.js');

test('zoom keeps the last painted canvas visible while its replacement is rendering',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);
  const old={painted:true,replaceWith(next){visible=next;}},buffer={getContext(){return {};}};
  let visible=old;
  globalThis.devicePixelRatio=1;globalThis.document={createElement(){return buffer;}};
  const reader=Object.create(ContinuousPdf.prototype);reader.generation=1;reader.schedule=()=>{};
  const p={serial:1,viewport:{width:600,height:800},el:{querySelector(){return visible;}},page:{render(){return{promise:pending};},async getTextContent(){return{};}}};
  const rendering=reader.render(p);
  try{assert.equal(visible,old,'a blank buffer must not replace the visible PDF');}
  finally{reader.generation=2;finish();await rendering;}
  assert.equal(visible,old,'stale zoom output must never replace the visible PDF');
});
