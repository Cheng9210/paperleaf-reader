export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function normalizedRect(rect,bounds){const x=clamp((rect.left-bounds.left)/bounds.width,0,1),y=clamp((rect.top-bounds.top)/bounds.height,0,1);return{x,y,width:Math.max(0,clamp((rect.left+rect.width-bounds.left)/bounds.width,0,1)-x),height:Math.max(0,clamp((rect.top+rect.height-bounds.top)/bounds.height,0,1)-y)};}
export function shouldSpeak(event,selection){return event.code==='Space'&&!!selection&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.shiftKey&&!event.target?.isContentEditable&&!['TEXTAREA','INPUT','SELECT','BUTTON'].includes(event.target?.tagName)&&!event.target?.closest?.('[contenteditable="true"],[role="button"],dialog');}
export async function documentKey(bytes){const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
export function pdfRect(rect,width,height){return{x:rect.x*width,y:(1-rect.y-rect.height)*height,width:rect.width*width,height:rect.height*height};}
export const noteSections=[{key:'summary',label:'先說重點',hint:'這篇論文最想回答什麼？最重要的發現是什麼？'},{key:'structure',label:'拆解論文架構',children:[['background','背景與文獻'],['purpose','Purpose · 目的'],['problem','Problem · 研究問題'],['objectives','Objectives · 研究目標'],['methods','Methods · 研究方法'],['results','Results · 研究結果'],['discussion','Discussion · 討論'],['conclusion','Conclusion · 結論']]},{key:'questions',label:'值得質疑的地方',hint:'證據充分嗎？有哪些假設與限制？'},{key:'examples',label:'用簡單例子解釋',hint:'試著用自己的例子，解釋一個重要概念。'},{key:'outline',label:'如實整理內容',hint:'區分作者的主張、論文的證據，以及自己的推論。'}];
export function notesToMarkdown(title,notes){let text=`# ${title} — 閱讀筆記\n\n`;for(const s of noteSections){text+=`## ${s.label}\n\n`;if(s.children){for(const[key,label]of s.children)text+=`### ${label}\n\n${notes[key]||''}\n\n`;}else text+=`${notes[s.key]||''}\n\n`;}text+='## 原文摘錄\n\n';for(const q of notes.quotes||[])text+=`> ${q.text.replace(/\n/g,'\n> ')}\n\n來源：第 ${q.page} 頁\n\n`;return text;}
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function cleanSelectionRects(rects) {
  const result = [];
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const duplicate = result.some(r => Math.abs(r.x-rect.x)<.001 && Math.abs(r.width-rect.width)<.001 && Math.abs(r.y-rect.y)<Math.min(r.height,rect.height)*.2);
    if (!duplicate) result.push({...rect});
  }
  return result;
}
export function moveAnnotation(annotation, dx, dy) {
  const rect = annotation.rects[0];
  return {...annotation, rects:[{...rect,x:clamp(rect.x+dx,0,Math.max(0,1-rect.width)),y:clamp(rect.y+dy,0,Math.max(0,1-rect.height))}]};
}
export function migrateAnnotations(annotations) {
  return annotations.map(a => {
    if (a.kind==='comment') return {...a,kind:'text',fontSize:14,color:'#c03632',rects:a.rects.map(r=>({...r}))};
    if (a.kind==='highlight') return {...a,color:a.color||'#ffe66d',rects:cleanSelectionRects(a.rects)};
    return {...a};
  });
}
export function hexRgb(color) {
  const value=/^#[0-9a-f]{6}$/i.test(color||'') ? color : '#ffe66d';
  return [1,3,5].map(start=>parseInt(value.slice(start,start+2),16)/255);
}
export function wheelZoom(event,current) {
  if(!event.ctrlKey&&!event.metaKey)return null;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?600:1);
  return clamp(current*Math.exp(-delta*.002),.6,3);
}
export function textRectAt(x,y,pageWidth,pageHeight,fontSize) {
  x=clamp(x,0,.999);y=clamp(y,0,.999);
  return {x,y,width:Math.min(230/pageWidth,1-x),height:Math.min(fontSize*1.25/pageHeight,1-y)};
}
