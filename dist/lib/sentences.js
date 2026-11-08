// Keep source offsets so repeated words and sentences cannot select another occurrence.
export function sentenceUnits(text){
 const segments=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)];
 const units=[];
 for(const {segment,index} of segments){const start=index+segment.length-segment.trimStart().length,end=index+segment.trimEnd().length;if(end>start)units.push({text:text.slice(start,end),start,end});}
 return units;
}
export function joinSentenceTranslations(units,results){
 let translated='';const alignment=[],sentences=[];
 units.forEach((unit,i)=>{
  const result=results[i],targetStart=translated.length;translated+=result.translated;
  sentences.push({start:unit.start,end:unit.end,targetStart,targetEnd:translated.length});
  for(const match of (result.alignment||'').matchAll(/(\d+):(\d+)-(\d+):(\d+)/g)){
   const [,a,b,c,d]=match.map(Number);
   if(a<=b&&b<unit.text.length&&c<=d&&d<result.translated.length)alignment.push(`${a+unit.start}:${b+unit.start}-${c+targetStart}:${d+targetStart}`);
  }
 });
 return {translated,alignment:alignment.join(' '),sentences};
}
