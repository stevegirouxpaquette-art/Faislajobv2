import fs from 'node:fs';

const file=new URL('../src/RequestFlow.tsx',import.meta.url);
let source=fs.readFileSync(file,'utf8');

const checklistType="type AiChecklistResult={summary:string;tasks:ChecklistTask[];questions:string[]};";
if(!source.includes('type IntakeQuestion=')){
  if(!source.includes(checklistType))throw new Error('AI intake: checklist type marker not found');
  source=source.replace(checklistType,`${checklistType}\ntype IntakeQuestion={id:string;question:string;help:string;inputType:'choice'|'multi'|'text';options:string[]};`);
}

const aiState=" const[aiTasks,setAiTasks]=useState<ChecklistTask[]>([]),[aiQuestions,setAiQuestions]=useState<string[]>([]),[aiLoading,setAiLoading]=useState(false),[newTask,setNewTask]=useState('');";
if(!source.includes('const[intakeQuestions,setIntakeQuestions]')){
  if(!source.includes(aiState))throw new Error('AI intake: AI state marker not found');
  source=source.replace(aiState,`${aiState}\n const[intakeQuestions,setIntakeQuestions]=useState<IntakeQuestion[]>([]),[intakeAnswers,setIntakeAnswers]=useState<Record<string,string>>({}),[intakeIndex,setIntakeIndex]=useState(0),[intakeLoading,setIntakeLoading]=useState(false);`);
}

const functionAnchor=" const updateAiTask=(index:number,key:'title'|'details',value:string)=>setAiTasks(tasks=>tasks.map((t,i)=>i===index?{...t,[key]:value}:t));";
const functionStart=source.indexOf(' const loadIntakeQuestions=async');
const functionEnd=source.indexOf(functionAnchor);
if(functionEnd<0)throw new Error('AI intake: function anchor not found');

const functions=` const aiClientError=(status:number)=>status===401?'Ta session a expiré. Reconnecte-toi puis réessaie.':status===503?'L’assistant IA est temporairement indisponible. Réessaie dans un instant.':'Impossible de préparer les questions pour le moment. Réessaie.';\n const intakeAnswerPayload=(limit=intakeQuestions.length)=>intakeQuestions.slice(0,limit).map(q=>({question:q.question,inputType:q.inputType,answer:String(intakeAnswers[q.id]||'').split('||').filter(Boolean).join(', ')})).filter(a=>a.answer.trim());\n const loadIntakeQuestions=async()=>{if(!category||!subcategory||user?.role!=='client')return;setIntakeLoading(true);setError('');setAiTasks([]);setAiQuestions([]);setIntakeAnswers({});setIntakeIndex(0);try{const r=await fetch('/api/ai/task-next-question',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:category.name,subcategory,description:details.trim(),answers:[]})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(aiClientError(r.status));const q=d?.result?.question as IntakeQuestion|undefined;if(d?.result?.done||!q)throw new Error('Je n’ai pas réussi à préparer une question. Réessaie.');setIntakeQuestions([q])}catch(e){setError(e instanceof Error?e.message:'Impossible de préparer les questions pour le moment. Réessaie.')}finally{setIntakeLoading(false)}};\n const setIntakeAnswer=(id:string,value:string)=>{const index=intakeQuestions.findIndex(q=>q.id===id),future=index>=0?intakeQuestions.slice(index+1):[];if(index>=0&&future.length){setIntakeQuestions(qs=>qs.slice(0,index+1));if(intakeIndex>index)setIntakeIndex(index)}setIntakeAnswers(a=>{const next={...a,[id]:value};future.forEach(q=>delete next[q.id]);return next});setError('')};\n const toggleMultiAnswer=(id:string,option:string)=>{const index=intakeQuestions.findIndex(q=>q.id===id),future=index>=0?intakeQuestions.slice(index+1):[];if(index>=0&&future.length){setIntakeQuestions(qs=>qs.slice(0,index+1));if(intakeIndex>index)setIntakeIndex(index)}setIntakeAnswers(a=>{const current=String(a[id]||'').split('||').filter(Boolean);const values=current.includes(option)?current.filter(v=>v!==option):[...current,option];const next={...a,[id]:values.join('||')};future.forEach(q=>delete next[q.id]);return next});setError('')};\n const generateChecklistFromInterview=async()=>{if(!category||!subcategory||user?.role!=='client')return;const answers=intakeAnswerPayload(intakeQuestions.length);if(!answers.length){setError('Réponds à la question avant de continuer.');return}setAiLoading(true);setError('');try{const nextResponse=await fetch('/api/ai/task-next-question',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:category.name,subcategory,description:details.trim(),answers})});const nextData=await nextResponse.json().catch(()=>({}));if(!nextResponse.ok)throw new Error(aiClientError(nextResponse.status));if(!nextData?.result?.done){const nextQuestion=nextData?.result?.question as IntakeQuestion|undefined;if(!nextQuestion)throw new Error('Je n’ai pas réussi à préparer la prochaine question. Réessaie.');setIntakeQuestions(qs=>[...qs,nextQuestion]);setIntakeIndex(intakeQuestions.length);return}const r=await fetch('/api/ai/task-list',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:category.name,subcategory,description:details.trim(),answers})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(aiClientError(r.status));const result=d.result as AiChecklistResult;const tasks=Array.isArray(result?.tasks)?result.tasks.map(t=>({title:String(t.title||'').trim(),details:String(t.details||'').trim(),required:t.required!==false})).filter(t=>t.title):[];if(!tasks.length)throw new Error('La liste générée est vide. Réessaie.');setAiTasks(tasks);setAiQuestions(Array.isArray(result?.questions)?result.questions:[])}catch(e){setError(e instanceof Error?e.message:'L’assistant IA est temporairement indisponible. Réessaie.')}finally{setAiLoading(false)}};\n`;

if(functionStart>=0&&functionStart<functionEnd)source=source.slice(0,functionStart)+functions+source.slice(functionEnd);
else source=source.slice(0,functionEnd)+functions+source.slice(functionEnd);

source=source.replace("'✨ Création de la liste…':'✨ Créer la liste de tâches'","'✨ Je prépare la suite…':'✨ Continuer →'");
source=source.replace("'Parle-nous un peu de la job'","'Quelques questions sur la job'");
source=source.replace("fetch('/api/ai/task-questions'","fetch('/api/ai/task-next-question'");

fs.writeFileSync(file,source);
console.log('✓ adaptive AI interview wired to /api/ai/task-next-question');
