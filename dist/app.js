import {initReadingModes} from './lib/reading-modes.js';
import {AzureReader} from './lib/azure-reader.js?v=20261112-boundary-1';
import {selectionParts} from './lib/pdf-text.js';
import {hydrateIcons} from './lib/icons.js';
import {loadPdf} from './lib/pdf.js';
import {ContinuousPdf} from './lib/continuous-pdf.js';
import {mappedScrollTop} from './lib/scroll-sync.js?v=20261112-boundary-1';
import {clamp,normalizedRect,shouldSpeak,documentKey,notesToMarkdown,cleanSelectionRects,migrateAnnotations,moveAnnotation,textRectAt} from './lib/core.js';
import {readDocument,saveDocument} from './lib/storage.js';
import {renderNotebook,noteCount} from './lib/notes.js';
import {renderTranslation,alignTranslation,clearTranslationSelection} from './lib/translation.js';
import {dismissCorrespondence} from './lib/selection-lifecycle.js';
import {exportAnnotatedPdf,downloadFile} from './lib/export.js';
import {exportTranslatedPdf} from './lib/translated-export.js?v=20261111-artwork-1';

const $=s=>document.querySelector(s);
const state={doc:null,bytes:null,key:null,name:'',demo:true,page:1,tool:'select',notes:{quotes:[]},annotations:[],history:[],selection:null,selected:null,busy:false};
let toastTimer,highlightTimer,loadSerial=0;
hydrateIcons();
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function persist(){if(!state.key)return;try{saveDocument(state.key,state);$('#save-status').textContent='已自動儲存';}catch{toast('儲存失敗，請下載 PDF 與筆記。');}$('#notes-count').textContent=noteCount(state.notes);}
function remember(){state.history.push(structuredClone(state.annotations));if(state.history.length>50)state.history.shift();document.querySelector('[data-action="undo"]').disabled=false;}
function changed(){persist();drawAll();}
function selectAnnotation(a){state.selected=a?.id||null;document.querySelectorAll('[data-annotation]').forEach(el=>el.classList.toggle('selected',el.dataset.annotation===state.selected));if(a?.kind==='text'){$('#text-color').value=a.color;$('#font-size').value=a.fontSize;}if(a?.kind==='highlight'){$('#highlight-color').value=a.color;$('#highlight-indicator').style.background=a.color;}}
function setTool(tool){state.tool=tool;document.querySelectorAll('[data-tool]').forEach(el=>{el.classList.toggle('active',el.dataset.tool===tool);el.setAttribute('aria-pressed',el.dataset.tool===tool);});$('#pdf-pages').classList.toggle('text-mode',tool==='text');}
function pageChanged(page){if(state.page===page&&$('#translation-content').childElementCount)return;state.page=page;$('#page-input').value=page;$('#translation-page').textContent=`第 ${page} 頁`;const slot=$(`#translation-content .translation-page-slot[data-page="${page}"]`);if(translator.revealed&&slot)translator.page=page;else translator.showPage(page);navigation();}
const translator=new AzureReader();
translator.confirmDocument=()=>new Promise(resolve=>{const dialog=$('#translation-consent');$('#consent-document-name').textContent=state.name;const finish=approved=>{dialog.close();resolve(approved);};$('#consent-cancel').onclick=()=>finish(false);$('#consent-approve').onclick=()=>finish(true);dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.showModal();});
const viewer=new ContinuousPdf($('#pdf-scroll'),page=>{if(!$('#original-pane').hidden)pageChanged(page);},drawPage);
let sourceScrollFrame=0,sourceSyncSerial=0,sourceSyncInProgress=false;
function syncSourceScroll(){
  if($('#original-pane').hidden||$('#translation-pane').hidden||!translator.revealed||!viewer.pages.length)return;
  const source=$('#pdf-scroll'),target=$('#translation-content');
  if(target.hidden||target.clientHeight<1)return;
  const sourceTop=source.getBoundingClientRect().top+Math.min(140,source.clientHeight*.25);
  let current=viewer.pages[0];for(const item of viewer.pages)if(item.el.getBoundingClientRect().top<=sourceTop)current=item;
  pageChanged(current.number);
  const slot=$(`#translation-content .translation-page-slot[data-page="${current.number}"]`);
  if(!slot)return;
  const targetTop=target.getBoundingClientRect().top+Math.min(140,target.clientHeight*.25);
  const next=viewer.pages[current.number],nextSlot=next&&$(`#translation-content .translation-page-slot[data-page="${next.number}"]`);
  const boundary=nextSlot?{sourceNext:next.el.getBoundingClientRect(),targetNext:nextSlot.getBoundingClientRect(),viewportHeight:source.clientHeight}:null;
  const scrollTop=mappedScrollTop(current.el.getBoundingClientRect(),slot.getBoundingClientRect(),sourceTop,targetTop,target.scrollTop,boundary);
  if(Math.abs(target.scrollTop-scrollTop)<1)return;
  sourceSyncInProgress=true;const serial=++sourceSyncSerial;
  target.scrollTop=scrollTop;
  requestAnimationFrame(()=>{if(serial===sourceSyncSerial)sourceSyncInProgress=false;});
}
$('#pdf-scroll').addEventListener('scroll',()=>{if(!sourceScrollFrame)sourceScrollFrame=requestAnimationFrame(()=>{sourceScrollFrame=0;syncSourceScroll();});},{passive:true});
translator.onPageRendered=()=>requestAnimationFrame(syncSourceScroll);
translator.onPageVisible=page=>{if(sourceSyncInProgress||!state.doc||state.page===page)return;state.page=page;$('#page-input').value=page;$('#translation-page').textContent=`第 ${page} 頁`;navigation();if(!$('#original-pane').hidden)viewer.go(page);};
const readingModes=initReadingModes({onChange:()=>{translator.setZoom(translator.zoom||1);if(!$('#original-pane').hidden){viewer.layout(false);viewer.go(state.page);$('#zoom-label').textContent=Math.round(viewer.zoom*100)+'%';}else{$('#zoom-label').textContent=Math.round((translator.zoom||1)*100)+'%';translator.showPage(state.page);}}});
function goPage(value){const page=clamp(Math.round(Number(value)||1),1,state.doc?.numPages||1);pageChanged(page);if(!$('#original-pane').hidden)viewer.go(page);}
function navigation(){$('#page-total').textContent=state.doc?.numPages||1;$('#page-input').max=state.doc?.numPages||1;$('[data-action="prev"]').disabled=state.page<=1;$('[data-action="next"]').disabled=state.page>=state.doc?.numPages;}
function drawAll(){for(const p of viewer.pages)drawPage(p);$('[data-action="undo"]').disabled=!state.history.length;}
function position(el,r){Object.assign(el.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%'});}
function drawPage(p){
  const highlights=p.el.querySelector('.highlight-layer'),texts=p.el.querySelector('.annotation-layer');highlights.replaceChildren();
  const annotations=state.annotations.filter(a=>a.page===p.number),ids=new Set(annotations.map(a=>a.id));
  for(const el of [...texts.children])if(!ids.has(el.dataset.annotation))el.remove();
  for(const a of annotations){
    if(a.kind==='highlight'){for(const r of a.rects){const el=document.createElement('span');el.className='highlight-mark';el.dataset.annotation=a.id;position(el,r);el.style.height=r.height*100+'%';el.style.background=a.color;el.classList.toggle('selected',state.selected===a.id);highlights.append(el);}continue;}
    if(a.kind!=='text')continue;
    let el=[...texts.children].find(e=>e.dataset.annotation===a.id);
    if(!el){el=document.createElement('div');el.className='free-text';el.dataset.annotation=a.id;
      const handle=document.createElement('button');handle.className='text-handle';handle.type='button';handle.textContent='⠿';handle.title='拖曳移動文字';handle.setAttribute('aria-label','移動文字');
      const content=document.createElement('div');content.className='text-content';content.contentEditable='plaintext-only';content.setAttribute('role','textbox');content.setAttribute('aria-label','頁面文字');content.spellcheck=false;content.textContent=a.text;
      el.append(handle,content);texts.append(el);
      content.addEventListener('focus',()=>{selectAnnotation(find(a.id));remember();});
      content.addEventListener('input',()=>{const item=find(a.id);if(!item)return;item.text=content.innerText;item.rects[0].height=Math.min(1-item.rects[0].y,el.offsetHeight/p.el.clientHeight);persist();});
      el.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();remove(a.id);});
      el.addEventListener('pointerdown',e=>{
        e.stopPropagation();if(e.button!==0)return;const item=find(a.id);if(!item)return;selectAnnotation(item);
        // Shift-drag retains native text selection; ordinary dragging moves the note.
        if(e.shiftKey&&e.target===content)return;
        e.preventDefault();const start=structuredClone(item),x=e.clientX,y=e.clientY,b=p.el.getBoundingClientRect();let moved=false;
        el.setPointerCapture(e.pointerId);
        const move=event=>{
          if(!moved&&Math.hypot(event.clientX-x,event.clientY-y)<4)return;
          if(!moved){remember();moved=true;content.blur();getSelection()?.removeAllRanges();el.classList.add('moving');}
          event.preventDefault();Object.assign(item,moveAnnotation(start,(event.clientX-x)/b.width,(event.clientY-y)/b.height));position(el,item.rects[0]);
        };
        const end=event=>{
          event.stopPropagation();el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);el.classList.remove('moving');
          if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
          if(moved){persist();return;}
          if(event.type==='pointercancel'||e.target===handle)return;
          content.focus({preventScroll:true});const caret=document.caretRangeFromPoint?.(x,y);
          if(caret&&content.contains(caret.startContainer)){const selection=getSelection();selection.removeAllRanges();selection.addRange(caret);}
        };
        el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
      });
    }
    position(el,a.rects[0]);el.style.fontSize=a.fontSize*p.scale+'px';el.style.color=a.color;el.classList.toggle('selected',state.selected===a.id);
    const content=el.querySelector('.text-content');if(document.activeElement!==content&&content.innerText!==a.text)content.textContent=a.text;
  }
}
const find=id=>state.annotations.find(a=>a.id===id);
function remove(id){if(!find(id))return;remember();state.annotations=state.annotations.filter(a=>a.id!==id);state.selected=null;changed();window.getSelection()?.removeAllRanges();}
function hitHighlight(event){const el=event.target.closest('.pdf-page');if(!el)return;const b=el.getBoundingClientRect(),x=(event.clientX-b.left)/b.width,y=(event.clientY-b.top)/b.height;return [...state.annotations].reverse().find(a=>a.kind==='highlight'&&a.page===Number(el.dataset.page)&&a.rects.some(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height));}
function selectionRects(range,layer,bounds){
  const rects=[],walker=document.createTreeWalker(layer,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){if(!range.intersectsNode(node)||!node.textContent.trim())continue;const piece=document.createRange();piece.selectNodeContents(node);if(node===range.startContainer)piece.setStart(node,range.startOffset);if(node===range.endContainer)piece.setEnd(node,range.endOffset);for(const r of piece.getClientRects())if(r.width>.3&&r.height>1)rects.push(normalizedRect(r,bounds));}
  return cleanSelectionRects(rects);
}
function captureSelection(){
  if(state.busy||state.tool==='text')return;const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return false;
  const range=selection.getRangeAt(0),parent=range.startContainer.parentElement,layer=parent?.closest('.textLayer');if(!layer||!layer.contains(range.endContainer))return false;
  const el=layer.closest('.pdf-page'),page=Number(el.dataset.page),text=selection.toString().trim();if(!text)return false;
  const rects=selectionRects(range,layer,el.getBoundingClientRect());if(!rects.length)return false;
  state.selection={text,rects,page,context:parent.textContent};selectAnnotation(null);pageChanged(page);
  translator.align(page,selectionParts(range,layer),text,state.selection.context);
  if(state.tool==='highlight'){remember();state.annotations.push({id:crypto.randomUUID(),kind:'highlight',page,rects,text,color:$('#highlight-color').value});changed();selection.removeAllRanges();}
  return true;
}
function clearCorrespondence(){dismissCorrespondence(state,{translator,clearDemo:clearTranslationSelection});}
function addText(e){const el=e.target.closest('.pdf-page');if(!el)return;const p=viewer.pages[Number(el.dataset.page)-1],b=el.getBoundingClientRect(),fontSize=clamp(Number($('#font-size').value)||14,6,96);
  const a={id:crypto.randomUUID(),kind:'text',page:p.number,text:'',fontSize,color:$('#text-color').value,rects:[textRectAt((e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height,p.base.width,p.base.height,fontSize)]};
  remember();state.annotations.push(a);state.selected=a.id;changed();setTool('select');p.el.querySelector(`[data-annotation="${a.id}"] .text-content`).focus();
}
for(const pane of ['#pdf-scroll','#translation-content'])$(pane).addEventListener('pointerdown',e=>{if(e.button===0)clearCorrespondence();});
$('#pdf-pages').addEventListener('pointerup',e=>{if(e.target.closest('.free-text'))return;if(state.tool==='text')return addText(e);clearTimeout(highlightTimer);highlightTimer=setTimeout(()=>{if(!captureSelection())selectAnnotation(hitHighlight(e));},state.tool==='highlight'?250:0);});
$('#pdf-pages').addEventListener('dblclick',e=>{const a=hitHighlight(e);if(a){clearTimeout(highlightTimer);e.preventDefault();remove(a.id);}});
function changeStyle(kind,value){const a=find(state.selected);if(a?.kind!==kind)return;remember();if(kind==='highlight')a.color=value;else Object.assign(a,value);changed();}
$('#highlight-color').addEventListener('input',e=>{$('#highlight-indicator').style.background=e.target.value;changeStyle('highlight',e.target.value);});
$('#text-color').addEventListener('input',e=>changeStyle('text',{color:e.target.value}));
$('#font-size').addEventListener('input',e=>{const value=Number(e.target.value);if(!value||value<6||value>96)return;changeStyle('text',{fontSize:value});const a=find(state.selected);if(a?.kind==='text'){const p=viewer.pages[a.page-1],el=p.el.querySelector(`[data-annotation="${a.id}"]`);a.rects[0].height=Math.min(1-a.rects[0].y,el.offsetHeight/p.el.clientHeight);persist();}});
function speak(){if(!state.selection?.text)return;if(!window.speechSynthesis)return toast('此瀏覽器無法播放語音。');speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(state.selection.text);utterance.lang='en-US';utterance.rate=.88;const voice=speechSynthesis.getVoices().find(v=>v.lang==='en-US');if(voice)utterance.voice=voice;utterance.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))toast('無法播放英文語音，請確認系統英文語音設定。');};speechSynthesis.speak(utterance);}
document.addEventListener('keydown',e=>{if(shouldSpeak(e,state.selection?.text)&&!$('dialog[open]')){e.preventDefault();speak();}if(e.key==='Escape'){clearCorrespondence();selectAnnotation(null);setTool('select');}});
async function openDocument(bytes,name,demo=false){const serial=++loadSerial;state.busy=true;$('#reader-status').textContent='正在讀取 PDF…';try{
  const [doc,key]=await Promise.all([loadPdf(bytes),documentKey(bytes)]);if(serial!==loadSerial){doc.destroy();return;}
  const previous=state.doc;let data;try{data=readDocument(key);}catch{data={notes:{quotes:[]},annotations:[]};toast('舊筆記無法讀取，請保留先前匯出的備份。');}
  Object.assign(state,{doc,key,bytes,name,demo,page:1,notes:data.notes,annotations:migrateAnnotations(data.annotations),history:[],selection:null,selected:null});state.notes.quotes??=[];
  const translationReady=translator.open(doc,key,demo);
  $('#document-title').textContent=name;$('#demo-badge').hidden=!demo;$('#translation-content').replaceChildren();pageChanged(1);renderNotebook(state.notes,demo);$('#notes-count').textContent=noteCount(state.notes);setTool('select');await document.fonts.load('14px "Paperleaf Noto Sans TC"');await viewer.open(doc);drawAll();$('#reader-status').textContent='';if(previous)await previous.destroy();
  if(!demo&&serial===loadSerial){await translationReady;await translator.refresh();}
}catch(error){toast(error.name==='PasswordException'?'PDF 有密碼保護，請先解鎖後再匯入。':'無法讀取 PDF，請確認檔案完整。');$('#reader-status').textContent='讀取失敗';console.error(error);}finally{if(serial===loadSerial)state.busy=false;}}
function toggleNotes(){const open=$('#notebook').hidden;$('#notebook').hidden=!open;$('#notes-toggle').setAttribute('aria-expanded',open);document.body.classList.toggle('notebook-open',open);if(open)renderNotebook(state.notes,state.demo);}
async function exportPdf(){if(!state.bytes)return;const button=$('#confirm-export');button.disabled=true;button.textContent='正在製作…';try{const bytes=await exportAnnotatedPdf(state.bytes,structuredClone(state.annotations));downloadFile(bytes,state.name.replace(/\.pdf$/i,'')+'_註記.pdf','application/pdf');$('#export-dialog').close();toast('PDF 已準備好，請查看下載。');}catch(error){toast('PDF 匯出失敗，請再試一次。');console.error(error);}finally{button.disabled=false;button.textContent='下載註記版';}}
async function exportChinesePdf(){const button=$('#export-translated');button.disabled=true;button.textContent='正在製作第 1 頁…';try{const result=await exportTranslatedPdf(state.doc,translator.records,{onProgress:(page,total)=>{button.textContent=`正在製作 ${page}/${total} 頁…`;}});downloadFile(result.bytes,state.name.replace(/\.pdf$/i,'')+'_繁體中文版.pdf','application/pdf');$('#export-dialog').close();toast(result.overflowCount?`已下載中文版；${result.overflowCount} 段較長譯文的全文附在續頁。`:'中文版 PDF 已準備好，請查看下載。');}catch(error){toast(error.message||'中文版 PDF 製作失敗，請稍後重試。');console.error(error);}finally{button.disabled=false;button.textContent='下載中文版';}}
const actions={upload:()=>$('#pdf-input').click(),notes:toggleNotes,prev:()=>goPage(state.page-1),next:()=>goPage(state.page+1),'zoom-reset':()=>$('#original-pane').hidden?translator.setZoom(1):viewer.setZoom(1),undo:()=>{if(state.history.length){state.annotations=state.history.pop();state.selected=null;changed();}},quote:()=>{const s=state.selection;if(!s)return;state.notes.quotes.push({id:crypto.randomUUID(),text:s.text,page:s.page});persist();if($('#notebook').hidden)toggleNotes();else renderNotebook(state.notes,state.demo);},export:()=>{if(state.bytes)$('#export-dialog').showModal();},'cancel-export':()=>$('#export-dialog').close(),'confirm-export':exportPdf,'export-translated':exportChinesePdf,'export-notes':()=>downloadFile(notesToMarkdown(state.name,state.notes),state.name.replace(/\.pdf$/i,'')+'_閱讀筆記.md','text/markdown;charset=utf-8')};
document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button)return actions[button.dataset.action]?.();const tool=e.target.closest('[data-tool]');if(tool){setTool(tool.dataset.tool);if(state.tool==='highlight'&&state.selection&&getSelection()?.toString())captureSelection();return;}
  const source=e.target.closest('[data-source-page]');if(source){if(readingModes.mode==='zh-only')readingModes.setMode('en-only');goPage(Number(source.dataset.sourcePage));if(innerWidth<1150&&!$('#notebook').hidden)toggleNotes();$('#workspace').classList.remove('show-translation');return;}
  const quote=e.target.closest('[data-remove-quote]');if(quote){state.notes.quotes=state.notes.quotes.filter(q=>q.id!==quote.dataset.removeQuote);persist();renderNotebook(state.notes,state.demo);}
  const mobile=e.target.closest('[data-mobile]');if(mobile){document.querySelectorAll('[data-mobile]').forEach(el=>el.classList.toggle('active',el===mobile));$('#workspace').classList.toggle('show-translation',mobile.dataset.mobile==='translation');viewer.layout();}
});
$('#pdf-input').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;e.target.value='';if(!file.name.toLowerCase().endsWith('.pdf'))return toast('請選擇 PDF。');if(file.size>150*1024*1024)return toast('請選擇小於 150 MB 的 PDF。');await openDocument(new Uint8Array(await file.arrayBuffer()),file.name);});
$('#page-input').addEventListener('change',e=>goPage(e.target.value));
$('#notebook-body').addEventListener('input',e=>{if(e.target.dataset.note){state.notes[e.target.dataset.note]=e.target.value;persist();}});
const splitter=$('#splitter');let dragging=false;
function setSplit(value){readingModes.setSplit(value);}
splitter.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;splitter.setPointerCapture(e.pointerId);document.body.classList.add('dragging');});
splitter.addEventListener('pointermove',e=>{if(dragging){const b=$('#reading-panes').getBoundingClientRect();setSplit((e.clientX-b.left)/(b.width-splitter.offsetWidth)*100);}});
for(const event of ['pointerup','pointercancel'])splitter.addEventListener(event,()=>{dragging=false;document.body.classList.remove('dragging');viewer.layout();});
splitter.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setSplit(e.key==='Home'?25:e.key==='End'?75:Number(splitter.getAttribute('aria-valuenow'))+(e.key==='ArrowRight'?2:-2));viewer.layout();}});
try{const response=await fetch(new URL('./demo.pdf',import.meta.url));if(!response.ok)throw Error();await openDocument(new Uint8Array(await response.arrayBuffer()),'Attention and Learning',true);}catch{toast('請匯入 PDF 開始閱讀。');}

$('#page-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();goPage(e.target.value);}});
