import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';import path from 'node:path';
const endpoint='https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=zh-Hant&includeAlignment=true';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function createAzureService({directory,fetchImpl=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms))}){
 let tail=Promise.resolve(),next=0;
 const serial=fn=>{const job=tail.then(fn);tail=job.catch(()=>{});return job;};
 async function read(name,fallback){try{return JSON.parse(await readFile(path.join(directory,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw fail('本機翻譯設定無法讀取。',500);}}
 async function write(name,value){await mkdir(path.dirname(path.join(directory,name)),{recursive:true});await writeFile(path.join(directory,name),JSON.stringify(value),{mode:0o600});}
 async function usage(){const month=new Date().toISOString().slice(0,7),saved=await read('usage.json',{});return saved.month===month?saved:{month,characters:0};}
 async function status(){const config=await read('azure.json',null);return{configured:!!config,region:config?.region||'global',usage:await usage(),limit:2000000};}
 async function request(config,texts){
  const count=texts.reduce((n,t)=>n+t.length,0),meter=await usage();
  if(meter.characters+count>2000000)throw fail('本機本月已達 200 萬字保護上限，請下個月再試。',403);
  await pause(Math.max(0,next-Date.now()));next=Date.now()+Math.ceil(count/500)*1000;
  meter.characters+=count;await write('usage.json',meter);
  const headers={'Content-Type':'application/json','Ocp-Apim-Subscription-Key':config.key};if(config.region!=='global')headers['Ocp-Apim-Subscription-Region']=config.region;
  let response;try{response=await fetchImpl(endpoint,{method:'POST',headers,body:JSON.stringify(texts.map(Text=>({Text}))),signal:AbortSignal.timeout(25000)});}catch{throw fail('Azure 連線逾時或網路無法連線，請稍後重試。',503);}
  if(!response.ok){const messages={401:'Azure 金鑰無效，請重新設定。',403:'Azure 拒絕翻譯：請確認 F0 額度、資源及區域。',429:'Azure 暫時限制請求，請稍後按繼續翻譯。'};throw fail(messages[response.status]||'Azure 暫時無法翻譯，請稍後重試。',response.status>=500?503:response.status);}
  let data;try{data=await response.json();}catch{throw fail('Azure 回傳格式無法讀取。',502);}
  if(!Array.isArray(data)||data.length!==texts.length||data.some(x=>typeof x.translations?.[0]?.text!=='string'))throw fail('Azure 回傳翻譯不完整。',502);
  return data.map(x=>({translated:x.translations[0].text,alignment:typeof x.translations[0].alignment?.proj==='string'?x.translations[0].alignment.proj:''}));
 }
 return{status,configure:input=>serial(async()=>{
  if(input?.freeTierConfirmed!==true)throw fail('請先確認 Azure 資源採用 F0 免費層。');
  const key=String(input.key||'').trim(),region=String(input.region||'global').trim().toLowerCase();
  if(!/^[a-zA-Z0-9_-]{20,256}$/.test(key))throw fail('請輸入有效的 Azure 金鑰。');
  if(!/^[a-z0-9]{2,40}$/.test(region))throw fail('請輸入 Azure 區域代碼，例如 global 或 eastasia。');
  await request({key,region},['Hello.']);await write('azure.json',{key,region});return status();
 }),translate:input=>serial(async()=>{
  const texts=input?.texts;if(!Array.isArray(texts)||!texts.length||texts.length>100||texts.some(t=>typeof t!=='string'||!t.trim())||texts.reduce((n,t)=>n+t.length,0)>10000)throw fail('每次翻譯字數必須介於 1 至 10,000 字，最多 100 段。');
  const hash=createHash('sha256').update(JSON.stringify(['v1','en','zh-Hant',texts])).digest('hex'),name=`translations/${hash}.json`;
  const cached=await read(name,null);if(cached)return{results:cached,cached:true};
  const config=await read('azure.json',null);if(!config)throw fail('請先設定 Azure F0 金鑰。',409);
  const results=await request(config,texts);await write(name,results);return{results,cached:false};
 })};
}
