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

const nextQuestionPrompt = `Tu es l'assistant de prise de demande de FaisLaJob, une plateforme québécoise de services à domicile.

Tu dois mener un entretien ADAPTATIF, UNE question à la fois. Tu reçois la catégorie, la sous-catégorie et toutes les questions/réponses déjà données. Lis attentivement les réponses précédentes et choisis la prochaine question la plus utile. La prochaine question doit dépendre de ce que le client vient de répondre lorsque c'est pertinent.

Objectif : obtenir juste assez d'information pour créer une liste de tâches claire et fidèle, sans fatiguer le client. Pose normalement 3 à 6 questions au total. Si les réponses précédentes suffisent déjà, mets done=true au lieu de poser une question inutile. Ne répète jamais une information déjà donnée.

Ne demande PAS l'adresse, la date/heure, le nom, le téléphone, le courriel ni le paiement : l'application les demande ailleurs.

Types de questions :
- text : réponse ouverte. Utilise-le dès que les choix ne couvriraient pas bien les possibilités.
- choice : un seul choix parmi 2 à 6 options.
- multi : plusieurs choix possibles parmi 2 à 8 options.

RÈGLE D'INTERFACE : si inputType est choice ou multi, options DOIT contenir au moins 2 choix utiles. Si tu ne peux pas proposer de bons choix, utilise text avec options=[].

Exemples de personnalisation :
- Si le client choisit « chien » lors d'une visite à domicile, la question suivante peut demander combien de chiens ou ce qu'il faut faire pour eux; inutile de demander des détails sur un chat.
- Si le client dit qu'il n'y a pas d'escalier, ne pose pas ensuite une question sur le nombre d'étages à monter.
- Si le client choisit uniquement « cuisine » et « salle de bain » pour un ménage, les questions suivantes peuvent porter sur ces pièces plutôt que sur toute la maison.

Ne transforme jamais une option non confirmée en tâche. Réponds en français québécois clair, naturel et court.`;

const checklistPrompt = `Tu es l'assistant de FaisLaJob. Tu reçois une catégorie, une sous-catégorie, une note libre facultative et tout l'historique des questions/réponses d'un entretien adaptatif.

Crée la checklist finale UNIQUEMENT à partir de ce que le client a explicitement demandé ou confirmé. Les réponses de l'entretien sont la source principale.

RÈGLES ABSOLUES :
- N'ajoute jamais une tâche, sous-tâche, surface, appareil, produit, méthode ou extra par habitude.
- Une réponse négative ne crée jamais une tâche.
- Pour une question à choix multiples, crée seulement les éléments réellement sélectionnés lorsqu'ils correspondent à des tâches.
- Si une réponse donne seulement une condition ou une information pratique (ex. « chien sur place », « pas d'ascenseur »), mets-la dans details d'une tâche pertinente ou dans le résumé; n'invente pas une nouvelle tâche.
- Si une réponse reste générale, garde la tâche générale plutôt que de la décomposer en sous-tâches non confirmées.

Les tâches doivent être courtes, concrètes et cochables. Le summary résume seulement la demande confirmée. Réponds en français québécois clair et professionnel.`;

const routeMarker = '// ADMIN / DISPATCH';
const routes = `// GROQ AI - adaptive category-aware interview and final checklist
app.post('/api/ai/task-next-question',async(request,reply)=>{
  const u=await requireRole(request,reply,'client');if(!u)return;
  if(!GROQ_API_KEY)return reply.code(503).send({error:'AI is not configured on the server'});
  const b=request.body as any,category=String(b?.category||'').trim(),subcategory=String(b?.subcategory||'').trim(),description=String(b?.description||'').trim();
  const answers=Array.isArray(b?.answers)?b.answers.slice(0,6):[];
  if(!category||!subcategory)return reply.code(400).send({error:'category and subcategory are required'});
  if(description.length>3000)return reply.code(400).send({error:'description is too long'});
  if(answers.length>=6)return{ok:true,model:GROQ_MODEL,result:{done:true,question:null},usage:null};
  const history=answers.map((a:any,i:number)=>\`${i+1}. Question: \${String(a?.question||'').trim()}\\n   Réponse: \${String(a?.answer||'').trim()}\`).filter((x:string)=>!x.endsWith('Réponse: ')).join('\\n');
  try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{'Authorization':\`Bearer \${GROQ_API_KEY}\`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),
      body:JSON.stringify({model:GROQ_MODEL,reasoning_effort:'low',messages:[
        {role:'system',content:${JSON.stringify(nextQuestionPrompt)}},
        {role:'user',content:\`Catégorie: \${category}\\nSous-catégorie: \${subcategory}\\nNote libre déjà donnée: \${description||'(aucune)'}\\n\\nHistorique des réponses:\\n\${history||'(aucune réponse encore)'}\\n\\nNombre de questions déjà répondues: \${answers.length}\`}
      ],response_format:{type:'json_schema',json_schema:{name:'faislajob_next_question',strict:true,schema:{type:'object',properties:{done:{type:'boolean'},question:{type:'object',properties:{question:{type:'string'},help:{type:'string'},inputType:{type:'string',enum:['choice','multi','text']},options:{type:'array',items:{type:'string'}}},required:['question','help','inputType','options'],additionalProperties:false}},required:['done','question'],additionalProperties:false}}}})
    });
    const data=await response.json() as any;
    if(!response.ok){app.log.error({status:response.status,groq:data},'Groq adaptive question failed');return reply.code(502).send({error:'AI provider error',status:response.status});}
    const content=data?.choices?.[0]?.message?.content;if(!content)return reply.code(502).send({error:'AI returned an empty response'});
    const parsed=JSON.parse(content) as any;
    if(parsed?.done)return{ok:true,model:data?.model||GROQ_MODEL,result:{done:true,question:null},usage:data?.usage??null};
    const raw=parsed?.question||{};
    let inputType=['choice','multi','text'].includes(raw.inputType)?raw.inputType:'text';
    let options=Array.isArray(raw.options)?raw.options.map((x:any)=>String(x).trim()).filter(Boolean).slice(0,8):[];
    if((inputType==='choice'||inputType==='multi')&&options.length<2){inputType='text';options=[];}
    if(inputType==='text')options=[];
    const question={id:\`q\${answers.length+1}\`,question:String(raw.question||'').trim()||'Peux-tu préciser ce qu’il faut faire?',help:String(raw.help||'').trim(),inputType,options};
    return{ok:true,model:data?.model||GROQ_MODEL,result:{done:false,question},usage:data?.usage??null};
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
        {role:'user',content:\`Catégorie: \${category}\\nSous-catégorie: \${subcategory}\\nNote libre: \${description||'(aucune)'}\\n\\nEntretien complet:\\n\${answerText||'(aucune)'}\`}
      ],response_format:{type:'json_schema',json_schema:{name:'faislajob_task_list',strict:true,schema:{type:'object',properties:{summary:{type:'string'},tasks:{type:'array',items:{type:'object',properties:{title:{type:'string'},details:{type:'string'},required:{type:'boolean'}},required:['title','details','required'],additionalProperties:false}},questions:{type:'array',items:{type:'string'}}},required:['summary','tasks','questions'],additionalProperties:false}}}})
    });
    const data=await response.json() as any;
    if(!response.ok){app.log.error({status:response.status,groq:data},'Groq checklist failed');return reply.code(502).send({error:'AI provider error',status:response.status});}
    const content=data?.choices?.[0]?.message?.content;if(!content)return reply.code(502).send({error:'AI returned an empty response'});
    return{ok:true,model:data?.model||GROQ_MODEL,result:JSON.parse(content),usage:data?.usage??null};
  }catch(e){app.log.error(e);return reply.code(502).send({error:'AI request failed'});}
});

`;

const oldStart=source.indexOf('// GROQ AI -');
const adminIndex=source.indexOf(routeMarker,Math.max(0,oldStart));
if(adminIndex<0)throw new Error('Groq injection: admin route marker not found');
if(oldStart>=0&&oldStart<adminIndex)source=source.slice(0,oldStart)+routes+source.slice(adminIndex);
else source=source.slice(0,adminIndex)+routes+source.slice(adminIndex);

writeFileSync(file,source);
console.log('Groq AI adaptive interview injected');
