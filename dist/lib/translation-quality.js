// Long English passages without any Chinese are not completed Chinese translations.
export function untranslatedEnglish(source,target){
 if(typeof source==='string'&&typeof target==='string'&&source.trim()===target.trim()&&source.length<=80&&/^(?:\d+\s+)?[A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){2,}$/.test(source.trim()))return true;
 return typeof target==='string'&&(source.match(/[A-Za-z]{2,}/g)||[]).length>=6&&
  (target.match(/[A-Za-z]{2,}/g)||[]).length>=6&&!/[\u3400-\u9fff]/u.test(target);
}
