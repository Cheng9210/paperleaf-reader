export function pageBlockRect(block,viewport){
 const r=viewport.convertToViewportRectangle([block.x,block.bottom,block.right,block.y+block.fontSize]);
 const x=Math.max(0,Math.min(r[0],r[2])),y=Math.max(0,Math.min(r[1],r[3]));
 return {x,y,width:Math.max(1,Math.min(viewport.width-x,Math.abs(r[2]-r[0]))),height:Math.max(1,Math.min(viewport.height-y,Math.abs(r[3]-r[1])))};
}
export function readingBlockRects(blocks,viewport){
 const boxes=blocks.map(b=>pageBlockRect(b,viewport));
 return boxes.map((box,i)=>{
  const next=boxes.filter((b,j)=>j!==i&&b.y>box.y+1&&b.x<box.x+box.width&&b.x+b.width>box.x).sort((a,b)=>a.y-b.y)[0];
  let width=box.width;
  if(blocks[i].kind==='heading'&&next&&Math.abs(next.x-box.x)<8)width=Math.max(width,next.width);
  const height=next?Math.max(1,next.y-box.y-2):box.height;
  return {...box,width,height};
 });
}
export function sourceTextRect(item,viewport){
 if(!item?.str?.trim()||!Array.isArray(item.transform))return null;
 const [,,c,d,x,y]=item.transform,height=item.height||Math.hypot(c,d);
 const a=viewport.convertToViewportPoint(x,y),b=viewport.convertToViewportPoint(x,y+height);
 const pad=Math.max(2,height*viewport.scale*.25),rise=height*viewport.scale;
 return {x:Math.min(a[0],b[0])-pad,y:Math.min(a[1],b[1])-rise-pad,width:Math.max(1,item.width*viewport.scale)+pad*2,height:Math.abs(b[1]-a[1])+rise+pad*2};
}
