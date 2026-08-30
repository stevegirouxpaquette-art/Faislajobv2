import fs from 'node:fs';

const file=new URL('../src/RequestFlow.tsx',import.meta.url);
let source=fs.readFileSync(file,'utf8');

// Preserve whether each answer came from text, choice, or multi so the backend can split selected work items cleanly.
source=source.replaceAll(
 "({question:h.question.question,answer:formatInterviewAnswer(h.question,h.answer)})",
 "({question:h.question.question,inputType:h.question.inputType,answer:formatInterviewAnswer(h.question,h.answer)})"
);

// Once the adaptive interview is complete, follow-up questions must never be shown in the checklist review.
source=source.replaceAll(
 "setAiQuestions(Array.isArray(result?.questions)?result.questions:[])",
 "setAiQuestions([])"
);

// The adaptive interview can use up to 12 questions as a safety cap; the model normally stops earlier.
source=source.replaceAll("((intakeHistory.length+1)/8)*100","((intakeHistory.length+1)/12)*100");

fs.writeFileSync(file,source);
console.log('✓ final AI checklist uses multi-select context and no duplicate follow-up box');
