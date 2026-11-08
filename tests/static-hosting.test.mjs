import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('published assets resolve below a GitHub Pages repository path',async()=>{
 for(const file of ['dist/index.html','dist/app.js','dist/reader.css','dist/lib/pdf.js','dist/lib/continuous-pdf.js']){
  const source=await readFile(file,'utf8');
  assert.doesNotMatch(source,/(?:src|href)="\/(?:app|vendor|styles|reader|theme)|fetch\('\/demo\.pdf'\)|url\('\/fonts|(?:workerSrc|cMapUrl|standardFontDataUrl|wasmUrl)\s*[:=]\s*'\/vendor/);
 }
});

test('reader selects browser Gemini on GitHub Pages',async()=>{
 const source=await readFile('dist/lib/azure-reader.js','utf8');
 assert.match(source,/createBrowserGemini/);
 assert.match(source,/github\.io/);
});
