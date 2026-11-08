import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createAzureService} from './azure-service.mjs';import {createReaderServer} from './http-server.mjs';
import {createGeminiService} from './gemini-service.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),port=Number(process.env.PORT)||4173;
createReaderServer({root:path.join(project,'dist'),azureService:createAzureService({directory:path.join(project,'.local')}),geminiService:createGeminiService({directory:path.join(project,'.local'),model:'gemini-3.5-flash-lite'})}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
