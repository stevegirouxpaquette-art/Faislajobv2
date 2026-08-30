import fs from 'node:fs';

const file=new URL('../src/RequestFlow.tsx',import.meta.url);
let source=fs.readFileSync(file,'utf8');

source=source.replaceAll(
 `<input value={task.title} aria-label={\`Titre de la tâche \${index+1}\`} onChange={e=>updateAiTask(index,'title',e.target.value)}/>` ,
 `<label className="request-ai-task-field"><span>Tâche</span><textarea className="request-ai-title" rows={2} value={task.title} aria-label={\`Titre de la tâche \${index+1}\`} onChange={e=>updateAiTask(index,'title',e.target.value)}/></label>`
);
source=source.replaceAll(
 `<input className="request-ai-detail" value={task.details} placeholder="Précision facultative" aria-label={\`Détail de la tâche \${index+1}\`} onChange={e=>updateAiTask(index,'details',e.target.value)}/>` ,
 `<label className="request-ai-task-field"><span>Précision pour le prestataire <small>(facultatif)</small></span><textarea className="request-ai-detail" rows={2} value={task.details} placeholder="Ex. 5 chiens sur place, équipement fourni…" aria-label={\`Détail de la tâche \${index+1}\`} onChange={e=>updateAiTask(index,'details',e.target.value)}/></label>`
);

fs.writeFileSync(file,source);

const cssFile=new URL('../src/request-native.css',import.meta.url);
let css=fs.readFileSync(cssFile,'utf8');
if(!css.includes('.request-ai-task-field{'))css+=`\n.request-ai-task-field{display:grid;gap:5px}.request-ai-task-field>span{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;font-weight:900;color:#77bce6}.request-ai-task-field small{font-size:.65rem;text-transform:none;letter-spacing:0;color:#829bad;font-weight:700}.request-ai-title,.request-ai-detail{width:100%;resize:vertical;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}.request-ai-title{min-height:58px!important;font-size:1rem!important}.request-ai-detail{min-height:54px!important;font-size:.84rem!important}.request-ai-task>div{min-width:0}\n`;
fs.writeFileSync(cssFile,css);
console.log('✓ AI task review v6: wrapping task titles and clearer provider details');
