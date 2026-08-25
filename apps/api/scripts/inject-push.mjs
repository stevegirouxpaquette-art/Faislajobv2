import fs from 'node:fs';

const file=new URL('../src/server.ts',import.meta.url);
let src=fs.readFileSync(file,'utf8');
const importNeedle="import { createPool } from './db.js';";

if(!src.includes(importNeedle))throw new Error('Push injection failed: db import not found');

if(!src.includes("from './push.js'")){
  src=src.replace(importNeedle,`${importNeedle}\nimport { registerPushRoutes } from './push.js';`);
}

if(!src.includes('registerPushRoutes(app,pool,currentUser)')){
  const startup=/initializeDatabase\(\)\.then\(\(\)=>app\.listen\(\{port,host\}\)\)\.catch\(error=>\{app\.log\.error\(error\);process\.exit\(1\)\}\);?/;
  if(!startup.test(src))throw new Error('Push injection failed: API startup sequence not found');
  src=src.replace(startup,"initializeDatabase().then(async()=>{await registerPushRoutes(app,pool,currentUser);return app.listen({port,host})}).catch(error=>{app.log.error(error);process.exit(1)});");
}

fs.writeFileSync(file,src);
console.log('✓ web push routes wired into API source');
