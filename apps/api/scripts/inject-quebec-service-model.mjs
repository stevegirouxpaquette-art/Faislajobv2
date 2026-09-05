import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
const serverFile = path.join(srcDir, 'server.ts');
let server = fs.readFileSync(serverFile, 'utf8');

const categoryDefinitions = [
  { id: 'voiture', name: 'Voiture', rate: 6000, comment: '1,00 $/min' },
  { id: 'garde-enfant-devoirs', name: 'Garde d’enfant & aide aux devoirs', rate: 3000, comment: '0,50 $/min' },
  { id: 'a-classer', name: 'Autre demande — approbation admin', rate: 4000, comment: '0,67 $/min' },
];

const anchor = "  { id: 'animaux', name: 'Animaux', hourlyRateCents: 2700 }, // 0,45 $/min\n];";
if (!server.includes(anchor) && !categoryDefinitions.every(c => server.includes(`{ id: '${c.id}', name:`))) {
  throw new Error('defaultCategories anchor not found');
}

for (const c of categoryDefinitions) {
  if (server.includes(`{ id: '${c.id}', name:`)) continue;
  const lastCategory = "  { id: 'animaux', name: 'Animaux', hourlyRateCents: 2700 }, // 0,45 $/min\n";
  if (!server.includes(lastCategory)) throw new Error(`default category anchor not found for ${c.id}`);
  server = server.replace(
    lastCategory,
    `${lastCategory}  { id: '${c.id}', name: '${c.name}', hourlyRateCents: ${c.rate} }, // ${c.comment}\n`
  );
}

fs.writeFileSync(serverFile, server);

const terminology = [
  ['Partenaires', 'Prestataires'],
  ['partenaires', 'prestataires'],
  ['Partenaire', 'Prestataire'],
  ['partenaire', 'prestataire'],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.ts$/.test(entry.name)) {
      let source = fs.readFileSync(full, 'utf8');
      const before = source;
      for (const [from, to] of terminology) source = source.replaceAll(from, to);
      if (source !== before) fs.writeFileSync(full, source);
    }
  }
}

walk(srcDir);
console.log('✓ catégories Voiture + garde d’enfant/aide aux devoirs + Autre demande et terminologie prestataire appliquées côté API');
