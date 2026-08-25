import fs from 'node:fs';

const file=new URL('../dist/server.js',import.meta.url);
let src=fs.readFileSync(file,'utf8');
const importNeedle="import { createPool } from './db.js';";
const initNeedle='await initializeDatabase();';
if(!src.includes(importNeedle))throw new Error('Push injection failed: db import not found');
if(!src.includes(initNeedle))throw new Error('Push injection failed: database initialization not found');
if(!src.includes("from './push.js'"))src=src.replace(importNeedle,`${importNeedle}\nimport { registerPushRoutes } from './push.js';`);
if(!src.includes('registerPushRoutes(app, pool, currentUser)'))src=src.replace(initNeedle,`${initNeedle}\nawait registerPushRoutes(app, pool, currentUser);`);
fs.writeFileSync(file,src);
console.log('✓ web push routes wired into API build');
