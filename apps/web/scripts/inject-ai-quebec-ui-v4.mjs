import fs from 'node:fs';

const file=new URL('../src/RequestFlow.tsx',import.meta.url);
let source=fs.readFileSync(file,'utf8');

const stateMarker=" const[currentQuestion,setCurrentQuestion]=useState<IntakeQuestion|null>(null),[intakeHistory,setIntakeHistory]=useState<IntakeAnswer[]>([]),[currentAnswer,setCurrentAnswer]=useState(''),[intakeLoading,setIntakeLoading]=useState(false),[interviewDone,setInterviewDone]=useState(false);";
if(!source.includes('const[currentOther,setCurrentOther]')){
 if(!source.includes(stateMarker))throw new Error('Quebec AI UI: adaptive state marker not found');
 source=source.replace(stateMarker,`${stateMarker}\n const[currentOther,setCurrentOther]=useState('');`);
}

const formatMarker=" const formatInterviewAnswer=(q:IntakeQuestion,raw:string)=>q.inputType==='multi'?raw.split('||').filter(Boolean).join(', '):raw.trim();";
if(!source.includes('const isOtherOption=')){
 if(!source.includes(formatMarker))throw new Error('Quebec AI UI: format marker not found');
 const helpers=` const isOtherOption=(value:string)=>/^autre(?:\\b|\\s|:|$)/i.test(value.trim());\n const restoreOtherAnswer=(q:IntakeQuestion,raw:string)=>{const values=q.inputType==='multi'?raw.split('||').filter(Boolean):[raw];let other='';const restored=values.map(v=>{if(/^autre\\s*:/i.test(v)){other=v.replace(/^autre\\s*:\\s*/i,'').trim();return 'Autre'}return v});return{answer:q.inputType==='multi'?restored.join('||'):(restored[0]||''),other}};\n const mergeOtherAnswer=(q:IntakeQuestion,raw:string,other:string)=>{if(!other.trim())return raw;if(q.inputType==='multi')return raw.split('||').filter(Boolean).map(v=>isOtherOption(v)?\`Autre: ${'${other.trim()}'}\`:v).join('||');return isOtherOption(raw)?\`Autre: ${'${other.trim()}'}\`:raw};\n ${formatMarker.trimStart()}\n`;
 source=source.replace(formatMarker,helpers.trimEnd());
}

source=source.replace("setCurrentQuestion(safeQuestion);setCurrentAnswer('');setInterviewDone(false)","setCurrentQuestion(safeQuestion);setCurrentAnswer('');setCurrentOther('');setInterviewDone(false)");
source=source.replace("setCurrentQuestion(null);setCurrentAnswer('');setInterviewDone(false);await requestNextQuestion([])","setCurrentQuestion(null);setCurrentAnswer('');setCurrentOther('');setInterviewDone(false);await requestNextQuestion([])");

const oldToggle=" const toggleCurrentMulti=(option:string)=>setCurrentAnswer(raw=>{const current=raw.split('||').filter(Boolean);return(current.includes(option)?current.filter(v=>v!==option):[...current,option]).join('||')});";
const newToggle=" const toggleCurrentMulti=(option:string)=>{const currentlySelected=currentAnswer.split('||').filter(Boolean).includes(option);if(isOtherOption(option)&&currentlySelected)setCurrentOther('');setCurrentAnswer(raw=>{const current=raw.split('||').filter(Boolean);return(current.includes(option)?current.filter(v=>v!==option):[...current,option]).join('||')})};\n const selectCurrentChoice=(option:string)=>{setCurrentAnswer(option);if(!isOtherOption(option))setCurrentOther('')};";
if(source.includes(oldToggle))source=source.replace(oldToggle,newToggle);

const oldAdvance=" const advanceAdaptiveInterview=async()=>{if(!currentQuestion)return;const formatted=formatInterviewAnswer(currentQuestion,currentAnswer);if(!formatted.trim())return;const nextHistory=[...intakeHistory,{question:currentQuestion,answer:currentAnswer}];setIntakeHistory(nextHistory);setCurrentQuestion(null);setCurrentAnswer('');await requestNextQuestion(nextHistory)};";
const newAdvance=" const advanceAdaptiveInterview=async()=>{if(!currentQuestion)return;const otherSelected=currentQuestion.inputType==='multi'?currentAnswer.split('||').filter(Boolean).some(isOtherOption):isOtherOption(currentAnswer);if(otherSelected&&!currentOther.trim())return;const storedAnswer=mergeOtherAnswer(currentQuestion,currentAnswer,currentOther);const formatted=formatInterviewAnswer(currentQuestion,storedAnswer);if(!formatted.trim())return;const nextHistory=[...intakeHistory,{question:currentQuestion,answer:storedAnswer}];setIntakeHistory(nextHistory);setCurrentQuestion(null);setCurrentAnswer('');setCurrentOther('');await requestNextQuestion(nextHistory)};";
if(source.includes(oldAdvance))source=source.replace(oldAdvance,newAdvance);

const oldPrevious=" const previousAdaptiveQuestion=()=>{if(intakeHistory.length===0)return;const previous=intakeHistory[intakeHistory.length-1];setIntakeHistory(items=>items.slice(0,-1));setCurrentQuestion(previous.question);setCurrentAnswer(previous.answer);setAiTasks([]);setAiQuestions([]);setInterviewDone(false);setError('')};";
const newPrevious=" const previousAdaptiveQuestion=()=>{if(intakeHistory.length===0)return;const previous=intakeHistory[intakeHistory.length-1],restored=restoreOtherAnswer(previous.question,previous.answer);setIntakeHistory(items=>items.slice(0,-1));setCurrentQuestion(previous.question);setCurrentAnswer(restored.answer);setCurrentOther(restored.other);setAiTasks([]);setAiQuestions([]);setInterviewDone(false);setError('')};";
if(source.includes(oldPrevious))source=source.replace(oldPrevious,newPrevious);

const oldEdit=" const editInterviewAnswers=()=>{if(intakeHistory.length===0){void startAdaptiveInterview();return}const previous=intakeHistory[intakeHistory.length-1];setIntakeHistory(items=>items.slice(0,-1));setCurrentQuestion(previous.question);setCurrentAnswer(previous.answer);setAiTasks([]);setAiQuestions([]);setInterviewDone(false)};";
const newEdit=" const editInterviewAnswers=()=>{if(intakeHistory.length===0){void startAdaptiveInterview();return}const previous=intakeHistory[intakeHistory.length-1],restored=restoreOtherAnswer(previous.question,previous.answer);setIntakeHistory(items=>items.slice(0,-1));setCurrentQuestion(previous.question);setCurrentAnswer(restored.answer);setCurrentOther(restored.other);setAiTasks([]);setAiQuestions([]);setInterviewDone(false)};";
if(source.includes(oldEdit))source=source.replace(oldEdit,newEdit);

source=source.replace("useEffect(()=>{setCurrentQuestion(null);setIntakeHistory([]);setCurrentAnswer('');setAiTasks([]);setAiQuestions([]);setInterviewDone(false)}","useEffect(()=>{setCurrentQuestion(null);setIntakeHistory([]);setCurrentAnswer('');setCurrentOther('');setAiTasks([]);setAiQuestions([]);setInterviewDone(false)}");

const uiLogic="const q=currentQuestion;const showText=q.inputType==='text'||q.options.length<2;const answered=formatInterviewAnswer(q,currentAnswer).trim().length>0;return";
const newUiLogic="const q=currentQuestion;const showText=q.inputType==='text'||q.options.length<2;const otherSelected=!showText&&(q.inputType==='multi'?currentAnswer.split('||').filter(Boolean).some(isOtherOption):isOtherOption(currentAnswer));const answered=formatInterviewAnswer(q,currentAnswer).trim().length>0&&(!otherSelected||currentOther.trim().length>0);return";
if(source.includes(uiLogic))source=source.replace(uiLogic,newUiLogic);

source=source.replace("onClick={()=>q.inputType==='multi'?toggleCurrentMulti(option):setCurrentAnswer(option)}","onClick={()=>q.inputType==='multi'?toggleCurrentMulti(option):selectCurrentChoice(option)}");

const choicesEnd="})}</div>}<div className=\"request-ai-interview-nav\">";
if(source.includes(choicesEnd)&&!source.includes('Précise ton choix « Autre »')){
 source=source.replace(choicesEnd,"})}</div>}{otherSelected&&<label className=\"request-ai-other\"><span>Précise ton choix « Autre »</span><textarea rows={3} value={currentOther} placeholder=\"Écris ce qui s’applique à ta situation…\" autoFocus onChange={e=>setCurrentOther(e.target.value)}/></label>}<div className=\"request-ai-interview-nav\">");
}

source=source.replace("((intakeHistory.length+1)/6)*100","((intakeHistory.length+1)/8)*100");

fs.writeFileSync(file,source);

const cssFile=new URL('../src/request-native.css',import.meta.url);
let css=fs.readFileSync(cssFile,'utf8');
if(!css.includes('.request-ai-other{'))css+=`\n.request-ai-other{display:grid;gap:7px;margin-top:12px;padding:12px;border:1px solid #3d6382;background:#0a1d2c;border-radius:13px}.request-ai-other>span{font-size:.8rem;font-weight:900;color:#a9d8f5}.request-ai-other textarea{width:100%;border:1px solid #3d6382;background:#061521;color:#fff;border-radius:10px;padding:11px 12px;resize:vertical;min-height:90px}.request-ai-other textarea:focus{outline:none;border-color:#35b5ff;box-shadow:0 0 0 3px #35b5ff22}\n`;
fs.writeFileSync(cssFile,css);
console.log('✓ Quebec AI UI: Autre opens a required free-text field');
