import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createPool } from './db.js';

const pool = createPool();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const defaultCategories = [
  { id: 'menage', name: 'Ménage' },
  { id: 'reparations', name: 'Petites réparations' },
  { id: 'exterieur', name: 'Terrain & extérieur' },
  { id: 'demenagement', name: 'Déménagement' },
  { id: 'deneigement', name: 'Déneigement' },
  { id: 'animaux', name: 'Animaux' },
];

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

    CREATE TABLE IF NOT EXISTS provider_categories (
      provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider_id, category_id)
    );
    CREATE TABLE IF NOT EXISTS mission_offers (
      id BIGSERIAL PRIMARY KEY,
      mission_id BIGINT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      UNIQUE (mission_id, provider_id)
    );
  `);
  for (const category of defaultCategories) {
    await pool.query(`INSERT INTO categories (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`, [category.id, category.name]);
  }
}

async function dispatchMission(missionId:number, categoryId:string) {
  const providers=await pool.query(`SELECT p.id FROM providers p JOIN provider_categories pc ON pc.provider_id=p.id WHERE p.status='active' AND p.is_online=TRUE AND pc.category_id=$1`,[categoryId]);
  for(const provider of providers.rows) await pool.query(`INSERT INTO mission_offers (mission_id,provider_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,[missionId,provider.id]);
  if(providers.rowCount) await pool.query(`UPDATE missions SET status='offered',updated_at=NOW() WHERE id=$1 AND provider_id IS NULL`,[missionId]);
  return providers.rowCount??0;
}

app.get('/health',async(_request,reply)=>{try{await pool.query('SELECT 1');return{ok:true,service:'faislajob-api',version:'0.6.0',database:'connected'}}catch(error){app.log.error(error);return reply.code(503).send({ok:false,service:'faislajob-api',database:'disconnected'})}});
app.get('/api/categories',async()=>({categories:(await pool.query('SELECT id,name FROM categories ORDER BY name')).rows}));

app.post('/api/clients',async(request,reply)=>{const b=request.body as any;if(!b?.name?.trim())return reply.code(400).send({error:'name is required'});const email=b.email?.trim().toLowerCase()||null;const r=await pool.query(`INSERT INTO clients(name,email,phone) VALUES($1,$2,$3) RETURNING id,name,email,phone,created_at`,[b.name.trim(),email,b.phone?.trim()||null]);return reply.code(201).send({client:r.rows[0]})});
app.get('/api/clients/:id',async(request,reply)=>{const{id}=request.params as any;const r=await pool.query('SELECT * FROM clients WHERE id=$1',[id]);if(!r.rowCount)return reply.code(404).send({error:'client not found'});return{client:r.rows[0]}});

app.post('/api/providers',async(request,reply)=>{const b=request.body as any;if(!b?.name?.trim())return reply.code(400).send({error:'name is required'});const r=await pool.query(`INSERT INTO providers(name,email,phone,status) VALUES($1,$2,$3,'active') RETURNING *`,[b.name.trim(),b.email?.trim()||null,b.phone?.trim()||null]);return reply.code(201).send({provider:r.rows[0]})});
app.get('/api/providers/:id',async(request,reply)=>{const{id}=request.params as any;const r=await pool.query('SELECT * FROM providers WHERE id=$1',[id]);if(!r.rowCount)return reply.code(404).send({error:'provider not found'});return{provider:r.rows[0]}});
app.post('/api/providers/:id/availability',async(request,reply)=>{const{id}=request.params as any;const b=request.body as any;if(typeof b?.online!=='boolean')return reply.code(400).send({error:'online boolean is required'});const p=await pool.query(`SELECT id FROM providers WHERE id=$1 AND status='active'`,[id]);if(!p.rowCount)return reply.code(404).send({error:'active provider not found'});await pool.query(`UPDATE providers SET is_online=$1,last_online_at=CASE WHEN $1 THEN NOW() ELSE last_online_at END,updated_at=NOW() WHERE id=$2`,[b.online,id]);if(Array.isArray(b.categoryIds)){await pool.query('DELETE FROM provider_categories WHERE provider_id=$1',[id]);for(const c of b.categoryIds)await pool.query(`INSERT INTO provider_categories(provider_id,category_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[id,c])}const r=await pool.query(`SELECT p.id,p.name,p.status,p.is_online,COALESCE(array_agg(pc.category_id) FILTER(WHERE pc.category_id IS NOT NULL),'{}') category_ids FROM providers p LEFT JOIN provider_categories pc ON pc.provider_id=p.id WHERE p.id=$1 GROUP BY p.id`,[id]);return{provider:r.rows[0]}});
app.get('/api/providers/:id/offers',async(request)=>{const{id}=request.params as any;const r=await pool.query(`SELECT o.id offer_id,o.status offer_status,o.offered_at,m.id mission_id,m.category_id,c.name category_name,m.description,m.scheduled_at,m.status mission_status FROM mission_offers o JOIN missions m ON m.id=o.mission_id LEFT JOIN categories c ON c.id=m.category_id WHERE o.provider_id=$1 AND o.status='pending' AND m.provider_id IS NULL ORDER BY o.offered_at`,[id]);return{offers:r.rows}});

app.post('/api/missions',async(request,reply)=>{const b=request.body as any;if(!b?.clientId||!b?.categoryId)return reply.code(400).send({error:'clientId and categoryId are required'});const r=await pool.query(`INSERT INTO missions(client_id,category_id,description,scheduled_at) VALUES($1,$2,$3,$4) RETURNING *`,[b.clientId,b.categoryId,b.description?.trim()||null,b.scheduledAt||null]);const offersCreated=await dispatchMission(Number(r.rows[0].id),b.categoryId);const refreshed=await pool.query('SELECT * FROM missions WHERE id=$1',[r.rows[0].id]);return reply.code(201).send({mission:refreshed.rows[0],dispatch:{offersCreated}})});
app.get('/api/missions/:id',async(request,reply)=>{const{id}=request.params as any;const r=await pool.query(`SELECT m.*,c.name category_name FROM missions m LEFT JOIN categories c ON c.id=m.category_id WHERE m.id=$1`,[id]);if(!r.rowCount)return reply.code(404).send({error:'mission not found'});return{mission:r.rows[0]}});

app.post('/api/missions/:id/assign',async(request,reply)=>{const{id}=request.params as any;const b=request.body as any;if(!b?.providerId)return reply.code(400).send({error:'providerId is required'});const r=await pool.query(`UPDATE missions SET provider_id=$1,status='assigned',updated_at=NOW() WHERE id=$2 AND provider_id IS NULL RETURNING *`,[b.providerId,id]);if(!r.rowCount)return reply.code(409).send({error:'mission already assigned or not found'});await pool.query(`UPDATE mission_offers SET status=CASE WHEN provider_id=$1 THEN 'accepted' ELSE 'expired' END,responded_at=NOW() WHERE mission_id=$2`,[b.providerId,id]);return{mission:r.rows[0]}});

app.post('/api/offers/:offerId/accept',async(request,reply)=>{const{offerId}=request.params as any;const client=await pool.connect();try{await client.query('BEGIN');const o=await client.query(`SELECT id,mission_id,provider_id FROM mission_offers WHERE id=$1 AND status='pending' FOR UPDATE`,[offerId]);if(!o.rowCount){await client.query('ROLLBACK');return reply.code(404).send({error:'pending offer not found'})}const x=o.rows[0];const m=await client.query(`UPDATE missions SET provider_id=$1,status='assigned',updated_at=NOW() WHERE id=$2 AND provider_id IS NULL RETURNING *`,[x.provider_id,x.mission_id]);if(!m.rowCount){await client.query(`UPDATE mission_offers SET status='expired',responded_at=NOW() WHERE id=$1`,[offerId]);await client.query('COMMIT');return reply.code(409).send({error:'mission already taken'})}await client.query(`UPDATE mission_offers SET status=CASE WHEN id=$1 THEN 'accepted' ELSE 'expired' END,responded_at=NOW() WHERE mission_id=$2`,[offerId,x.mission_id]);await client.query('COMMIT');return{mission:m.rows[0]}}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}});
app.post('/api/offers/:offerId/decline',async(request,reply)=>{const{offerId}=request.params as any;const r=await pool.query(`UPDATE mission_offers SET status='declined',responded_at=NOW() WHERE id=$1 AND status='pending' RETURNING *`,[offerId]);if(!r.rowCount)return reply.code(404).send({error:'pending offer not found'});return{offer:r.rows[0]}});

async function transitionMission(id:string, providerId:number, from:string[], to:string, timestampColumn:string, reply:any){
  if(!providerId)return reply.code(400).send({error:'providerId is required'});
  const r=await pool.query(`UPDATE missions SET status=$1,${timestampColumn}=NOW(),updated_at=NOW() WHERE id=$2 AND provider_id=$3 AND status=ANY($4::text[]) RETURNING *`,[to,id,providerId,from]);
  if(!r.rowCount)return reply.code(409).send({error:`mission cannot transition to ${to}`});
  return{mission:r.rows[0]};
}
app.post('/api/missions/:id/en-route',async(request,reply)=>{const{id}=request.params as any;const b=request.body as any;return transitionMission(id,b?.providerId,['assigned'],'en_route','en_route_at',reply)});
app.post('/api/missions/:id/arrive',async(request,reply)=>{const{id}=request.params as any;const b=request.body as any;return transitionMission(id,b?.providerId,['en_route'],'arrived','arrived_at',reply)});
app.post('/api/missions/:id/start',async(request,reply)=>{const{id}=request.params as any;const b=request.body as any;return transitionMission(id,b?.providerId,['arrived'],'in_progress','started_at',reply)});
app.post('/api/missions/:id/complete',async(request,reply)=>{const{id}=request.params as any;const b=request.body as any;if(!b?.providerId)return reply.code(400).send({error:'providerId is required'});const r=await pool.query(`UPDATE missions SET status='completed',completed_at=NOW(),duration_minutes=GREATEST(1,CEIL(EXTRACT(EPOCH FROM (NOW()-started_at))/60)::int),updated_at=NOW() WHERE id=$1 AND provider_id=$2 AND status='in_progress' AND started_at IS NOT NULL RETURNING *`,[id,b.providerId]);if(!r.rowCount)return reply.code(409).send({error:'mission cannot be completed'});return{mission:r.rows[0]}});

app.addHook('onClose',async()=>{await pool.end()});
const port=Number(process.env.PORT??3000);const host=process.env.HOST??'0.0.0.0';
initializeDatabase().then(()=>app.listen({port,host})).catch(error=>{app.log.error(error);process.exit(1)});
