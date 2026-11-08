import {extractPageBlocks,selectionMatch} from './pdf-text.js';
import {TranslationStore} from './translation-store.js';
import {renderPdfTranslation,highlightSourceSentences} from './translation-layout.js';
import {untranslatedEnglish} from './translation-quality.js';
import {displayTranslation} from './reference-display.js';
import {renderTranslation,alignTranslation} from './translation.js';
import {createBrowserGemini} from './browser-gemini.js';
const $=s=>document.querySelector(s);
const browserGemini=globalThis.location?.hostname?.endsWith('github.io')?createBrowserGemini():null;
async function api(url,body){if(browserGemini){if(url.endsWith('/status'))return browserGemini.status();if(url.endsWith('/config'))return browserGemini.configure(body);if(url.endsWith('/translate'))return browserGemini.translate(body);}
 let response;try{response=await fetch(url,{method:body?'POST':'GET',headers:{'X-Paperleaf-Request':'1',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Error('無法連接本機翻譯服務，請重新啟動網站。');}let data;try{data=await response.json();}catch{throw Error('請重新啟動網站，讓 Gemini 翻譯服務生效。');}if(!response.ok)throw Error(data.error||'翻譯服務無法使用。');return data;}
export class AzureReader{
 constructor(){
  this.store=new TranslationStore();this.generation=0;this.records=new Map();this.page=1;this.running=false;
  $('#translation-content').addEventListener('scroll',()=>this.scrollChanged(),{passive:true});
  $('#azure-settings').onclick=()=>this.settings();$('#translate-start').onclick=()=>this.running?this.pause():this.start();
  $('#azure-close').onclick=()=>$('#azure-dialog').close();
  $('#azure-form').onsubmit=async e=>{e.preventDefault();const button=$('#azure-save');button.disabled=true;$('#azure-message').textContent='正在驗證金鑰…';try{this.status=await api('/api/gemini/config',{key:$('#azure-key').value,freeTierConfirmed:$('#azure-f0').checked});$('#azure-key').value='';$('#azure-message').textContent='金鑰已儲存在本機，下次不用重填。關閉設定後，按「翻譯全文」開始。';this.error='';this.showPage(this.page);}catch(error){$('#azure-message').textContent=error.message;}finally{button.disabled=false;}};
  this.refresh();
 }
 async refresh(){try{this.status=await api('/api/gemini/status');}catch(e){this.error=e.message;}if(this.doc)this.showPage(this.page);}
 open(doc,key,demo){clearTimeout(this.zoomTimer);this.zoomPreview=null;this.generation++;this.running=false;this.workerGeneration=null;this.doc=doc;this.key=key;this.demo=demo;this.enabled=false;this.records=new Map();this.selection=null;this.error='';this.page=1;this.zoom=1;this.committedZoom=1;this.storageWarning='';this.controls();const generation=this.generation;
 this.restoration=(async()=>{const records=await this.store.load(key);if(generation!==this.generation)return;this.records=records;this.enabled=records.size>0;if(!this.store.persistent)this.storageWarning='瀏覽器無法儲存進度；關閉後可能遺失。';this.showPage(this.page);})();return this.restoration;}
 controls(){const done=[...this.records.values()].filter(x=>x.done).length,complete=!!this.doc&&done===this.doc.numPages;$('#translate-start').textContent=this.running?'暫停':complete?'翻譯完成':this.enabled?'繼續翻譯':'翻譯全文';$('#translate-start').disabled=complete;$('#translate-start').hidden=complete;const progress=$('#translation-progress');if(progress){progress.textContent=(this.running?'翻譯中 · ':'')+'已完成 '+done+' / '+(this.doc?.numPages||0)+' 頁 · '+[...this.records.values()].reduce((n,r)=>n+r.blocks.filter(b=>b.translated!==undefined).length,0)+' 段'+(this.storageWarning?' · '+this.storageWarning:'');progress.hidden=complete&&!this.storageWarning;}$('#translate-start').title=`已完成 ${done} / ${this.doc?.numPages||0} 頁`;}
 pause(){this.running=false;this.showPage(this.page);}
 async settings(){await this.refresh();$('#azure-message').textContent=this.status?.configured?`金鑰已儲存在本機，無需重填（${this.status.model}）。免費額度以 Google AI Studio 專案顯示為準。`:(this.error||'尚未連線。請填入 Gemini Free Tier 專案的 API 金鑰。');$('#azure-key').placeholder=this.status?.configured?'已儲存；僅更換金鑰時填寫':'貼上 Gemini API 金鑰';$('#azure-dialog').showModal();}
 scrollChanged(){
  const root=$('#translation-content');if(root.closest('#translation-pane')?.hidden||root.clientHeight<1||this.prepending)return;
  const slots=[...root.querySelectorAll('.translation-page-slot')];if(!slots.length)return;
  const top=root.getBoundingClientRect().top+Math.min(140,root.clientHeight*.25);
  let visible=slots[0];for(const slot of slots)if(slot.getBoundingClientRect().top<=top)visible=slot;
  const number=Number(visible.dataset.page);if(number&&number!==this.page){this.page=number;this.onPageVisible?.(number);}
  if(slots[0].getBoundingClientRect().top>root.getBoundingClientRect().top-400)this.prependPrevious();
  if(slots.at(-1).getBoundingClientRect().top<root.getBoundingClientRect().bottom+400)this.appendNext();
 }
 applyZoomTo(paper){const zoom=this.zoomPreview?this.committedZoom||1:this.zoom||1;paper.dataset.zoom=zoom;paper.style.width=zoom*100+'%';paper.style.minWidth='0px';}
 setZoom(value){if(this.zoomPreview){clearTimeout(this.zoomTimer);this.zoomPreview.paper.style.transform='';this.zoomPreview.paper.classList.remove('zoom-preview');this.zoomPreview=null;}this.zoom=Math.max(.7,Math.min(3,value));this.committedZoom=this.zoom;for(const paper of document.querySelectorAll('#translation-content .translated-pdf-page'))this.applyZoomTo(paper);if($('#original-pane').hidden)$('#zoom-label').textContent=Math.round(this.zoom*100)+'%';}
 previewZoom(value,x,y,paper,scroller){if(!paper.isConnected)return;if(this.zoomPreview&&this.zoomPreview.paper!==paper)this.finishZoom();if(!this.zoomPreview){const rect=paper.getBoundingClientRect();this.committedZoom??=this.zoom||1;this.zoomPreview={paper,scroller,x,y,rx:(x-rect.left)/rect.width,ry:(y-rect.top)/rect.height};paper.classList.add('zoom-preview');paper.style.transformOrigin=`${this.zoomPreview.rx*100}% ${this.zoomPreview.ry*100}%`;}this.zoom=Math.max(.7,Math.min(3,value));paper.style.transform=`scale(${this.zoom/this.committedZoom})`;if($('#original-pane').hidden)$('#zoom-label').textContent=Math.round(this.zoom*100)+'%';clearTimeout(this.zoomTimer);this.zoomTimer=setTimeout(()=>this.finishZoom(),150);}
 finishZoom(){const preview=this.zoomPreview;if(!preview)return;clearTimeout(this.zoomTimer);preview.paper.style.transform='';preview.paper.classList.remove('zoom-preview');this.zoomPreview=null;this.setZoom(this.zoom);if(!preview.paper.isConnected)return;const after=preview.paper.getBoundingClientRect();preview.scroller.scrollLeft+=after.left+preview.rx*after.width-preview.x;preview.scroller.scrollTop+=after.top+preview.ry*after.height-preview.y;}
 async prependPrevious(){
  if(this.prepending||!this.doc||this.sequenceStart<=1||this.prependFailure===this.sequenceStart-1)return;
  const token=this.sequenceToken,generation=this.generation,n=this.sequenceStart-1,root=$('#translation-content');this.prepending=true;
  try{const record=await this.preparePage(n);if(token!==this.sequenceToken||generation!==this.generation||!record)return;
   const first=root.querySelector('.translation-page-slot'),before=first?.getBoundingClientRect().top;
   const slot=document.createElement('section');slot.className='translation-page-slot';slot.dataset.page=n;slot.style.aspectRatio=`${record.width||1}/${record.height||1}`;root.prepend(slot);this.sequenceStart=n;
   if(first)root.scrollTop+=first.getBoundingClientRect().top-before;
   await renderPdfTranslation(slot,record.blocks,record.pageProxy,this);
   if(first&&token===this.sequenceToken)root.scrollTop+=first.getBoundingClientRect().top-before;
  }catch{this.prependFailure=n;
  }finally{if(token===this.sequenceToken){this.prepending=false;this.scrollChanged();}}
 }
 async appendNext(){
  if(this.appending||!this.doc||this.sequenceEnd>=this.doc.numPages||this.appendFailure===this.sequenceEnd+1)return;
  const token=this.sequenceToken,generation=this.generation,n=this.sequenceEnd+1;this.appending=true;
  try{const record=await this.preparePage(n);if(token!==this.sequenceToken||generation!==this.generation||!record)return;
   const slot=document.createElement('section');slot.className='translation-page-slot';slot.dataset.page=n;slot.style.aspectRatio=`${record.width||1}/${record.height||1}`;$('#translation-content').append(slot);this.sequenceEnd=n;
   await renderPdfTranslation(slot,record.blocks,record.pageProxy,this);
  }catch{this.appendFailure=n;
  }finally{if(token===this.sequenceToken){this.appending=false;this.scrollChanged();}}
 }
 async showPage(page){this.page=page;this.controls();const root=$('#translation-content'),serial=this.renderSerial=(this.renderSerial||0)+1,generation=this.generation,token=this.sequenceToken=(this.sequenceToken||0)+1;this.sequenceStart=page;this.sequenceEnd=page;this.appending=false;this.prepending=false;this.appendFailure=null;this.prependFailure=null;
  if(!this.enabled&&this.demo){root.classList.add('demo-translation');renderTranslation(page,true);return;}
  root.classList.remove('demo-translation');
  try{
   if(this.restoration)await this.restoration;if(generation!==this.generation||serial!==this.renderSerial)return;
   const record=await this.preparePage(page);if(!record||serial!==this.renderSerial||generation!==this.generation)return;
   const slot=document.createElement('section');slot.className='translation-page-slot';slot.dataset.page=page;root.replaceChildren(slot);root.scrollTop=0;
   await renderPdfTranslation(slot,record.blocks,record.pageProxy,this);if(serial!==this.renderSerial)return;this.paintSelection();if(!$('#translation-pane').hidden){this.prependPrevious();this.appendNext();}
   if(this.error||!record.blocks.length){const p=document.createElement('p');p.textContent=this.error||'此頁保留原始圖片；沒有可擷取文字，掃描文字需先 OCR。';p.className='translation-empty';slot.prepend(p);}
  }catch(error){if(generation===this.generation&&serial===this.renderSerial){const p=document.createElement('p');p.className='translation-empty';p.textContent='頁面載入失敗，請切換頁面重試。';root.replaceChildren(p);}}
 }
 async preparePage(n){
 const generation=this.generation,doc=this.doc;let record=this.records.get(n);if(record?.pageProxy)return record;
 const page=await doc.getPage(n);if(generation!==this.generation)return null;
 if(!record){const content=await page.getTextContent();if(generation!==this.generation)return null;record=this.records.get(n)||{blocks:extractPageBlocks(content),done:false};const viewport=page.getViewport({scale:1});record.width=viewport.width;record.height=viewport.height;this.records.set(n,record);}
 record.pageProxy=page;return record;
 }
 async persist(generation){if(generation!==this.generation||!this.store)return;const saved=await this.store.save(this.key,this.records);if(generation!==this.generation)return;if(!saved)this.storageWarning='無法儲存進度；請保留此分頁，避免遺失譯文。';}
 async start(){const requestedGeneration=this.generation;if(this.restoration)await this.restoration;if(requestedGeneration!==this.generation||!this.doc||this.running)return;if(this.workerGeneration===this.generation){this.running=true;this.controls();return;}if(!this.status?.configured)return this.settings();this.running=true;this.enabled=true;this.error='';const generation=this.generation,doc=this.doc;this.workerGeneration=generation;this.showPage(this.page);
  try{while(this.running&&generation===this.generation){const n=Array.from({length:doc.numPages},(_,i)=>i+1).find(p=>!this.records.get(p)?.done);if(!n)break;
    let record=this.records.get(n);if(!record)record=await this.preparePage(n);if(!record||generation!==this.generation)return;
    const pending=record.blocks.filter(b=>b.translated===undefined);while(pending.length&&this.running&&generation===this.generation){const batch=[];let size=0;while(pending.length&&batch.length<20&&(batch.length===0||size+pending[0].text.length<=3500)){const b=pending.shift();batch.push(b);size+=b.text.length;}const response=await api('/api/gemini/translate',{texts:batch.map(b=>b.text)});if(generation!==this.generation)return;if(!Array.isArray(response.results)||response.results.length!==batch.length||response.results.some((x,i)=>typeof x.translated!=='string'||untranslatedEnglish(batch[i].text,x.translated)))throw Error('翻譯回應仍是英文，請繼續翻譯重試。');batch.forEach((b,i)=>Object.assign(b,response.results[i]));record.done=record.blocks.every(b=>b.translated!==undefined);await this.persist(generation);if(generation!==this.generation)return;this.controls();if(this.page===n)this.showPage(n);}
    record.done=record.blocks.every(b=>b.translated!==undefined);if(!record.blocks.length)await this.persist(generation);if(generation!==this.generation)return;if(this.page===n)this.showPage(n);this.controls();
   }
  }catch(e){if(generation===this.generation){this.error=e.message;this.showPage(this.page);}}
  finally{if(generation===this.generation){this.workerGeneration=null;this.running=false;this.showPage(this.page);}}
 }
 align(page,parts,text,context){this.selection={page,parts};if(!this.enabled&&this.demo)return alignTranslation(text,page,context);this.paintSelection();}
 clear(){this.selection=null;globalThis.CSS?.highlights?.delete('source-sentence');this.paintSelection();}
 paintSelection(){
  globalThis.CSS?.highlights?.delete('source-sentence');
  const blocks=this.records.get(this.page)?.blocks;if(!blocks)return;
  const matches=blocks.map(b=>b.translated!==undefined&&this.selection?.page===this.page?selectionMatch(b,this.selection.parts):{ranges:[],source:[]});
  blocks.forEach((b,i)=>{const p=$(`#translation-content .translation-page-slot[data-page="${this.page}"] [data-block-index="${i}"]`);if(!p||b.translated===undefined)return;p.replaceChildren();const shown=displayTranslation(b,blocks[i+1]);let offset=0;
   if(shown!==b.translated){p.textContent=shown;return;}
   for(const r of matches[i].ranges){p.append(document.createTextNode(b.translated.slice(offset,r.start)));const mark=document.createElement('mark');mark.className='azure-word';mark.textContent=b.translated.slice(r.start,r.end);p.append(mark);offset=r.end;}
   p.append(document.createTextNode(b.translated.slice(offset)));
  });
  highlightSourceSentences(this.page,blocks,matches);
  $('#translation-content .azure-word')?.scrollIntoView({block:'nearest'});
 }
}
