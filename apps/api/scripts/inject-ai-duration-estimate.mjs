import fs from 'node:fs';

const file=new URL('../src/server.ts',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const marker='// AI DURATION ESTIMATE V1';

if(!source.includes(marker)){
  const start=source.indexOf("app.post('/api/ai/task-list'");
  const end=source.indexOf('// ADMIN / DISPATCH',start);
  if(start<0||end<0)throw new Error('AI duration estimate: task-list route not found');
  let segment=source.slice(start,end);

  const systemRe=/\{role:'system',content:"((?:\\.|[^"\\])*)"\}/;
  const match=segment.match(systemRe);
  if(!match)throw new Error('AI duration estimate: system prompt not found');
  const decoded=JSON.parse(`"${match[1]}"`);
  const extra=`\n\nESTIMATION DE DURÉE\nRetourne aussi estimatedMinutes : une estimation réaliste du temps de travail actif nécessaire pour exécuter les tâches confirmées. Base-toi sur la catégorie, la sous-catégorie, l'ampleur, les quantités, l'accès, l'équipement et les contraintes réellement fournies. N'invente pas de travail supplémentaire. Donne un nombre entier de minutes, arrondi raisonnablement, minimum 15 et maximum 480. Pour une petite intervention simple, reste conservateur plutôt que de gonfler la durée.`;
  const enhanced=decoded.includes('ESTIMATION DE DURÉE')?decoded:decoded+extra;
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

  segment=marker+'\n'+segment;
  source=source.slice(0,start)+segment+source.slice(end);
}

fs.writeFileSync(file,source);
console.log('✓ AI duration estimate restored');
