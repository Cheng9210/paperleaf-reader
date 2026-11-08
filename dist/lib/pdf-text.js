export function extractPageBlocks(content){
 const heights=content.items.filter(i=>i.str?.trim().length>2).map(i=>Math.abs(i.height||i.transform?.[3]||12)).sort((a,b)=>a-b),normal=heights[Math.floor(heights.length/2)]||12;
 const items=content.items.map((item,index)=>{
  if(!/^[A-Za-z]$/.test(item.str||'')||item.height<normal*1.8)return item;
  const next=content.items.slice(index+1,index+6).find(i=>i.str?.trim()&&i.height<=normal*1.3&&i.transform[4]>=item.transform[4]+item.width*.7&&Math.abs(i.transform[5]-item.transform[5])<item.height);
  if(!next)return item;
  return {...item,height:next.height,transform:[...item.transform.slice(0,3),next.height,item.transform[4],next.transform[5]],dropCap:true,joinNext:next.transform[4]-(item.transform[4]+item.width)<normal*.2};
 });
 const lines=[];let line=null,index=0;
 for(const item of items){
  if(typeof item.str!=='string')continue;const itemIndex=index++,text=item.str;if(!text.trim())continue;
  const x=item.transform[4],y=item.transform[5],h=Math.abs(item.height||item.transform[3]||12),right=x+(item.width||0);
  // Superscript citations belong to their baseline, not a separate paragraph.
  const same=line&&Math.abs(y-line.y)<Math.max(h,line.fontSize)*.55&&x>=line.x&&x-line.right<Math.max(h,line.fontSize)*3;
  if(!same){line={text:'',spans:[],x,y,right,bottom:y-h,fontSize:h,dropCap:!!item.dropCap,capWidth:item.dropCap?item.width:0};lines.push(line);}
  const superscript=h<line.fontSize*.85&&y-line.y>line.fontSize*.15;
  if(line.text&&!/\s$/.test(line.text)&&!/^\s|^[.,;:!?)]/.test(text)&&!superscript&&!line.joinNext)line.text+=' ';
  line.joinNext=!!item.joinNext;
  const start=line.text.length;line.text+=text;line.spans.push({itemIndex,start,end:line.text.length,itemOffset:0});
  line.right=Math.max(line.right,right);line.bottom=Math.min(line.bottom,y-h);line.fontSize=Math.max(line.fontSize,h);
 }
 if(!lines.length)return [];
 const sizes=lines.map(l=>l.fontSize).sort((a,b)=>a-b),body=sizes[Math.floor(sizes.length/2)]||12;
 const left=Math.min(...lines.map(l=>l.x));
 // Find a real gutter using line ends, supporting a narrow references sidebar.
 let split=null,best=0;
 for(const candidate of lines.map(l=>l.x)){
  if(candidate-left<body*4)continue;
  const a=lines.filter(l=>l.x<candidate-body*3&&l.right<=candidate+1&&l.right-l.x>body*3);
  const b=lines.filter(l=>Math.abs(l.x-candidate)<body&&l.right-l.x>body*4);
  const score=Math.min(a.length,b.length);if(score>=2&&score>best){best=score;split=candidate;}
 }
 for(const l of lines)l.column=split===null?'full':l.x>=split-body?'right':l.right<=split+1?'left':'full';
 const blocks=[];let block=null,last=null;
 for(const l of lines){
  const same=block&&block.column===l.column&&last.y-l.y>0&&last.y-l.y<Math.max(l.fontSize,last.fontSize)*1.75&&(Math.abs(l.x-block.x)<body*.8||(block.dropCap&&l.x>=block.x&&l.x<=block.x+block.capWidth+body*2))&&Math.abs(l.fontSize-last.fontSize)<body*.15;
  if(!same||block.text.length+l.text.length>3000){
   block={text:'',spans:[],x:l.x,y:l.y,right:l.right,bottom:l.bottom,fontSize:l.fontSize,column:l.column,dropCap:l.dropCap,capWidth:l.capWidth,gap:last&&last.column===l.column?Math.max(0,last.y-l.y-l.fontSize):0};blocks.push(block);
  }
  const offset=block.text.length+(block.text?1:0);if(block.text)block.text+=' ';block.text+=l.text;
  block.spans.push(...l.spans.map(s=>({...s,start:s.start+offset,end:s.end+offset})));
  block.right=Math.max(block.right,l.right);block.bottom=Math.min(block.bottom,l.bottom);last=l;
 }
 // Bound requests without losing PDF item offsets, even for unusually long text items.
 const result=[];
 for(const b of blocks){
  for(let start=0;start<b.text.length;){
   let end=Math.min(b.text.length,start+3000);if(end<b.text.length&&/[\uD800-\uDBFF]/.test(b.text[end-1]))end--;
   const spans=b.spans.filter(s=>s.end>start&&s.start<end).map(s=>({itemIndex:s.itemIndex,start:Math.max(s.start,start)-start,end:Math.min(s.end,end)-start,itemOffset:(s.itemOffset||0)+Math.max(0,start-s.start)}));
   result.push({...b,text:b.text.slice(start,end),spans,kind:b.fontSize>body*1.15?'heading':'paragraph',fontScale:Math.max(.8,Math.min(1.6,b.fontSize/body)),columnRatio:split===null?.5:(split-left)/(Math.max(...lines.map(l=>l.right))-left)});start=end;
  }
 }
 return result;
}
export function sourceRanges(block,parts){
 const out=[];for(const span of block.spans||[])for(const part of parts){if(part.itemIndex!==span.itemIndex)continue;const offset=span.itemOffset||0,start=Math.max(part.start,offset),end=Math.min(part.end,offset+span.end-span.start);if(end>start)out.push({start:span.start+start-offset,end:span.start+end-offset});}return out;
}
export function selectionMatch(block,parts){
 const ranges=alignedRanges(block,parts);if(ranges.length)return {mode:'word',ranges,source:[]};
 const selected=sourceRanges(block,parts),sentences=(block.sentences||[]).filter(s=>s.start>=0&&s.end<=block.text.length&&s.targetStart>=0&&s.targetEnd<=block.translated.length&&s.targetEnd>s.targetStart&&selected.some(r=>r.start<s.end&&r.end>s.start));
 return {mode:'sentence',ranges:sentences.map(s=>({start:s.targetStart,end:s.targetEnd})),source:sentences.map(s=>({start:s.start,end:s.end}))};
}
export function alignedRanges(block,parts){
 const selected=[];for(const span of block.spans)for(const part of parts){if(part.itemIndex!==span.itemIndex)continue;const offset=span.itemOffset||0,start=Math.max(part.start,offset),end=Math.min(part.end,offset+span.end-span.start);if(end>start)selected.push({start:span.start+start-offset,end:span.start+end-offset});}
 selected.sort((a,b)=>a.start-b.start);const merged=[];for(const r of selected){const last=merged.at(-1);if(last&&(r.start<=last.end||/^\s*$/.test(block.text.slice(last.end,r.start))))last.end=Math.max(last.end,r.end);else merged.push({...r});}
 const ranges=[];for(const match of (block.alignment||'').matchAll(/(\d+):(\d+)-(\d+):(\d+)/g)){const [,a,b,c,d]=match.map(Number);if(b<a||d<c||b>=block.text.length||d>=block.translated.length)continue;if(merged.some(r=>a>=r.start&&b<r.end))ranges.push({start:c,end:d+1});}
 ranges.sort((a,b)=>a.start-b.start);return ranges.reduce((out,r)=>{const last=out.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else out.push({...r});return out;},[]);
}
export function selectionParts(range,layer){
 const parts=[],walker=document.createTreeWalker(layer,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){if(!range.intersectsNode(node))continue;const span=node.parentElement.closest('[data-text-index]');if(!span)continue;const before=document.createRange();before.selectNodeContents(span);before.setEnd(node,0);const base=before.toString().length;parts.push({itemIndex:Number(span.dataset.textIndex),start:base+(range.startContainer===node?range.startOffset:0),end:base+(range.endContainer===node?range.endOffset:node.length)});}
 return parts;
}
