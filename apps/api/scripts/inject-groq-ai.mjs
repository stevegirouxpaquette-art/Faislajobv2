import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/server.ts', import.meta.url);
let source = readFileSync(file, 'utf8');

const configMarker = "const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';";
const configBlock = `${configMarker}\nconst GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';\nconst GROQ_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b';`;
if (!source.includes('const GROQ_API_KEY =')) {
  if (!source.includes(configMarker)) throw new Error('Groq injection: config marker not found');
  source = source.replace(configMarker, configBlock);
}

const healthOld = "adminConfigured:Boolean(ADMIN_TOKEN)}}catch(e)";
const healthNew = "adminConfigured:Boolean(ADMIN_TOKEN),aiConfigured:Boolean(GROQ_API_KEY),aiModel:GROQ_MODEL}}catch(e)";
if (!source.includes('aiConfigured:Boolean(GROQ_API_KEY)')) {
  if (!source.includes(healthOld)) throw new Error('Groq injection: health marker not found');
  source = source.replace(healthOld, healthNew);
}

const routeMarker = '// ADMIN / DISPATCH';
const routeBlock = `// GROQ AI - turn a client's description into a structured task checklist\napp.post('/api/ai/task-list',async(request,reply)=>{\n  const u=await requireRole(request,reply,'client');if(!u)return;\n  if(!GROQ_API_KEY)return reply.code(503).send({error:'AI is not configured on the server'});\n  const b=request.body as any,description=String(b?.description||'').trim(),category=String(b?.category||'General').trim();\n  if(description.length<3)return reply.code(400).send({error:'description is required'});\n  if(description.length>4000)return reply.code(400).send({error:'description is too long'});\n  try{\n    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{\n      method:'POST',\n      headers:{'Authorization':\`Bearer \${GROQ_API_KEY}\`,'Content-Type':'application/json'},\n      signal:AbortSignal.timeout(20000),\n      body:JSON.stringify({\n        model:GROQ_MODEL,\n        reasoning_effort:'low',\n        messages:[\n          {role:'system',content:\`Tu es l'assistant de FaisLaJob, une plateforme québécoise de petits travaux et services à domicile. À partir de la demande du client, prépare une checklist claire pour le prestataire. N'invente pas de travaux importants qui n'ont pas été demandés. Les tâches doivent être courtes, concrètes et cochables. Si une information essentielle manque pour bien définir la mission, ajoute-la dans questions. Réponds en français québécois clair et professionnel.\`},\n          {role:'user',content:\`Catégorie: \${category}\\nDemande du client: \${description}\`}\n        ],\n        response_format:{\n          type:'json_schema',\n          json_schema:{\n            name:'faislajob_task_list',\n            strict:true,\n            schema:{\n              type:'object',\n              properties:{\n                summary:{type:'string'},\n                tasks:{type:'array',items:{type:'object',properties:{title:{type:'string'},details:{type:'string'},required:{type:'boolean'}},required:['title','details','required'],additionalProperties:false}},\n                questions:{type:'array',items:{type:'string'}}\n              },\n              required:['summary','tasks','questions'],\n              additionalProperties:false\n            }\n          }\n        }\n      })\n    });\n    const data=await response.json() as any;\n    if(!response.ok){app.log.error({status:response.status,groq:data},'Groq request failed');return reply.code(502).send({error:'AI provider error',status:response.status});}\n    const content=data?.choices?.[0]?.message?.content;\n    if(!content)return reply.code(502).send({error:'AI returned an empty response'});\n    const result=JSON.parse(content);\n    return{ok:true,model:data?.model||GROQ_MODEL,result,usage:data?.usage??null};\n  }catch(e){app.log.error(e);return reply.code(502).send({error:'AI request failed'});}\n});\n\n${routeMarker}`;

if (!source.includes("app.post('/api/ai/task-list'")) {
  if (!source.includes(routeMarker)) throw new Error('Groq injection: route marker not found');
  source = source.replace(routeMarker, routeBlock);
}

writeFileSync(file, source);
console.log('Groq AI integration injected');
