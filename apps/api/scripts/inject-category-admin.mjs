import fs from 'node:fs';

const file = new URL('../src/server.ts', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

// Tarifs de lancement adaptés au marché de Trois-Rivières.
// Le moteur facture déjà à la minute à partir de hourly_rate_cents,
// avec un minimum facturable de 15 minutes.
const categoryRatesBlock = `const defaultCategories = [
  { id: 'menage', name: 'Ménage', hourlyRateCents: 3300 }, // 0,55 $/min
  { id: 'reparations', name: 'Petites réparations', hourlyRateCents: 4500 }, // 0,75 $/min
  { id: 'exterieur', name: 'Terrain & extérieur', hourlyRateCents: 3480 }, // 0,58 $/min
  { id: 'demenagement', name: 'Déménagement', hourlyRateCents: 3900 }, // 0,65 $/min
  { id: 'deneigement', name: 'Déneigement', hourlyRateCents: 4200 }, // 0,70 $/min
  { id: 'animaux', name: 'Animaux', hourlyRateCents: 2700 }, // 0,45 $/min
];`;

source = source.replace(
  /const defaultCategories = \[[\s\S]*?\n\];/,
  categoryRatesBlock,
);

source = source.replace(
  /for\(const c of defaultCategories\)await pool\.query\(`INSERT INTO categories\(id,name,hourly_rate_cents\) VALUES\(\$1,\$2,\$3\) ON CONFLICT\(id\) DO UPDATE SET name=EXCLUDED\.name,hourly_rate_cents=COALESCE\(categories\.hourly_rate_cents,EXCLUDED\.hourly_rate_cents\)`\,\[c\.id,c\.name,DEFAULT_HOURLY_RATE_CENTS\]\);/,
  "for(const c of defaultCategories)await pool.query(`INSERT INTO categories(id,name,hourly_rate_cents) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,hourly_rate_cents=EXCLUDED.hourly_rate_cents`,[c.id,c.name,c.hourlyRateCents]);",
);

const marker = '// CATEGORY ADMIN ROUTES';

if (!source.includes(marker)) {
  const anchor = "app.get('/api/admin/finance'";
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error('Could not find admin finance route anchor');

  const routes = `// CATEGORY ADMIN ROUTES\napp.post('/api/admin/categories',async(request,reply)=>{if(!requireAdmin(request,reply))return;const b=request.body as any,id=String(b?.id||'').trim().toLowerCase(),name=String(b?.name||'').trim(),hourlyRateCents=Math.round(Number(b?.hourlyRateCents));if(!id||!/^[a-z0-9-]+$/.test(id))return reply.code(400).send({error:'Identifiant de catégorie invalide'});if(!name)return reply.code(400).send({error:'Le nom est requis'});if(!Number.isFinite(hourlyRateCents)||hourlyRateCents<=0)return reply.code(400).send({error:'Le tarif horaire doit être supérieur à 0'});try{const r=await pool.query('INSERT INTO categories(id,name,hourly_rate_cents) VALUES($1,$2,$3) RETURNING id,name,hourly_rate_cents',[id,name,hourlyRateCents]);return reply.code(201).send({category:r.rows[0]})}catch(e:any){if(e?.code==='23505')return reply.code(409).send({error:'Cette catégorie existe déjà'});throw e}});\napp.post('/api/admin/categories/:id',async(request,reply)=>{if(!requireAdmin(request,reply))return;const{id}=request.params as any,b=request.body as any,name=String(b?.name||'').trim(),hourlyRateCents=Math.round(Number(b?.hourlyRateCents));if(!name)return reply.code(400).send({error:'Le nom est requis'});if(!Number.isFinite(hourlyRateCents)||hourlyRateCents<=0)return reply.code(400).send({error:'Le tarif horaire doit être supérieur à 0'});const r=await pool.query('UPDATE categories SET name=$1,hourly_rate_cents=$2 WHERE id=$3 RETURNING id,name,hourly_rate_cents',[name,hourlyRateCents,id]);if(!r.rowCount)return reply.code(404).send({error:'Catégorie introuvable'});return{category:r.rows[0]}});\napp.post('/api/admin/categories/:id/delete',async(request,reply)=>{if(!requireAdmin(request,reply))return;const{id}=request.params as any,used=await pool.query('SELECT COUNT(*)::int count FROM missions WHERE category_id=$1',[id]);if(Number(used.rows[0]?.count||0)>0)return reply.code(409).send({error:'Cette catégorie est déjà utilisée par des missions et ne peut pas être supprimée.'});await pool.query('DELETE FROM provider_categories WHERE category_id=$1',[id]);const r=await pool.query('DELETE FROM categories WHERE id=$1 RETURNING id',[id]);if(!r.rowCount)return reply.code(404).send({error:'Catégorie introuvable'});return{ok:true}});\n\n`;
  source = source.slice(0, index) + routes + source.slice(index);
  console.log('✓ category admin routes wired into API source');
} else {
  console.log('✓ category admin routes already wired');
}

fs.writeFileSync(file, source);
console.log('✓ Trois-Rivières category rates applied');
