import fs from 'node:fs';

const file = new URL('../src/server.ts', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

const marker = '// CATEGORY APPROVAL V1';
if (source.includes(marker)) {
  console.log('✓ category approval already wired');
  process.exit(0);
}

const categoryAnchor = "  { id: 'garde-enfant-devoirs', name: 'Garde d’enfant & aide aux devoirs', hourlyRateCents: 3000 }, // 0,50 $/min\n];";
if (!source.includes(categoryAnchor)) throw new Error('category approval: default category anchor not found');
source = source.replace(categoryAnchor, "  { id: 'garde-enfant-devoirs', name: 'Garde d’enfant & aide aux devoirs', hourlyRateCents: 3000 }, // 0,50 $/min\n  { id: 'a-classer', name: 'Autre demande — approbation admin', hourlyRateCents: 4000 },\n];");

const oldMissionRoute = /app\.post\('\/api\/missions',async\(request,reply\)=>\{[\s\S]*?\}\);\napp\.get\('\/api\/missions\/:id'/;
const newMissionRoute = `app.post('/api/missions',async(request,reply)=>{const b=request.body as any,u=await currentUser(request),clientId=u?.role==='client'?Number(u.client_id):Number(b?.clientId||0);if(!clientId||!b?.categoryId)return reply.code(400).send({error:'clientId and categoryId are required'});const categoryId=String(b.categoryId);const isUnclassified=categoryId==='a-classer';const r=await pool.query(\`INSERT INTO missions(client_id,category_id,description,scheduled_at,service_city,zone_id,status) VALUES($1,$2,$3,$4,$5,(SELECT id FROM zones WHERE is_active=TRUE AND LOWER(TRIM(city_match))=LOWER(TRIM($5)) LIMIT 1),$6) RETURNING *\`,[clientId,categoryId,b.description?.trim()||null,b.scheduledAt||null,String(b.serviceCity||'').trim()||null,isUnclassified?'pending_admin_category':'requested']);const offersCreated=isUnclassified?0:await dispatchMission(Number(r.rows[0].id),categoryId);return reply.code(201).send({mission:(await pool.query('SELECT * FROM missions WHERE id=$1',[r.rows[0].id])).rows[0],categoryApprovalRequired:isUnclassified,dispatch:{offersCreated}})});\napp.get('/api/missions/:id'`;
if (!oldMissionRoute.test(source)) throw new Error('category approval: mission route not found');
source = source.replace(oldMissionRoute, newMissionRoute);

const adminAnchor = "app.get('/api/admin/finance'";
const index = source.indexOf(adminAnchor);
if (index < 0) throw new Error('category approval: admin anchor not found');
const route = `// CATEGORY APPROVAL V1\napp.post('/api/admin/missions/:id/approve-category',async(request,reply)=>{if(!requireAdmin(request,reply))return;const{id}=request.params as any,b=request.body as any,categoryId=String(b?.categoryId||'').trim();if(!categoryId||categoryId==='a-classer')return reply.code(400).send({error:'Choisis une catégorie valide.'});const exists=await pool.query('SELECT id FROM categories WHERE id=$1 LIMIT 1',[categoryId]);if(!exists.rowCount)return reply.code(404).send({error:'Catégorie introuvable'});const m=await pool.query(\`UPDATE missions SET category_id=$1,status='requested',updated_at=NOW() WHERE id=$2 AND status='pending_admin_category' RETURNING *\`,[categoryId,id]);if(!m.rowCount)return reply.code(409).send({error:'Cette demande n’est plus en attente de classement.'});const offersCreated=await dispatchMission(Number(id),categoryId);return{mission:m.rows[0],categoryApprovalRequired:false,dispatch:{offersCreated}}});\n\n`;
source = source.slice(0, index) + route + source.slice(index);

fs.writeFileSync(file, source);
console.log('✓ demandes hors catégorie mises en attente d’approbation admin');
