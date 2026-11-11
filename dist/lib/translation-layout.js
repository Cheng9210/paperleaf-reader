import {readingBlockRects,pageBlockRect,sourceTextRect} from './page-geometry.js';
import {displayTranslation} from './reference-display.js';
export function translationPlaceholder({running=false,error=''}={}){return error?'尚未翻譯':running?'等待翻譯…':'尚未翻譯（已暫停）';}
export function createInlineDisclosure(index,box,viewport,text){
 const detail=document.createElement('details');detail.className='translation-more';detail.dataset.detailIndex=index;
 detail.style.left=(box.x+box.width)/viewport.width*100+'%';detail.style.top=(box.y+box.height)/viewport.height*100+'%';
 detail.dataset.side=box.x+box.width<viewport.width/2?'left':'right';
 const summary=document.createElement('summary');summary.textContent='⋯';summary.setAttribute('aria-label',`展開第 ${index+1} 段完整譯文`);summary.title='展開完整譯文';const full=document.createElement('p');full.textContent=text;detail.append(summary,full);return detail;
}
const artwork=new WeakMap();
async function pageArtwork(page){
 if(!artwork.has(page))artwork.set(page,(async()=>{
  const {OPS}=await import('../vendor/pdf.mjs'),operators=await page.getOperatorList(),canvas=document.createElement('canvas'),viewport=page.getViewport({scale:1.5});
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const textOps=new Set([OPS.showText,OPS.showSpacedText,OPS.nextLineShowText,OPS.nextLineSetSpacingShowText]);
  await page.render({canvasContext:canvas.getContext('2d'),viewport,operationsFilter:i=>!textOps.has(operators.fnArray[i])}).promise;
  // Some PDFs paint text even when render filtering is requested. Clear the
  // extracted glyph areas before placing Chinese, while retaining page art.
  const content=await page.getTextContent(),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';
  for(const item of content.items){const r=sourceTextRect(item,viewport);if(r)ctx.fillRect(r.x,r.y,r.width,r.height);}
  return canvas;
 })().catch(e=>{artwork.delete(page);throw e;}));
 return artwork.get(page);
}
export async function renderPdfTranslation(root,blocks,page,state){
 root._pageObserver?.disconnect();
 const viewport=page.getViewport({scale:1}),paper=document.createElement('article');paper.className='translated-pdf-page';paper.setAttribute('aria-label','保留圖片及原頁面位置的中文版');paper.style.aspectRatio=`${viewport.width}/${viewport.height}`;
 const canvas=document.createElement('canvas');canvas.className='translation-artwork';canvas.setAttribute('aria-hidden','true');paper.append(canvas);
 const boxes=readingBlockRects(blocks,viewport);
 const placements=blocks.map((block,index)=>{
  const box=boxes[index],p=document.createElement(block.kind==='heading'?'h3':'p');p.className='azure-paragraph pdf-translated-block';p.dataset.blockIndex=index;
  Object.assign(p.style,{left:box.x/viewport.width*100+'%',top:box.y/viewport.height*100+'%',width:box.width/viewport.width*100+'%',height:box.height/viewport.height*100+'%'});
  const shown=displayTranslation(block,blocks[index+1]);if(shown!==block.translated)p.classList.add('reference-label');
  p.textContent=shown||translationPlaceholder(state);paper.append(p);return {p,block,box,index};
 });
 root.replaceChildren(paper);
 state.applyZoomTo(paper);root.style.aspectRatio='';
 function fit(){
  if(!paper.isConnected||paper.clientWidth===0)return;
  const scale=paper.clientWidth/viewport.width;
  for(const {p,block,box,index} of placements){
   const minimum=(p.classList.contains('reference-label')?6:block.kind==='heading'?10:box.width<viewport.width*.3?7.5:9)*scale;
   let size=Math.max(minimum,Math.min(block.kind==='heading'?18:12,block.fontSize)*scale);p.style.fontSize=size+'px';
   while((p.scrollHeight>p.clientHeight+1||p.scrollWidth>p.clientWidth+1)&&size>minimum){size-=.25;p.style.fontSize=Math.max(minimum,size)+'px';}
   // Never discard text: oversized passages remain accessible in a full-text disclosure.
   const needsMore=p.scrollHeight>p.clientHeight+2||p.scrollWidth>p.clientWidth+2;
   let detail=paper.querySelector(`[data-detail-index="${index}"]`);
   if(needsMore&&block.translated){
    if(!detail){detail=createInlineDisclosure(index,box,viewport,block.translated);paper.append(detail);}
   }else{detail?.remove();}
   p.style.fontSize=(size/scale/viewport.width*100)+'cqw';
  }
 }
 root.onwheel=e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const scroller=root.parentElement?.id==='translation-content'?root.parentElement:root,zoom=(state.zoom||1)*Math.exp(-e.deltaY*.002);state.previewZoom(zoom,e.clientX,e.clientY,paper,scroller);};
 try{const art=await pageArtwork(page);if(!paper.isConnected)return;canvas.width=art.width;canvas.height=art.height;const ctx=canvas.getContext('2d');ctx.drawImage(art,0,0);ctx.fillStyle='#fff';for(const block of blocks.filter(b=>b.ocr)){const box=pageBlockRect(block,viewport),sx=art.width/viewport.width,sy=art.height/viewport.height;ctx.fillRect(Math.max(0,(box.x-2)*sx),Math.max(0,(box.y-2)*sy),Math.min(art.width-box.x*sx,(box.width+4)*sx),Math.min(art.height-box.y*sy,(box.height+4)*sy));}}catch{if(paper.isConnected){const note=document.createElement('p');note.className='translation-empty';note.textContent='本頁圖片載入失敗，請切換頁面重試。';root.prepend(note);}}
 await document.fonts.ready;if(paper.isConnected)fit();
}
export function renderPageTranslation(root,blocks,state){
 const page=document.createElement('article');page.className='translated-page';page.setAttribute('aria-label','依原文排版的譯文');
 const ordered=blocks.map((block,index)=>({block,index})).sort((a,b)=>(b.block.y||0)-(a.block.y||0)||(a.block.x||0)-(b.block.x||0));
 let columns=null;
 for(const {block,index} of ordered){
  const p=document.createElement(block.kind==='heading'?'h3':'p');p.className='azure-paragraph';p.dataset.blockIndex=index;
  p.style.fontSize=`${(block.fontScale||1)*14}px`;p.style.marginTop=`${Math.min(32,Math.max(0,(block.gap||0)-4))}px`;
  p.textContent=block.translated||translationPlaceholder(state);
  if(!block.column||block.column==='full'){columns=null;page.append(p);}
  else{
   if(!columns){columns=document.createElement('div');columns.className='translation-columns';columns.dataset.top=block.y||0;const ratio=Math.max(.22,Math.min(.78,block.columnRatio||.5));columns.style.gridTemplateColumns=`minmax(0,${ratio}fr) minmax(0,${1-ratio}fr)`;for(const side of ['left','right']){const col=document.createElement('div');col.className=`translation-column ${side}`;columns.append(col);}page.append(columns);}
   const column=columns.children[block.column==='right'?1:0];
   if(!column.childElementCount)p.style.marginTop=`${Math.max(0,(Number(columns.dataset.top)-(block.y||0))*.7)}px`;
   column.append(p);
  }
 }
 root.append(page);
}
export function highlightSourceSentences(page,blocks,matches){
 if(!globalThis.CSS?.highlights||!globalThis.Highlight)return;
 const ranges=[],layer=document.querySelector(`.pdf-page[data-page="${page}"] .textLayer`);
 if(layer)blocks.forEach((block,i)=>{
  for(const source of matches[i]?.source||[])for(const span of block.spans||[]){
   const start=Math.max(source.start,span.start),end=Math.min(source.end,span.end);if(end<=start)continue;
   const element=layer.querySelector(`[data-text-index="${span.itemIndex}"]`);if(!element)continue;
   const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node,offset=0;
   const from=start-span.start+(span.itemOffset||0),to=end-span.start+(span.itemOffset||0);
   while((node=walker.nextNode())){const a=Math.max(0,from-offset),b=Math.min(node.length,to-offset);if(b>a){const range=document.createRange();range.setStart(node,a);range.setEnd(node,b);ranges.push(range);}offset+=node.length;}
  }
 });
 CSS.highlights.set('source-sentence',new Highlight(...ranges));
}
