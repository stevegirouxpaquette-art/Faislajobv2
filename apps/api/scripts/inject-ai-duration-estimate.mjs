import fs from 'node:fs';

const file=new URL('../src/server.ts',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const marker='// AI DURATION ESTIMATE V2';

if(!source.includes(marker)){
  const start=source.indexOf("app.post('/api/ai/task-list'");
  const end=source.indexOf('// ADMIN / DISPATCH',start);
  if(start<0||end<0)throw new Error('AI duration estimate: task-list route not found');
  let segment=source.slice(start,end);

  const helper=`
function parseFrenchNumberForEstimate(raw:any){
  let s=String(raw??'').replace(/\\u00a0/g,' ').trim().replace(/\\s+/g,'');
  if(!s)return null;
  const commas=(s.match(/,/g)||[]).length,dots=(s.match(/\\./g)||[]).length;
  if(commas===1&&/\\,\\d{1,2}$/.test(s))s=s.replace(',','.');
  else if(commas>0&&dots===0)s=s.replace(/,/g,'');
  else if(dots>1)s=s.replace(/\\./g,'');
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}
function extractEstimateQuantities(category:string,subcategory:string,description:string,answers:any[]){
  const text=[category,subcategory,description,...answers.map((a:any)=>String(a?.question||'')+' '+String(a?.answer||''))].join(' ');
  const quantities:{kind:string;value:number;unit:string;raw:string}[]=[];
  const patterns:[string,RegExp][]=[
    ['area',/(\\d[\\d\\s.,]*)\\s*(pi\\s*(?:2|²)|p2|pieds?\\s*carr(?:e|é|és|ées)?|pc|ft2|sq\\.?\\s*ft|m\\s*(?:2|²)|m2|mètres?\\s*carr(?:e|é|és|ées)?)/gi],
    ['saltKg',/(\\d[\\d\\s.,]*)\\s*(?:kg|kilogrammes?)(?=\\s*(?:de\\s*)?(?:sel|abrasif|granul[ée]))/gi],
    ['snowCm',/(\\d[\\d\\s.,]*)\\s*(?:cm|centim(?:è|e)tre?s?)(?=\\s*(?:de\\s*)?(?:neige|accumulation))?/gi],
    ['count',/(\\d[\\d\\s.,]*)\\s+(?:cadres?|fen[êe]tres?|portes?|marches?|escaliers?|pi[èe]ces?|arbres?|arbustes?|bo[îi]tes?|meubles?|objets?)/gi]
  ];
  for(const [kind,re] of patterns){for(const m of text.matchAll(re)){const value=parseFrenchNumberForEstimate(m[1]);if(value!=null)quantities.push({kind,value,unit:m[2]||'',raw:m[0]})}}
  return quantities;
}
function validateEstimateInputs(category:string,subcategory:string,description:string,answers:any[]){
  const quantities=extractEstimateQuantities(category,subcategory,description,answers),warnings:string[]=[];
  const areas=quantities.filter(q=>q.kind==='area');
  const snowAreas=areas.filter(q=>/m|p2|pi|ft|pied|pc|sq/i.test(q.unit));
  for(const q of snowAreas){
    if(q.value>=1000000)warnings.push(`La superficie indiquée (${q.raw.trim()}) est extrêmement élevée. Vérifie la superficie avant de continuer.`);
    else if(q.value>=100000&&/déneig|deneig|neige/i.test(category+' '+subcategory))warnings.push(`La superficie indiquée (${q.raw.trim()}) est très élevée pour ce type de service. Vérifie la superficie avant de continuer.`);
    else if(q.value>=20000&&/entrée|entree|escalier|résident|resident|maison|domicile/i.test(subcategory+' '+description))warnings.push(`La superficie indiquée (${q.raw.trim()}) semble élevée pour une intervention résidentielle. Vérifie la superficie avant de continuer.`);
  }
  const salt=quantities.find(q=>q.kind==='saltKg');
  const largestArea=areas.reduce((max,q)=>Math.max(max,q.value),0);
  if(salt&&largestArea>=10000&&salt.value<=40&&/déneig|deneig|neige/i.test(category+' '+subcategory))warnings.push(`La combinaison ${largestArea.toLocaleString('fr-CA')} pi² et ${salt.value} kg de sel semble incohérente. Vérifie les quantités avant de continuer.`);
  for(const q of quantities.filter(q=>q.kind==='count'))if(q.value>=10000)warnings.push(`La quantité indiquée (${q.raw.trim()}) est très élevée. Vérifie la quantité avant de continuer.`);
  const hardWarnings=warnings.filter(w=>/extrêmement|incohérente|très élevée|semble élevée/i.test(w));
  return{quantities,warnings,hardWarnings};
}
`;
  if(!segment.includes('function parseFrenchNumberForEstimate'))segment=helper+segment;

  const systemRe=/\{role:'system',content:"((?:\\.|[^"\\])*)"\}/;
  const match=segment.match(systemRe);
  if(!match)throw new Error('AI duration estimate: system prompt not found');
  const decoded=JSON.parse(`"${match[1]}"`);
  const extra=`\n\nESTIMATION DE DURÉE — RÈGLES STRICTES\nRetourne aussi estimatedMinutes : une estimation réaliste du temps de travail actif nécessaire pour exécuter les tâches confirmées.\n1. Extrais et respecte TOUS les nombres et unités fournis par le client : superficie, quantité, nombre d'objets, profondeur de neige, kg de sel/abrasif, nombre d'animaux, etc.\n2. Une quantité importante doit avoir un impact réel sur la durée. Ne donne jamais la même durée à 500 pi² et 10 000 pi² sans justification.\n3. Pour le déneigement, tiens compte de la superficie, de la quantité de neige, des escaliers/obstacles et de l'équipement réellement mentionné (pelle, souffleuse, etc.).\n4. N'invente jamais d'équipement. Si l'équipement n'est pas précisé, reste prudent.\n5. Vérifie la cohérence entre les quantités avant de produire l'estimation. Si les données sont manifestement aberrantes, estimatedMinutes doit rester absent du résultat uniquement si le système de validation n'a pas déjà bloqué la demande.\n6. Donne un nombre entier de minutes, minimum 15 et maximum 480. Pour une petite intervention simple, reste conservateur plutôt que de gonfler la durée.\n7. Le résumé doit mentionner les quantités importantes quand elles sont pertinentes, sans recopier les questions du client.`;
  const enhanced=decoded.includes('ESTIMATION DE DURÉE — RÈGLES STRICTES')?decoded:decoded+extra;
  segment=segment.replace(match[0],`{role:'system',content:${JSON.stringify(enhanced)}}`);

  if(!segment.includes("estimatedMinutes:{type:'integer'")){
    segment=segment.replace(
      "properties:{summary:{type:'string'},tasks:",
      "properties:{summary:{type:'string'},estimatedMinutes:{type:'integer',minimum:15,maximum:480},tasks:"
    );
    segment=segment.replace(
      "required:['summary','tasks','questions']",
      "required:['summary','estimatedMinutes','tasks','questions']"
    );
  }

  const resultLine="const result=JSON.parse(content);return{ok:true,model:data?.model||GROQ_MODEL,result,usage:data?.usage??null};";
  const guardedResult=`const result=JSON.parse(content);const validation=validateEstimateInputs(category,subcategory,description,answers);if(validation.hardWarnings.length)return reply.code(422).send({error:validation.hardWarnings[0],warnings:validation.warnings,quantities:validation.quantities});return{ok:true,model:data?.model||GROQ_MODEL,result:{...result,validationWarnings:validation.warnings},usage:data?.usage??null};`;
  if(segment.includes(resultLine))segment=segment.replace(resultLine,guardedResult);
  else if(!segment.includes('validationWarnings:validation.warnings'))throw new Error('AI duration estimate: task-list result line not found');

  segment=marker+'\n'+segment;
  source=source.slice(0,start)+segment+source.slice(end);
}

fs.writeFileSync(file,source);
console.log('✓ estimation IA renforcée + contrôle de cohérence des quantités');
