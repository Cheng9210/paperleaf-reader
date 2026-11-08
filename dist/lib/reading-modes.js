const MODES=['en-left','en-only','zh-only'];
export const normalizeMode=value=>MODES.includes(value)?value:'en-left';
export const clampSplit=value=>Number.isFinite(value)?Math.min(75,Math.max(25,value)):55;

export function initReadingModes({root=document,storage,onChange=()=>{}}={}) {
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  const panes=root.querySelector('#reading-panes'),original=root.querySelector('#original-pane'),translation=root.querySelector('#translation-pane'),splitter=root.querySelector('#splitter'),select=root.querySelector('#reading-mode');
  let mode='en-left',ratio=55;
  try{mode=normalizeMode(storage?.getItem('paperleaf-reading-mode'));}catch{}
  function apply(){
    panes.dataset.readingMode=mode;select.value=mode;for(const button of select.querySelectorAll?.('[data-reading-mode]')||[])button.setAttribute('aria-pressed',String(button.dataset.readingMode===mode));
    original.hidden=mode==='zh-only';translation.hidden=mode==='en-only';splitter.hidden=mode.endsWith('only');
    panes.append(original,splitter,translation);
    setSplit(ratio);
  }
  function setSplit(value){ratio=clampSplit(value);panes.style.setProperty('--left',ratio+'%');panes.style.setProperty('--left-track',ratio+'fr');panes.style.setProperty('--right-track',(100-ratio)+'fr');splitter.setAttribute('aria-valuenow',Math.round(ratio));splitter.setAttribute('aria-valuetext',`左欄 ${Math.round(ratio)}%，右欄 ${100-Math.round(ratio)}%`);}
  function setMode(value){const next=normalizeMode(value);if(next===mode)return;mode=next;apply();try{storage?.setItem('paperleaf-reading-mode',mode);}catch{}onChange(mode);}
  select.addEventListener('click',event=>{const button=event.target.closest?.('[data-reading-mode]');if(button)setMode(button.dataset.readingMode);});apply();
  return {get mode(){return mode;},setMode,setSplit};
}
