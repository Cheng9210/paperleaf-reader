import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await copyFile('node_modules/pdfjs-dist/build/'+name,'dist/vendor/'+name);
await copyFile('node_modules/pdfjs-dist/web/pdf_viewer.css','dist/vendor/pdf_viewer.css');
await copyFile('node_modules/pdf-lib/dist/pdf-lib.min.js','dist/vendor/pdf-lib.min.js');
for(const name of ['cmaps','standard_fonts','wasm'])await cp('node_modules/pdfjs-dist/'+name,'dist/vendor/'+name,{recursive:true});
await copyFile('node_modules/pdfjs-dist/LICENSE','dist/vendor/PDFJS-LICENSE');await copyFile('node_modules/pdf-lib/LICENSE.md','dist/vendor/PDFLIB-LICENSE.md');
console.log('Browser PDF assets ready');
