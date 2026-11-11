export function shouldOcrPage(blocks,viewport){
 const chars=blocks.reduce((sum,block)=>sum+String(block.text||'').replace(/\s/g,'').length,0);
 if(chars<140)return true;
 const top=Math.max(...blocks.map(block=>Number(block.y)||0)),bottom=Math.min(...blocks.map(block=>Number(block.bottom)||0));
 return chars<450&&top-bottom<viewport.height*.45;
}

export function ocrBlocksFromResponse(result,width,height){
 if(!Array.isArray(result?.blocks))throw Error('掃描頁辨識結果不完整，請稍後重試。');
 return result.blocks.flatMap(row=>{
  const box=row?.box,text=String(row?.text||'').trim();
  if(!text||text.length>5000||!Array.isArray(box)||box.length!==4||box.some(v=>!Number.isFinite(v)||v<0||v>1000)||box[2]<=box[0]||box[3]<=box[1])return [];
  const x=box[0]*width/1000,right=box[2]*width/1000,top=box[1]*height/1000,bottom=height-box[3]*height/1000;
  const fontSize=Math.max(8,Math.min(24,(box[3]-box[1])*height/1000*.55));
  return [{text,x,right,y:height-top-fontSize,bottom,fontSize,kind:row.kind==='heading'?'heading':'paragraph',column:'full',fontScale:row.kind==='heading'?1.3:1,spans:[],ocr:true}];
 }).sort((a,b)=>b.y-a.y||a.x-b.x);
}

export async function pageImageForOcr(page){
 const base=page.getViewport({scale:1}),scale=Math.min(2,1400/Math.max(base.width,base.height)),viewport=page.getViewport({scale});
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
 return canvas.toDataURL('image/jpeg',.78).split(',')[1];
}
