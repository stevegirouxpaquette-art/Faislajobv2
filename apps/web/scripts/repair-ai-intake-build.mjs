import fs from 'node:fs';

const file=new URL('../src/RequestFlow.tsx',import.meta.url);
let source=fs.readFileSync(file,'utf8');

const declarations=[
  'const isOtherOption=',
  'const restoreOtherAnswer=',
  'const mergeOtherAnswer=',
  'const formatInterviewAnswer=',
  'const generateChecklistFromHistory=',
  'const requestNextQuestion=',
  'const startAdaptiveInterview=',
  'const toggleCurrentMulti=',
  'const selectCurrentChoice=',
  'const advanceAdaptiveInterview=',
  'const previousAdaptiveQuestion=',
  'const editInterviewAnswers='
];

const seen=new Set();
const removed=[];
const lines=source.split('\n').filter(line=>{
  const trimmed=line.trimStart();
  const key=declarations.find(prefix=>trimmed.startsWith(prefix));
  if(!key)return true;
  if(seen.has(key)){removed.push(key);return false}
  seen.add(key);return true;
});
source=lines.join('\n');

// Safety check: the adaptive flow must have its essential functions exactly once.
for(const required of ['const formatInterviewAnswer=','const requestNextQuestion=','const startAdaptiveInterview=','const advanceAdaptiveInterview=']){
  const count=source.split(required).length-1;
  if(count!==1)throw new Error(`AI intake repair failed for ${required}: found ${count}`);
}

fs.writeFileSync(file,source);
console.log(`✓ AI intake build repaired${removed.length?` — removed ${removed.length} duplicate declaration(s)`:''}`);
