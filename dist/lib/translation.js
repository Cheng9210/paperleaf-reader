import {demoPages,glossary} from './demo.js';
import {escapeHtml} from './core.js';

const terms = {
  'attention mechanisms':'注意力機制', 'attention mechanism':'注意力機制',
  'sequence models':'序列模型','sequence model':'序列模型',
  'input sequence':'輸入序列','random seeds':'隨機種子','training examples':'訓練樣本',
  'evaluation set':'評估資料集','causal explanation':'因果解釋',
  'query':'查詢','keys':'鍵','values':'值',
  'word':'單字','words':'單字','sentence':'句子','sentences':'句子',
  'input':'輸入','positions':'位置','experiment':'實驗','context':'上下文',
  'evidence':'證據','claim':'主張','claims':'主張','reader':'讀者',
  'pronoun':'代名詞','subject':'主詞','information':'資訊',
  'representations':'表示','representation':'表示','weights':'權重','weight':'權重',
  'attention':'注意力','model':'模型','models':'模型','accuracy':'準確率',
};

export function renderTranslation(page,isDemo) {
  const container=document.querySelector('#translation-content');
  if (!isDemo) {
    container.innerHTML='<div class="translation-notice">翻譯服務尚未啟用</div><div class="empty-translation"><h2>翻譯待啟用</h2><p>目前可閱讀原文與做筆記。<br>接上翻譯服務後，這裡會顯示譯文。</p></div>';
    return;
  }
  const d=demoPages[page-1];
  container.innerHTML=`<div class="translation-notice">示範譯文 · 第 ${page} 頁</div><h1>${['注意力與學習','從直覺走向實驗','先讀證據，再問為什麼'][page-1]}</h1>${d.sections.map(s=>`<h2>${s.zhHeading}</h2><p class="translated-block" id="translation-${s.id}">${s.zh}</p>`).join('')}`;
}

export function resolveDemoAlignment(text,page,context='') {
  const key=text.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g,'').replace(/\s+/g,' ');
  const target=terms[key] || glossary[key]?.[0];
  if (!target) return null;
  const sections=demoPages[page-1]?.sections || [];
  const normal=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
  const current=sections.find(s=>context && normal(s.text).includes(normal(context)));
  const candidates=current?[current]:sections;
  const section=candidates.find(s=>new RegExp('\\b'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(s.text)&&s.zh.includes(target));
  if (!section) return null;
  const start=section.zh.indexOf(target);
  return {sectionId:section.id,target,start,end:start+target.length};
}

export function clearTranslationSelection() {
  document.querySelectorAll('#translation-content mark').forEach(mark=>mark.replaceWith(mark.textContent));
}
export function alignTranslation(text,page,context) {
  clearTranslationSelection();
  const match=resolveDemoAlignment(text,page,context);
  if (!match) return false;
  const element=document.querySelector('#translation-'+match.sectionId);
  if (!element) return false;
  const content=element.textContent;
  element.innerHTML=escapeHtml(content.slice(0,match.start))+'<mark>'+escapeHtml(content.slice(match.start,match.end))+'</mark>'+escapeHtml(content.slice(match.end));
  const mark=element.querySelector('mark'),scroller=document.querySelector('#translation-content');
  const r=mark.getBoundingClientRect(),bounds=scroller.getBoundingClientRect();
  if(r.top<bounds.top||r.bottom>bounds.bottom)scroller.scrollBy({top:r.top-bounds.top-bounds.height*.35,behavior:'smooth'});
  return true;
}
