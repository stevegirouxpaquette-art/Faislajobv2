import fs from 'node:fs';

const file=new URL('../dist/server.js',import.meta.url);
let src=fs.readFileSync(file,'utf8');
const importNeedle="import { createPool } from './db.js';";
const startupNeedle="initializeDatabase().then(()=>app.listen({port,host}))";

if(!src.includes(importNeedle))throw new Error('Push injection failed: db import not found');
if(!src.includes(startupNeedle))throw new Error('Push injection failed: API startup sequence not found');

if(!src.includes("from './push.js'")){
  src=src.replace(importNeedle,`${importNeedle}\nimport { registerPushRoutes } from './push.js';`);
}

if(!src.includes('await registerPushRoutes(app,pool,currentUser)')){
  src=src.replace(
    startupNeedle,
    "initializeDatabase().then(async()=>{await registerPushRoutes(app,pool,currentUser);return app.listen({port,host})})"
  );
}

fs.writeFileSync(file,src);
console.log('✓ web push routes wired into API build');
