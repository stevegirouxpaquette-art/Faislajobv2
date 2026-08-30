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

const questionPrompt = `Tu es l'assistant de prise de demande de FaisLaJob, une plateforme québécoise de services à domicile.

Ton rôle ici est de préparer un petit entretien AVANT de créer la liste de tâches. Génère de 3 à 6 questions vraiment utiles selon la catégorie ET la sous-catégorie choisies. Les questions doivent aider à définir exactement la portée de la job, le matériel ou les conditions qui changent le travail.

Ne demande PAS l'adresse, le moment désiré, le nom, le téléphone, le courriel ni le mode de paiement : l'application les demande ailleurs. Ne pose pas de questions inutiles ou répétitives. Ne présume jamais qu'un extra est demandé.

Exemples de logique :
- Ménage / ménage régulier : quelles pièces, quelles surfaces ou tâches le client veut réellement, produits fournis ou non, particularités pertinentes.
- Déneigement / entrée : type et taille approximative de l'entrée, zones à faire, accumulation ou particularités.
- Déménagement / chargement : quels objets, étages, ascenseur, aide ou équipement pertinent.
- Animaux / promenade : type/nombre d'animaux, durée souhaitée, particularités utiles.

Préfère une question à choix lorsque 2 à 6 réponses simples couvrent bien le besoin. Utilise une question texte lorsque la réponse doit être libre. Les choix doivent être courts et compréhensibles au Québec. Réponds en français québécois clair et professionnel.`;

const checklistPrompt = `Tu es l'assistant de FaisLaJob. Tu reçois une catégorie, une sous-catégorie, une description facultative et les réponses données par le client à un entretien.

RÈGLE ABSOLUE : crée la checklist UNIQUEMENT à partir de ce que le client a explicitement demandé ou confirmé dans ses réponses. N'ajoute jamais une tâche, sous-tâche, surface, appareil, produit, méthode ou extra par habitude.

Les réponses de l'entretien sont la source principale pour préciser la portée. Si le client confirme plusieurs éléments distincts, crée des tâches distinctes et cochables. Si le client demande simplement « nettoyer la salle de bain » sans détailler les éléments, garde une tâche « Nettoyer la salle de bain » plutôt que d'inventer baignoire, douche, toilette, etc.

Le champ details peut reformuler une précision confirmée par le client, mais ne doit jamais élargir la portée. Le summary résume seulement la demande confirmée. Réponds en français québécois clair et professionnel.`;

const routeMarker = '// ADMIN / DISPATCH';
const routes = `// GROQ AI - category-aware client intake and final checklist
app.post('/api/ai/task-questions',async(request,reply)=>{
  const u=await requireRole(request,reply,'client');if(!u)return;
  if(!GROQ_API_KEY)return reply.code(503).send({error:'AI is not configured on the server'});
  const b=request.body as any,category=String(b?.category||'').trim(),subcategory=String(b?.subcategory||'').trim(),description=String(b?.description||'').trim();
  if(!category||!subcategory)return reply.code(400).send({error:'category and subcategory are required'});
  if(description.length>3000)return reply.code(400).send({error:'description is too long'});
  try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Authorization':\`Bearer \${GROQ_API_KEY}\`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),
      body:JSON.stringify({model:GROQ_MODEL,reasoning_effort:'low',messages:[
        {role:'system',content:${JSON.stringify(questionPrompt)}},
        {role:'user',content:\`Catégorie: \${category}\\nSous-catégorie: \${subcategory}\\nPrécision libre déjà donnée (peut être vide): \${description||'(aucune)'}\`}
      ],response_format:{type:'json_schema',json_schema:{name:'faislajob_intake_questions',strict:true,schema:{type:'object',properties:{questions:{type:'array',minItems:3,maxItems:6,items:{type:'object',properties:{id:{type:'string'},question:{type:'string'},help:{type:'string'},inputType:{type:'string',enum:['choice','text']},options:{type:'array',items:{type:'string'}}},required:['id','question','help','inputType','options'],additionalProperties:false}}},required:['questions'],additionalProperties:false}}}})
    });
    const data=await response.json() as any;
    if(!response.ok){app.log.error({status:response.status,groq:data},'Groq intake questions failed');return reply.code(502).send({error:'AI provider error',status:response.status});}
    const content=data?.choices?.[0]?.message?.content;if(!content)return reply.code(502).send({error:'AI returned an empty response'});
    return{ok:true,model:data?.model||GROQ_MODEL,result:JSON.parse(content),usage:data?.usage??null};
  }catch(e){app.log.error(e);return reply.code(502).send({error:'AI request failed'});}
});

app.post('/api/ai/task-list',async(request,reply)=>{
  const u=await requireRole(request,reply,'client');if(!u)return;
  if(!GROQ_API_KEY)return reply.code(503).send({error:'AI is not configured on the server'});
  const b=request.body as any,category=String(b?.category||'').trim(),subcategory=String(b?.subcategory||'').trim(),description=String(b?.description||'').trim();
  const answers=Array.isArray(b?.answers)?b.answers.slice(0,12):[];
  if(!category||!subcategory)return reply.code(400).send({error:'category and subcategory are required'});
  if(description.length>3000)return reply.code(400).send({error:'description is too long'});
  if(!description&&answers.length===0)return reply.code(400).send({error:'client answers are required'});
  const answerText=answers.map((a:any,i:number)=>\`\${i+1}. \${String(a?.question||'').trim()} => \${String(a?.answer||'').trim()}\`).filter((x:string)=>!x.endsWith('=> ')).join('\\n');
  try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Authorization':\`Bearer \${GROQ_API_KEY}\`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),
      body:JSON.stringify({model:GROQ_MODEL,reasoning_effort:'low',messages:[
        {role:'system',content:${JSON.stringify(checklistPrompt)}},
        {role:'user',content:\`Catégorie: \${category}\\nSous-catégorie: \${subcategory}\\nPrécision libre: \${description||'(aucune)'}\\n\\nRéponses confirmées par le client:\\n\${answerText||'(aucune)'}\`}
      ],response_format:{type:'json_schema',json_schema:{name:'faislajob_task_list',strict:true,schema:{type:'object',properties:{summary:{type:'string'},tasks:{type:'array',items:{type:'object',properties:{title:{type:'string'},details:{type:'string'},required:{type:'boolean'}},required:['title','details','required'],additionalProperties:false}},questions:{type:'array',items:{type:'string'}}},required:['summary','tasks','questions'],additionalProperties:false}}}})
    });
    const data=await response.json() as any;
    if(!response.ok){app.log.error({status:response.status,groq:data},'Groq checklist failed');return reply.code(502).send({error:'AI provider error',status:response.status});}
    const content=data?.choices?.[0]?.message?.content;if(!content)return reply.code(502).send({error:'AI returned an empty response'});
    return{ok:true,model:data?.model||GROQ_MODEL,result:JSON.parse(content),usage:data?.usage??null};
  }catch(e){app.log.error(e);return reply.code(502).send({error:'AI request failed'});}
});

`;

// Replace an older Groq block if it was already injected on the server; otherwise insert it.
const oldStart=source.indexOf('// GROQ AI -');
const adminIndex=source.indexOf(routeMarker,Math.max(0,oldStart));
if(adminIndex<0)throw new Error('Groq injection: admin route marker not found');
if(oldStart>=0&&oldStart<adminIndex)source=source.slice(0,oldStart)+routes+source.slice(adminIndex);
else source=source.slice(0,adminIndex)+routes+source.slice(adminIndex);

writeFileSync(file,source);
console.log('Groq AI category-aware intake injected');
