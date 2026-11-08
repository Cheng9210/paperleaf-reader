import test from 'node:test';
import assert from 'node:assert/strict';
import {untranslatedEnglish} from '../dist/lib/translation-quality.js';
import {TranslationStore} from '../dist/lib/translation-store.js';
const source='This paper describes the sources of inspiration in design.';
test('rejects English body text but retains translated terminology and short labels',()=>{
 assert.equal(untranslatedEnglish(source,source),true);
 assert.equal(untranslatedEnglish(source,'本文描述設計中靈感的來源。'),false);
 assert.equal(untranslatedEnglish('Figure 1','Figure 1'),false);
 assert.equal(untranslatedEnglish('1 Sources of inspiration','1 Sources of inspiration'),true);
});
test('restoring copied English resets only the affected block and page',async()=>{
 const store=new TranslationStore(null);
 await store.save('paper',new Map([[1,{done:true,blocks:[{text:source,translated:source,alignment:'bad'},{text:source,translated:'本文描述設計中靈感的來源。'}]}]]));
 const page=(await store.load('paper')).get(1);
 assert.equal(page.done,false);assert.equal(page.blocks[0].translated,undefined);
 assert.equal(page.blocks[0].alignment,undefined);assert.equal(page.blocks[1].translated,'本文描述設計中靈感的來源。');
});
