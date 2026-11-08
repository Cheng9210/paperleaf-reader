import * as pdfjs from '../vendor/pdf.mjs';
import {wheelZoom} from './core.js';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdf.worker.mjs',import.meta.url).href;
export class ContinuousPdf {
  constructor(scroll,onPage,onRender) {
    this.scroll=scroll;this.root=scroll.firstElementChild;this.onPage=onPage;this.onRender=onRender;this.pages=[];this.zoom=1;this.generation=0;
    scroll.addEventListener('scroll',()=>this.schedule(),{passive:true});
    scroll.addEventListener('wheel',e=>{const value=wheelZoom(e,this.pendingZoom??this.zoom);if(value===null)return;e.preventDefault();this.pendingZoom=value;this.pendingPoint=[e.clientX,e.clientY];if(this.wheelFrame)return;this.wheelFrame=requestAnimationFrame(()=>{this.wheelFrame=null;const zoom=this.pendingZoom,[x,y]=this.pendingPoint;this.pendingZoom=null;this.setZoom(zoom,x,y);});},{passive:false});
    new ResizeObserver(()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>this.layout(),100);}).observe(scroll);
  }
  async open(doc) {
    const gen=++this.generation;this.pages=[];this.root.replaceChildren();this.zoom=1;this.scroll.scrollTop=0;
    for(let n=1;n<=doc.numPages;n++) {
      const page=await doc.getPage(n);if(gen!==this.generation)return;
      const base=page.getViewport({scale:1}),el=document.createElement('div');el.className='pdf-page';el.dataset.page=n;
      el.innerHTML=`<canvas></canvas><div class="highlight-layer"></div><div class="textLayer"></div><div class="annotation-layer"></div><span class="page-placeholder">第 ${n} 頁</span>`;
      this.root.append(el);this.pages.push({page,base,el,number:n,serial:0});
    }
    this.layout(false);
  }
  anchor(x,y) {
    const b=this.scroll.getBoundingClientRect();x??=b.left+this.scroll.clientWidth/2;y??=b.top+50;
    const p=this.pages.find(p=>p.el.getBoundingClientRect().bottom>=y)||this.pages.at(-1);if(!p)return null;
    const r=p.el.getBoundingClientRect();return{p,x,y,rx:(x-r.left)/r.width,ry:(y-r.top)/r.height};
  }
  layout(preserve=true,anchor=null,preview=false) {
    if(!this.pages.length||this.scroll.clientWidth<40)return;
    const enteringPreview=preview&&!this.previewing,forceCommit=!preview&&this.previewing;
    if(preview)this.previewing=true;else if(forceCommit){this.previewing=false;clearTimeout(this.zoomTimer);}
    const a=preserve?(anchor||this.anchor()):null;
    const padding=parseFloat(getComputedStyle(this.scroll).paddingLeft)*2,width=Math.max(140,this.scroll.clientWidth-padding);
    for(const p of this.pages) {
      const scale=width/p.base.width*this.zoom;if(!forceCommit&&Math.abs((p.scale||0)-scale)<.001)continue;
      p.scale=scale;p.viewport=p.page.getViewport({scale});
      Object.assign(p.el.style,{width:p.viewport.width+'px',height:p.viewport.height+'px'});
      p.el.style.setProperty('--scale-factor',scale);p.el.style.setProperty('--total-scale-factor',scale);
      if(!preview||enteringPreview){p.serial++;p.task?.cancel();p.text?.cancel();p.ready=false;p.el.querySelector('.textLayer').style.visibility='hidden';}
      if(!preview)this.onRender(p);
    }
    if(a){const r=a.p.el.getBoundingClientRect();this.scroll.scrollLeft+=r.left+a.rx*r.width-a.x;this.scroll.scrollTop+=r.top+a.ry*r.height-a.y;}
    this.zooming=true;clearTimeout(this.renderTimer);if(!preview)this.renderTimer=setTimeout(()=>{this.zooming=false;this.visible();},120);
    document.querySelector('#zoom-label').textContent=Math.round(this.zoom*100)+'%';
  }
  finishZoom(){if(!this.previewing)return;this.previewing=false;for(const p of this.pages)this.onRender(p);this.zooming=false;this.visible();}
  setZoom(value,x,y){const a=this.anchor(x,y);this.zoom=Math.max(.6,Math.min(3,value));this.layout(true,a,true);clearTimeout(this.zoomTimer);this.zoomTimer=setTimeout(()=>this.finishZoom(),160);}
  schedule(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.visible();});}
  visible() {
    if(this.scroll.clientWidth<40||this.scroll.clientHeight<1)return;
    const r=this.scroll.getBoundingClientRect();let current=this.pages[0];
    for(const p of this.pages){const b=p.el.getBoundingClientRect();if(b.top<r.top+Math.min(140,r.height*.25))current=p;
      if(p.viewport&&!this.zooming&&b.bottom>r.top-400&&b.top<r.bottom+400&&!p.ready&&!p.rendering)this.render(p);
      else if((b.bottom<r.top-2000||b.top>r.bottom+2000)&&p.ready&&!p.rendering){const canvas=p.el.querySelector('canvas');canvas.width=1;canvas.height=1;p.el.querySelector('.textLayer').replaceChildren();p.el.classList.remove('rendered');p.ready=false;}
    }
    if(current)this.onPage(current.number);
  }
  async render(p) {
    if(!p.viewport)return;
    const serial=p.serial,generation=this.generation,viewport=p.viewport;p.rendering=true;
    // Keep the previous painted frame visible until BOTH replacements are ready.
    const canvas=document.createElement('canvas'),dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.ceil(viewport.width*dpr);canvas.height=Math.ceil(viewport.height*dpr);
    try {
      p.task=p.page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[dpr,0,0,dpr,0,0]});await p.task.promise;
      const content=await (p.content??=p.page.getTextContent());if(serial!==p.serial||generation!==this.generation)return;
      const container=document.createElement('div');container.className='textLayer';
      container.style.setProperty('--scale-factor',viewport.scale);container.style.setProperty('--total-scale-factor',viewport.scale);
      p.text=new pdfjs.TextLayer({textContentSource:content,container,viewport});await p.text.render();
      p.text.textDivs.forEach((span,index)=>span.dataset.textIndex=index);
      if(serial!==p.serial||generation!==this.generation)return;
      p.el.querySelector('canvas').replaceWith(canvas);p.el.querySelector('.textLayer').replaceWith(container);
      p.ready=true;p.el.classList.add('rendered');
    } catch(e) {if(!['RenderingCancelledException','AbortException'].includes(e.name)) {p.el.querySelector('.page-placeholder').textContent='頁面載入失敗，請重新匯入 PDF';console.error(e);}}
    finally{p.rendering=false;if(serial!==p.serial&&generation===this.generation)this.schedule();}
  }
  go(number){const p=this.pages[number-1];if(p){this.scroll.scrollTop+=p.el.getBoundingClientRect().top-this.scroll.getBoundingClientRect().top-12;this.onPage(number);this.schedule();}}
}
