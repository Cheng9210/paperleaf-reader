import {untranslatedEnglish} from './translation-quality.js';
// Schema version changes whenever extraction geometry or alignment changes.
const VERSION=2;
export class TranslationStore {
 constructor(indexedDB=globalThis.indexedDB){this.indexedDB=indexedDB;this.memory=new Map();this.persistent=!!indexedDB;}
 async database(){
  if(!this.indexedDB)return null;
  if(!this.opening)this.opening=new Promise(resolve=>{let request;try{request=this.indexedDB.open('paperleaf-translations',1);}catch{this.persistent=false;resolve(null);return;}request.onupgradeneeded=()=>request.result.createObjectStore('papers');request.onsuccess=()=>resolve(request.result);request.onerror=request.onblocked=()=>{this.persistent=false;resolve(null);};});
  return this.opening;
 }
 async load(key){
  const db=await this.database();let value=this.memory.get(key);
  if(db)try{value=await new Promise((resolve,reject)=>{const request=db.transaction('papers').objectStore('papers').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}catch{this.persistent=false;}
  const records=value?.version===VERSION?new Map(structuredClone(value.pages)):new Map();
  for(const record of records.values())for(const block of record.blocks){if(untranslatedEnglish(block.text,block.translated)){delete block.translated;delete block.alignment;delete block.sentences;record.done=false;}}
  return records;
 }
 async save(key,records){
  const value={version:VERSION,pages:structuredClone([...records].map(([page,record])=>[page,{blocks:record.blocks,done:record.done,width:record.width,height:record.height}]))};this.memory.set(key,value);
  const db=await this.database();if(!db)return false;
  try{await new Promise((resolve,reject)=>{const tx=db.transaction('papers','readwrite');tx.objectStore('papers').put(value,key);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});return true;}catch{this.persistent=false;return false;}
 }
}
