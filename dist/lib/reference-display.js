export function displayTranslation(block,next){
 const translated=block?.translated;
 if(typeof translated!=='string'||!next?.translated||!/[\u3400-\u9fff]/u.test(next.translated)||translated.trim()!==block.text?.trim())return translated;
 const match=translated.match(/^(\d+)\s+([\p{L}¨'’-]+),?\s+([A-Z](?:\s+[A-Z])?)/u);
 return match?`${match[1]} ${match[2]}，${match[3].replaceAll(' ','·')} 等` :translated;
}
