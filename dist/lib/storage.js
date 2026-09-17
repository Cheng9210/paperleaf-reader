const prefix='paperleaf:v1:';
export function readDocument(key){const raw=localStorage.getItem(prefix+key);if(!raw)return{notes:{quotes:[]},annotations:[]};const value=JSON.parse(raw);if(value.version!==1||!value.notes||!Array.isArray(value.annotations))throw new Error('筆記格式無法讀取');return value;}
export function saveDocument(key,value){localStorage.setItem(prefix+key,JSON.stringify({version:1,notes:value.notes,annotations:value.annotations}));}
