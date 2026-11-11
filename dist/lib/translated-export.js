import {renderPdfTranslation} from './translation-layout.js';

const hasTranslation=record=>record?.done&&record.blocks.every(block=>typeof block.translated==='string'&&block.translated.trim());

function drawTextLines(ctx,element,paperRect){
 const style=getComputedStyle(element),size=parseFloat(style.fontSize),weight=style.fontWeight;
 ctx.fillStyle=style.color;ctx.font=`${weight} ${size}px "Paperleaf Noto Sans TC", sans-serif`;ctx.textBaseline='alphabetic';
 const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),range=document.createRange();let node;
 while((node=walker.nextNode())){
  const groups=[];let offset=0;
  for(const part of new Intl.Segmenter('zh-Hant',{granularity:'grapheme'}).segment(node.textContent)){
   const start=offset;offset+=part.segment.length;if(part.segment==='\n')continue;
   range.setStart(node,start);range.setEnd(node,offset);const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)continue;
   const last=groups.at(-1);if(last&&Math.abs(last.top-rect.top)<1)last.text+=part.segment;
   else groups.push({text:part.segment,x:rect.left-paperRect.left,top:rect.top-paperRect.top});
  }
  for(const line of groups)ctx.fillText(line.text,line.x,line.top+size*.86);
 }
}

export function paintTranslatedBlock(ctx,element,paperRect,paintText=drawTextLines){
 const rect=element.getBoundingClientRect(),x=rect.left-paperRect.left,y=rect.top-paperRect.top;
 ctx.save();ctx.beginPath();ctx.rect(x,y,rect.width,rect.height);ctx.clip();
 ctx.fillStyle='#fff';ctx.fillRect(x,y,rect.width,rect.height);paintText(ctx,element,paperRect);ctx.restore();
}

export async function renderTranslatedPage(page,record){
 const viewport=page.getViewport({scale:1}),root=document.createElement('section');root.className='translation-page-slot';root.style.cssText=`position:fixed;left:-20000px;top:0;width:${viewport.width}px;visibility:hidden`;
 document.body.append(root);
 try{
  await renderPdfTranslation(root,record.blocks,page,{zoom:1,applyZoomTo:paper=>{paper.style.width='100%';}});
  await document.fonts.load('350 12px "Paperleaf Noto Sans TC"');await document.fonts.load('600 16px "Paperleaf Noto Sans TC"');
  const paper=root.querySelector('.translated-pdf-page'),art=paper?.querySelector('canvas');if(!paper||!art?.width)throw Error('中文版頁面圖像無法製作。');
  const scale=2,canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*scale);canvas.height=Math.ceil(viewport.height*scale);
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,viewport.width,viewport.height);ctx.drawImage(art,0,0,viewport.width,viewport.height);
  const paperRect=paper.getBoundingClientRect();for(const element of paper.querySelectorAll('.pdf-translated-block'))paintTranslatedBlock(ctx,element,paperRect);
  const overflow=[...paper.querySelectorAll('.translation-more')].map(detail=>({index:Number(detail.dataset.detailIndex),text:detail.querySelector('p')?.textContent||''}));
  return {image:canvas.toDataURL('image/jpeg',.92),width:viewport.width,height:viewport.height,overflow};
 }finally{root.remove();}
}

function appendixImages(overflows,width,height){
 const scale=2,canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
 const pages=[];let y;
 function fresh(){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.fillStyle='#20252b';ctx.font='600 18px "Paperleaf Noto Sans TC", sans-serif';ctx.fillText('較長段落全文',42,56);ctx.font='400 12px "Paperleaf Noto Sans TC", sans-serif';y=84;}
 function save(){pages.push({image:canvas.toDataURL('image/jpeg',.92),width,height});}
 fresh();
 for(const item of overflows){
  if(y+48>height-42){save();fresh();}
  ctx.font='600 12px "Paperleaf Noto Sans TC", sans-serif';ctx.fillText(`原第 ${item.page} 頁，第 ${item.index+1} 段`,42,y);y+=23;
  ctx.font='400 12px "Paperleaf Noto Sans TC", sans-serif';let line='';
  for(const char of item.text){if(char==='\n'||ctx.measureText(line+char).width>width-84){if(y+20>height-42){save();fresh();}ctx.fillText(line,42,y);y+=20;line='';if(char==='\n')continue;}line+=char;}
  if(line){if(y+20>height-42){save();fresh();}ctx.fillText(line,42,y);y+=28;}
 }
 save();return pages;
}

export async function exportTranslatedPdf(doc,records,{PDFLib=globalThis.PDFLib,renderPage=renderTranslatedPage,onProgress=()=>{}}={}){
 if(!doc||!Array.from({length:doc.numPages},(_,i)=>records.get(i+1)).every(hasTranslation))throw Error('全文尚未完成翻譯，請先完成所有頁面。');
 const output=await PDFLib.PDFDocument.create(),overflow=[];let first=null;
 async function addImage({image,width,height}){const embedded=image.startsWith('data:image/png;')?await output.embedPng(image):await output.embedJpg(image);output.addPage([width,height]).drawImage(embedded,{x:0,y:0,width,height});}
 for(let number=1;number<=doc.numPages;number++){
  const record=records.get(number),page=record.pageProxy||await doc.getPage(number),rendered=await renderPage(page,record);
  if(!first)first={width:rendered.width,height:rendered.height};await addImage(rendered);
  for(const item of rendered.overflow||[])overflow.push({...item,page:number});onProgress(number,doc.numPages);
 }
 if(overflow.length){await document.fonts.load('400 12px "Paperleaf Noto Sans TC"');for(const image of appendixImages(overflow,first.width,first.height))await addImage(image);}
 return {bytes:await output.save(),overflowCount:overflow.length,pageCount:output.getPageCount()};
}
