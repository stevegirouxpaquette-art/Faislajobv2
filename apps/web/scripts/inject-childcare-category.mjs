import fs from 'node:fs';

const file = new URL('../src/RequestFlow.tsx', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("id:'garde-enfant-devoirs'")) {
  const anchor = "{id:'animaux',icon:'🐕',name:'Animaux',description:'Promenade, garde, aide ponctuelle, etc.',subcategories:[{name:'Promenade',icon:'🐕',description:'Promenade de ton animal'},{name:'Visite à domicile',icon:'🏡',description:'Visite, nourriture et présence'},{name:'Aide ponctuelle',icon:'🐾',description:'Besoin particulier pour ton animal'}]}\n];";
  if (!source.includes(anchor)) throw new Error('initialCategories anchor not found');
  const category = ",\n{id:'garde-enfant-devoirs',icon:'👨‍👩‍👧',name:'Garde d’enfant & aide aux devoirs',description:'Garde d’enfants et soutien scolaire à domicile.',subcategories:[{name:'Garde d’enfant',icon:'🧸',description:'Surveillance et garde d’un ou plusieurs enfants'},{name:'Aide aux devoirs',icon:'📚',description:'Accompagnement pour les devoirs et les études'}]}";
  source = source.replace(anchor, anchor.replace('\n];', `${category}\n];`));
  fs.writeFileSync(file, source);
}

console.log('✓ catégorie Garde d’enfant & aide aux devoirs appliquée côté client');
