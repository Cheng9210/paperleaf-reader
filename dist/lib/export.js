import {hexRgb} from './core.js';
function displayGeometry(page){const b=page.getCropBox(),r=((page.getRotation().angle%360)+360)%360;return{width:r%180?b.height:b.width,height:r%180?b.width:b.height,rotation:r,point(x,y){if(r===90)return{x:b.x+y,y:b.y+x};if(r===180)return{x:b.x+b.width-x,y:b.y+y};if(r===270)return{x:b.x+b.width-y,y:b.y+b.height-x};return{x:b.x+x,y:b.y+b.height-y};}};}
export async function exportAnnotatedPdf(bytes,annotations,{PDFLib=window.PDFLib}={}){
  const{PDFDocument,rgb,degrees,BlendMode}=PDFLib,doc=await PDFDocument.load(bytes.slice());
  for(const a of annotations){if(a.page<1||a.page>doc.getPageCount())continue;const page=doc.getPage(a.page-1),g=displayGeometry(page);
    for(const r of a.rects||[]){
      let height=r.height*g.height,image=null;
      if(a.kind==='text'&&a.text.trim()){const stamp=await createTextStamp(a.text,r.width*g.width,a.fontSize,a.color);image=await doc.embedPng(stamp.image);height=stamp.height;}
      else if(a.kind==='comment'&&a.image)image=await doc.embedPng(a.image);
      const origin=g.point(r.x*g.width,r.y*g.height+height),box={...origin,width:r.width*g.width,height,rotate:degrees(g.rotation)};
      if(a.kind==='highlight')page.drawRectangle({...box,color:rgb(...hexRgb(a.color)),opacity:1,blendMode:BlendMode.Multiply});
      else if(image)page.drawImage(image,box);
    }
  }
  return doc.save();
}
export async function createTextStamp(text,width,fontSize=14,color='#c03632'){
  await document.fonts.ready;const scale=3,lineHeight=fontSize*1.25,canvas=document.createElement('canvas');
  // Let the same browser text layout used by the editor decide line breaks.
  const layout=document.createElement('div');layout.style.cssText=`position:fixed;left:-10000px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:anywhere;width:${width}px;font:${fontSize}px/1.25 "Paperleaf Noto Sans TC",sans-serif;letter-spacing:normal;padding:0;border:0`;
  layout.textContent=text;document.body.append(layout);await document.fonts.load(`${fontSize}px "Paperleaf Noto Sans TC"`,text);
  const lines=[];let previousTop=null;const range=document.createRange(),node=layout.firstChild;
  for(let i=0;i<text.length;i++){range.setStart(node,i);range.setEnd(node,i+1);const rect=range.getBoundingClientRect();if(text[i]==='\n'){previousTop=null;continue;}if(previousTop===null||Math.abs(rect.top-previousTop)>.5){lines.push({text:'',top:Math.round((rect.top-layout.getBoundingClientRect().top)/lineHeight)*lineHeight});previousTop=rect.top;}lines.at(-1).text+=text[i];}
  const height=Math.max(lineHeight,layout.getBoundingClientRect().height);layout.remove();canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle=color;ctx.font=`${fontSize}px "Paperleaf Noto Sans TC",sans-serif`;ctx.textBaseline='alphabetic';const m=ctx.measureText('Mg'),ascent=m.fontBoundingBoxAscent||fontSize*.9,descent=m.fontBoundingBoxDescent||fontSize*.25,baseline=(lineHeight-ascent-descent)/2+ascent;
  lines.forEach(line=>ctx.fillText(line.text,0,baseline+line.top));return{image:canvas.toDataURL('image/png'),height};
}
export function downloadFile(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
