export function dismissCorrespondence(state,{translator,clearDemo,selection=globalThis.getSelection?.()}={}){
 if(!state.selection&&!translator?.selection)return false;
 state.selection=null;
 clearDemo?.();
 translator?.clear();
 selection?.removeAllRanges();
 return true;
}
