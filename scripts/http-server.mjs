import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';
export function createReaderServer({root,azureService,geminiService}){
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.pdf':'application/pdf','.wasm':'application/wasm','.ttf':'font/ttf','.mjs':'text/javascript'};
 return http.createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))return json(403,{error:'僅限本機使用。'});
   const url=new URL(req.url,`http://${req.headers.host}`);
   if(url.pathname.startsWith('/api/')){
    if(req.headers['x-paperleaf-request']!=='1'||(req.headers.origin&&req.headers.origin!==url.origin))return json(403,{error:'請從本機閱讀網站操作。'});
    if(req.method==='GET'&&url.pathname==='/api/azure/status')return json(200,await azureService.status());
    if(req.method==='GET'&&url.pathname==='/api/gemini/status'&&geminiService)return json(200,await geminiService.status());
    if(req.method!=='POST'||!['/api/azure/config','/api/translate','/api/gemini/config','/api/gemini/translate','/api/gemini/ocr'].includes(url.pathname))return json(404,{error:'找不到服務。'});
    if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'需要 JSON 資料。'});
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(url.pathname.endsWith('/ocr')?6100000:150000))return json(413,{error:'資料過大。'});chunks.push(chunk);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(400,{error:'資料格式錯誤。'});}
    if(url.pathname.startsWith('/api/gemini/')){if(!geminiService)return json(503,{error:'請重新啟動網站以啟用 Gemini。'});return json(200,await(url.pathname.endsWith('/config')?geminiService.configure(input):url.pathname.endsWith('/ocr')?geminiService.ocr(input):geminiService.translate(input)));}
    return json(200,await (url.pathname==='/api/translate'?azureService.translate(input):azureService.configure(input)));
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'不支援此操作。'});
   const pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(root,'.'+pathname);
   if(!file.startsWith(root+path.sep)||pathname.split(/[\\/]/).some(x=>x.startsWith('.')))return json(403,{error:'禁止存取。'});
   const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  }catch(e){json(e.status||500,{error:e.status?e.message:e.code==='ENOENT'?'找不到檔案。':'本機服務發生錯誤。'});}
 });
}
