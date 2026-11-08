import test from 'node:test';
import assert from 'node:assert/strict';
import {dismissCorrespondence} from '../dist/lib/selection-lifecycle.js';

test('a plain click can clear source and translation correspondence without removing annotations',()=>{
 const annotations=[{id:'highlight-1'}],state={selection:{text:'design'},annotations};
 const calls=[];const translator={selection:{page:1},clear(){calls.push('translation');this.selection=null;}};
 const cleared=dismissCorrespondence(state,{translator,clearDemo:()=>calls.push('demo'),selection:{removeAllRanges(){calls.push('native');}}});
 assert.equal(cleared,true);assert.equal(state.selection,null);assert.equal(translator.selection,null);assert.deepEqual(calls,['demo','translation','native']);assert.equal(state.annotations,annotations);
 assert.equal(dismissCorrespondence(state,{translator,clearDemo:()=>calls.push('again')}),false);
});
