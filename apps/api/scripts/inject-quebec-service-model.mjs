import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
const serverFile = path.join(srcDir, 'server.ts');
let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes("{ id: 'voiture', name: 'Voiture'")) {
  const anchor = "  { id: 'animaux', name: 'Animaux', hourlyRateCents: 2700 }, // 0,45 $/min\n];";
  if (!server.includes(anchor)) throw new Error('defaultCategories anchor not found');
  server = server.replace(
    anchor,
    "  { id: 'animaux', name: 'Animaux', hourlyRateCents: 2700 }, // 0,45 $/min\n  { id: 'voiture', name: 'Voiture', hourlyRateCents: 6000 }, // 1,00 $/min\n];"
  );
  fs.writeFileSync(serverFile, server);
}

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
console.log('✓ catégorie Voiture et terminologie prestataire appliquées côté API');
