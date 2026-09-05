import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
const requestFile = path.join(srcDir, 'RequestFlow.tsx');
let request = fs.readFileSync(requestFile, 'utf8');

// Catégorie automobile pensée pour des petits services mobiles au Québec.
if (!request.includes("id:'voiture'")) {
  const anchor = '\n];\nconst timings=';
  if (!request.includes(anchor)) throw new Error('RequestFlow categories anchor not found');
  const voiture = "{id:'voiture',icon:'🚗',name:'Voiture',description:'Lavage, survoltage, pneus et petite mécanique.',subcategories:[{name:'Lavage de voiture',icon:'🧽',description:'Lavage extérieur, intérieur ou complet du véhicule'},{name:'Survoltage (boost)',icon:'🔋',description:'Démarrage d’un véhicule dont la batterie est à plat'},{name:'Changement de pneus saisonniers',icon:'🛞',description:'Changement des roues lorsque les pneus sont déjà montés sur les jantes'},{name:'Petite mécanique',icon:'🔧',description:'Batterie, essuie-glaces, ampoules, liquides et petites interventions — sans travaux majeurs de freins, direction ou suspension'}]}";
  request = request.replace(anchor, `,\n${voiture}\n];\nconst timings=`);
}

// Copie client plus simple : on garde OpenStreetMap comme moteur/attribution de carte,
// sans l’exposer inutilement dans les confirmations et messages d’erreur.
request = request
  .replaceAll('Adresse validée par OpenStreetMap', 'Adresse valide')
  .replaceAll('OpenStreetMap a trouvé l’adresse, mais le code postal ne correspond pas.', 'L’adresse a été trouvée, mais le code postal ne correspond pas.')
  .replaceAll('La validation OpenStreetMap est temporairement indisponible.', 'La validation de l’adresse est temporairement indisponible.')
  .replaceAll('Adresse de la job sur OpenStreetMap', 'Carte de l’adresse de la job')
  .replace(
    "Rayon configuré : {zoneCheck.zone.radiusKm} km{zoneCheck.distanceKm!=null?` · environ ${zoneCheck.distanceKm} km du centre`:''}",
    'Rayon configuré : {zoneCheck.zone.radiusKm} km'
  );
fs.writeFileSync(requestFile, request);

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
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      let source = fs.readFileSync(full, 'utf8');
      const before = source;
      for (const [from, to] of terminology) source = source.replaceAll(from, to);
      if (source !== before) fs.writeFileSync(full, source);
    }
  }
}

walk(srcDir);
console.log('✓ terminologie prestataire + catégorie Voiture + copie adresse/zone appliquées');
