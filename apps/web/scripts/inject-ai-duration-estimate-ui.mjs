import fs from 'node:fs';

const file=new URL('../src/RequestFlow.tsx',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const marker='// AI_DURATION_ESTIMATE_UI_V2';

if(!source.includes(marker)){
  source=source.replace(
    "type AiChecklistResult={summary:string;tasks:ChecklistTask[];questions:string[]};",
    "type AiChecklistResult={summary:string;estimatedMinutes:number;tasks:ChecklistTask[];questions:string[]};"
  );

  const aiState=" const[aiTasks,setAiTasks]=useState<ChecklistTask[]>([]),[aiQuestions,setAiQuestions]=useState<string[]>([]),[aiLoading,setAiLoading]=useState(false),[newTask,setNewTask]=useState('');";
  if(source.includes(aiState)){
    source=source.replace(aiState,`${aiState}\n const[aiEstimatedMinutes,setAiEstimatedMinutes]=useState<number|null>(null),[aiSummary,setAiSummary]=useState('');\n ${marker}`);
  }else{
    const stateAnchor=" const[intakeQuestions,setIntakeQuestions]";
    const index=source.indexOf(stateAnchor);
    if(index<0)throw new Error('AI duration UI: state anchor not found');
    source=source.slice(0,index)+` const[aiEstimatedMinutes,setAiEstimatedMinutes]=useState<number|null>(null),[aiSummary,setAiSummary]=useState('');\n ${marker}\n`+source.slice(index);
  }

  source=source.replaceAll(
    "setAiTasks([]);setAiQuestions([]);",
    "setAiTasks([]);setAiQuestions([]);setAiEstimatedMinutes(null);setAiSummary('');"
  );

  source=source.replaceAll(
    "setAiQuestions(Array.isArray(result?.questions)?result.questions:[])",
    "setAiQuestions(Array.isArray(result?.questions)?result.questions:[]);const estimate=Number(result?.estimatedMinutes);setAiEstimatedMinutes(Number.isFinite(estimate)&&estimate>0?Math.max(15,Math.round(estimate)):null);setAiSummary(String(result?.summary||'').trim())"
  );

  const momentAnchor="`Moment: ${timing}`";
  if(source.includes(momentAnchor)&&!source.includes('`Résumé IA: ${aiSummary}`')){
    source=source.replace(momentAnchor,"aiSummary?`Résumé IA: ${aiSummary}`:'',aiEstimatedMinutes?`Temps estimé IA: ${aiEstimatedMinutes} minutes`:'',`Moment: ${timing}`");
  }

  const summaryWhen="<div><span>Quand</span><strong>{timing}</strong></div>";
  if(source.includes(summaryWhen)){
    source=source.replace(summaryWhen,`${summaryWhen}{aiEstimatedMinutes&&<div><span>Temps estimé</span><strong>≈ {aiEstimatedMinutes} min</strong></div>}`);
  }

  const reviewTasks="{aiTasks.length>0&&<div className=\"request-review-tasks\">";
  if(source.includes(reviewTasks)&&!source.includes('request-ai-summary')){
    source=source.replace(reviewTasks,`{aiSummary&&<div className=\"request-tip request-ai-summary\">🧾 <span><strong>Résumé de la mission</strong><br/>{aiSummary}</span></div>}{aiEstimatedMinutes&&<div className=\"request-tip request-ai-duration-estimate\">⏱️ <span><strong>Temps estimé par l’IA : environ {aiEstimatedMinutes} minutes</strong><br/>C’est une estimation; la facturation réelle suit le temps travaillé.</span></div>}${reviewTasks}`);
  }
}

fs.writeFileSync(file,source);
console.log('✓ résumé IA + estimation de durée enregistrés dans la mission');
