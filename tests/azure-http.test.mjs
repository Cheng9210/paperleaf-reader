import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';
import {createReaderServer} from '../scripts/http-server.mjs';
import http from 'node:http';
test('split UTF-8 network chunks retain source text and offsets',async t=>{
 let received;const server=createReaderServer({root:path.resolve('dist'),azureService:{translate:async input=>{received=input;return{results:[]};}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const source={texts:['café ∑ attention']},body=Buffer.from(JSON.stringify(source)),split=body.indexOf(Buffer.from('é'))+1;
 await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,path:'/api/translate',method:'POST',headers:{'Content-Type':'application/json','X-Paperleaf-Request':'1'}},res=>{res.resume();res.on('end',resolve);});req.on('error',reject);req.write(body.subarray(0,split));setTimeout(()=>req.end(body.subarray(split)),20);});
 assert.deepEqual(received,source);
});
test('local API rejects cross-origin calls and never serves private configuration',async t=>{
 const server=createReaderServer({root:path.resolve('dist'),azureService:{status:async()=>({configured:false}),translate:async()=>({results:[]})}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/api/azure/status')).status,403);
 assert.equal((await fetch(base+'/api/azure/status',{headers:{'X-Paperleaf-Request':'1',Origin:'https://untrusted.example'}})).status,403);
 const response=await fetch(base+'/api/azure/status',{headers:{'X-Paperleaf-Request':'1'}});assert.deepEqual(await response.json(),{configured:false});
 assert.equal((await fetch(base+'/.local/azure.json')).status,403);
 assert.equal((await fetch(base+'/api/translate',{method:'POST',headers:{'X-Paperleaf-Request':'1','Content-Type':'application/json'},body:'invalid'})).status,400);
});
