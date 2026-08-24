import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createPool } from './db.js';

const pool = createPool();
const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });

const DEFAULT_HOURLY_RATE_CENTS = Number(process.env.DEFAULT_HOURLY_RATE_CENTS ?? 4000);
const MINIMUM_BILLABLE_MINUTES = Number(process.env.MINIMUM_BILLABLE_MINUTES ?? 15);
const CLIENT_SERVICE_FEE_BPS = Number(process.env.CLIENT_SERVICE_FEE_BPS ?? 1100);
const PROVIDER_COMMISSION_BPS = Number(process.env.PROVIDER_COMMISSION_BPS ?? 3000);
const PAYMENTS_MODE = process.env.PAYMENTS_MODE ?? 'mock';

const defaultCategories = [
  { id: 'menage', name: 'Ménage' },
  { id: 'reparations', name: 'Petites réparations' },
  { id: 'exterieur', name: 'Terrain & extérieur' },
  { id: 'demenagement', name: 'Déménagement' },
  { id: 'deneigement', name: 'Déneigement' },
  { id: 'animaux', name: 'Animaux' },
];

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}
function verifyPassword(password: string, stored: string) {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
function cookieValue(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
function sessionCookie(token: string, maxAge: number) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  return `faislajob_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
async function currentUser(request: any) {
  const token = cookieValue(request.headers.cookie, 'faislajob_session');
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.id,u.email,u.role,u.client_id,u.provider_id,
            COALESCE(c.name,p.name) name,COALESCE(c.phone,p.phone) phone
       FROM sessions s JOIN users u ON u.id=s.user_id
       LEFT JOIN clients c ON c.id=u.client_id LEFT JOIN providers p ON p.id=u.provider_id
      WHERE s.token_hash=$1 AND s.expires_at>NOW() LIMIT 1`, [tokenHash(token)]);
  return result.rows[0] ?? null;
}
async function requireRole(request: any, reply: any, role: 'client' | 'provider') {
  const user = await currentUser(request);
  if (!user) { reply.code(401).send({ error: 'authentication required' }); return null; }
  if (user.role !== role) { reply.code(403).send({ error: `${role} account required` }); return null; }
  return user;
}
async function createSession(reply: any, userId: number) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(`INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')`, [userId, tokenHash(token)]);
  reply.header('Set-Cookie', sessionCookie(token, 60 * 60 * 24 * 30));
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS hourly_rate_cents INTEGER;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS en_route_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

    ALTER TABLE payments ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'client_charge';
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT;

    CREATE TABLE IF NOT EXISTS provider_categories (
      provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(provider_id,category_id)
    );
    CREATE TABLE IF NOT EXISTS mission_offers (
      id BIGSERIAL PRIMARY KEY,
      mission_id BIGINT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      UNIQUE(mission_id,provider_id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('client','provider')),
      client_id BIGINT UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
      provider_id BIGINT UNIQUE REFERENCES providers(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK((role='client' AND client_id IS NOT NULL AND provider_id IS NULL) OR (role='provider' AND provider_id IS NOT NULL AND client_id IS NULL))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mission_billing (
      mission_id BIGINT PRIMARY KEY REFERENCES missions(id) ON DELETE CASCADE,
      hourly_rate_cents INTEGER NOT NULL,
      actual_minutes INTEGER NOT NULL,
      billable_minutes INTEGER NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      client_service_fee_bps INTEGER NOT NULL,
      client_service_fee_cents INTEGER NOT NULL,
      client_total_cents INTEGER NOT NULL,
      provider_commission_bps INTEGER NOT NULL,
      provider_commission_cents INTEGER NOT NULL,
      provider_net_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      status TEXT NOT NULL DEFAULT 'ready',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS provider_payouts (
      id BIGSERIAL PRIMARY KEY,
      mission_id BIGINT NOT NULL UNIQUE REFERENCES missions(id) ON DELETE CASCADE,
      provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      status TEXT NOT NULL DEFAULT 'waiting_payment',
      release_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      external_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS payments_mission_kind_idx ON payments(mission_id,kind);
  `);
  for (const category of defaultCategories) {
    await pool.query(`INSERT INTO categories(id,name,hourly_rate_cents) VALUES($1,$2,$3)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,hourly_rate_cents=COALESCE(categories.hourly_rate_cents,EXCLUDED.hourly_rate_cents)`,
      [category.id, category.name, DEFAULT_HOURLY_RATE_CENTS]);
  }
  await pool.query(`DELETE FROM sessions WHERE expires_at<=NOW()`);
}

async function dispatchMission(missionId: number, categoryId: string) {
  const providers = await pool.query(`SELECT p.id FROM providers p JOIN provider_categories pc ON pc.provider_id=p.id WHERE p.status='active' AND p.is_online=TRUE AND pc.category_id=$1`, [categoryId]);
  for (const provider of providers.rows) await pool.query(`INSERT INTO mission_offers(mission_id,provider_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [missionId, provider.id]);
  if (providers.rowCount) await pool.query(`UPDATE missions SET status='offered',updated_at=NOW() WHERE id=$1 AND provider_id IS NULL`, [missionId]);
  return providers.rowCount ?? 0;
}

async function finalizeBilling(missionId: number) {
  const result = await pool.query(`SELECT m.id,m.provider_id,m.duration_minutes,c.hourly_rate_cents FROM missions m JOIN categories c ON c.id=m.category_id WHERE m.id=$1`, [missionId]);
  if (!result.rowCount) return null;
  const m = result.rows[0];
  const actualMinutes = Math.max(1, Number(m.duration_minutes || 1));
  const billableMinutes = Math.max(MINIMUM_BILLABLE_MINUTES, actualMinutes);
  const hourlyRate = Number(m.hourly_rate_cents || DEFAULT_HOURLY_RATE_CENTS);
  const subtotal = Math.ceil((hourlyRate * billableMinutes) / 60);
  const serviceFee = Math.ceil((subtotal * CLIENT_SERVICE_FEE_BPS) / 10000);
  const clientTotal = subtotal + serviceFee;
  const commission = Math.ceil((subtotal * PROVIDER_COMMISSION_BPS) / 10000);
  const providerNet = Math.max(0, subtotal - commission);

  await pool.query(`INSERT INTO mission_billing(mission_id,hourly_rate_cents,actual_minutes,billable_minutes,subtotal_cents,client_service_fee_bps,client_service_fee_cents,client_total_cents,provider_commission_bps,provider_commission_cents,provider_net_cents,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ready')
    ON CONFLICT(mission_id) DO UPDATE SET hourly_rate_cents=EXCLUDED.hourly_rate_cents,actual_minutes=EXCLUDED.actual_minutes,billable_minutes=EXCLUDED.billable_minutes,subtotal_cents=EXCLUDED.subtotal_cents,client_service_fee_bps=EXCLUDED.client_service_fee_bps,client_service_fee_cents=EXCLUDED.client_service_fee_cents,client_total_cents=EXCLUDED.client_total_cents,provider_commission_bps=EXCLUDED.provider_commission_bps,provider_commission_cents=EXCLUDED.provider_commission_cents,provider_net_cents=EXCLUDED.provider_net_cents,updated_at=NOW()`,
    [missionId, hourlyRate, actualMinutes, billableMinutes, subtotal, CLIENT_SERVICE_FEE_BPS, serviceFee, clientTotal, PROVIDER_COMMISSION_BPS, commission, providerNet]);
  await pool.query(`INSERT INTO payments(mission_id,amount_cents,currency,status,provider,kind) VALUES($1,$2,'CAD','pending',$3,'client_charge') ON CONFLICT(mission_id,kind) DO UPDATE SET amount_cents=EXCLUDED.amount_cents,status=CASE WHEN payments.status='paid' THEN 'paid' ELSE 'pending' END,updated_at=NOW()`, [missionId, clientTotal, PAYMENTS_MODE]);
  if (m.provider_id) await pool.query(`INSERT INTO provider_payouts(mission_id,provider_id,amount_cents,status) VALUES($1,$2,$3,'waiting_payment') ON CONFLICT(mission_id) DO UPDATE SET provider_id=EXCLUDED.provider_id,amount_cents=EXCLUDED.amount_cents,updated_at=NOW()`, [missionId, m.provider_id, providerNet]);
  return (await pool.query(`SELECT b.*,p.status payment_status,p.payment_method,pp.status payout_status,pp.release_at FROM mission_billing b LEFT JOIN payments p ON p.mission_id=b.mission_id AND p.kind='client_charge' LEFT JOIN provider_payouts pp ON pp.mission_id=b.mission_id WHERE b.mission_id=$1`, [missionId])).rows[0];
}

app.get('/health', async (_request, reply) => {
  try { await pool.query('SELECT 1'); return { ok: true, service: 'faislajob-api', version: '0.8.0', database: 'connected', paymentsMode: PAYMENTS_MODE }; }
  catch (error) { app.log.error(error); return reply.code(503).send({ ok: false, service: 'faislajob-api', database: 'disconnected' }); }
});

app.post('/api/auth/register', async (request, reply) => {
  const body = request.body as any;
  const name=body?.name?.trim(), email=body?.email?.trim().toLowerCase(), phone=body?.phone?.trim()||null, password=body?.password||'', role=body?.role;
  if(!name||!email||!['client','provider'].includes(role||'')) return reply.code(400).send({error:'name, email and valid role are required'});
  if(password.length<8) return reply.code(400).send({error:'password must contain at least 8 characters'});
  if(!email.includes('@')) return reply.code(400).send({error:'valid email is required'});
  if((await pool.query('SELECT id FROM users WHERE email=$1',[email])).rowCount) return reply.code(409).send({error:'an account already exists with this email'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN'); let profileId:number;
    if(role==='client'){
      const existing=await client.query('SELECT id FROM clients WHERE LOWER(email)=$1 LIMIT 1',[email]);
      if(existing.rowCount){profileId=Number(existing.rows[0].id);await client.query('UPDATE clients SET name=$1,phone=$2,updated_at=NOW() WHERE id=$3',[name,phone,profileId]);}
      else profileId=Number((await client.query('INSERT INTO clients(name,email,phone) VALUES($1,$2,$3) RETURNING id',[name,email,phone])).rows[0].id);
    } else {
      const existing=await client.query('SELECT id FROM providers WHERE LOWER(email)=$1 LIMIT 1',[email]);
      if(existing.rowCount){profileId=Number(existing.rows[0].id);await client.query(`UPDATE providers SET name=$1,phone=$2,status='active',updated_at=NOW() WHERE id=$3`,[name,phone,profileId]);}
      else profileId=Number((await client.query(`INSERT INTO providers(name,email,phone,status) VALUES($1,$2,$3,'active') RETURNING id`,[name,email,phone])).rows[0].id);
    }
    const u=(await client.query(`INSERT INTO users(email,password_hash,role,client_id,provider_id) VALUES($1,$2,$3,$4,$5) RETURNING id,email,role,client_id,provider_id`,[email,hashPassword(password),role,role==='client'?profileId:null,role==='provider'?profileId:null])).rows[0];
    await client.query('COMMIT'); await createSession(reply,Number(u.id)); return reply.code(201).send({user:{...u,name,phone}});
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
});
app.post('/api/auth/login', async (request, reply) => {
  const body=request.body as any; const email=body?.email?.trim().toLowerCase();
  if(!email||!body?.password) return reply.code(400).send({error:'email and password are required'});
  const r=await pool.query(`SELECT u.id,u.email,u.password_hash,u.role,u.client_id,u.provider_id,COALESCE(c.name,p.name) name,COALESCE(c.phone,p.phone) phone FROM users u LEFT JOIN clients c ON c.id=u.client_id LEFT JOIN providers p ON p.id=u.provider_id WHERE u.email=$1 LIMIT 1`,[email]);
  const user=r.rows[0]; if(!user||!verifyPassword(body.password,user.password_hash)) return reply.code(401).send({error:'invalid email or password'});
  await createSession(reply,Number(user.id)); delete user.password_hash; return {user};
});
app.post('/api/auth/logout',async(request,reply)=>{const token=cookieValue(request.headers.cookie,'faislajob_session');if(token)await pool.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(token)]);reply.header('Set-Cookie',sessionCookie('',0));return{ok:true}});
app.get('/api/auth/me',async(request,reply)=>{const user=await currentUser(request);if(!user)return reply.code(401).send({error:'not authenticated'});return{user}});

app.get('/api/categories',async()=>({categories:(await pool.query('SELECT id,name,hourly_rate_cents FROM categories ORDER BY name')).rows}));
app.post('/api/clients',async(request,reply)=>{const b=request.body as any;if(!b?.name?.trim())return reply.code(400).send({error:'name is required'});const email=b.email?.trim().toLowerCase()||null;if(email){const e=await pool.query('SELECT * FROM clients WHERE LOWER(email)=$1 LIMIT 1',[email]);if(e.rowCount)return{client:e.rows[0],existing:true}}const r=await pool.query(`INSERT INTO clients(name,email,phone) VALUES($1,$2,$3) RETURNING id,name,email,phone,created_at`,[b.name.trim(),email,b.phone?.trim()||null]);return reply.code(201).send({client:r.rows[0],existing:false})});

app.get('/api/providers/:id',async(request,reply)=>{const{id}=request.params as any;const user=await requireRole(request,reply,'provider');if(!user)return;if(String(user.provider_id)!==String(id))return reply.code(403).send({error:'forbidden'});const r=await pool.query('SELECT * FROM providers WHERE id=$1',[id]);if(!r.rowCount)return reply.code(404).send({error:'provider not found'});return{provider:r.rows[0]}});
app.post('/api/providers/:id/availability',async(request,reply)=>{const{id}=request.params as any;const user=await requireRole(request,reply,'provider');if(!user)return;if(String(user.provider_id)!==String(id))return reply.code(403).send({error:'forbidden'});const b=request.body as any;if(typeof b?.online!=='boolean')return reply.code(400).send({error:'online boolean is required'});await pool.query(`UPDATE providers SET is_online=$1,last_online_at=CASE WHEN $1 THEN NOW() ELSE last_online_at END,updated_at=NOW() WHERE id=$2`,[b.online,id]);if(Array.isArray(b.categoryIds)){await pool.query('DELETE FROM provider_categories WHERE provider_id=$1',[id]);for(const c of b.categoryIds)await pool.query(`INSERT INTO provider_categories(provider_id,category_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[id,c])}const r=await pool.query(`SELECT p.id,p.name,p.status,p.is_online,COALESCE(array_agg(pc.category_id) FILTER(WHERE pc.category_id IS NOT NULL),'{}') category_ids FROM providers p LEFT JOIN provider_categories pc ON pc.provider_id=p.id WHERE p.id=$1 GROUP BY p.id`,[id]);return{provider:r.rows[0]}});
app.get('/api/providers/:id/offers',async(request,reply)=>{const{id}=request.params as any;const user=await requireRole(request,reply,'provider');if(!user)return;if(String(user.provider_id)!==String(id))return reply.code(403).send({error:'forbidden'});const r=await pool.query(`SELECT o.id offer_id,o.status offer_status,o.offered_at,m.id mission_id,m.category_id,c.name category_name,m.description,m.scheduled_at,m.status mission_status FROM mission_offers o JOIN missions m ON m.id=o.mission_id LEFT JOIN categories c ON c.id=m.category_id WHERE o.provider_id=$1 AND o.status='pending' AND m.provider_id IS NULL ORDER BY o.offered_at`,[id]);return{offers:r.rows}});

app.post('/api/missions',async(request,reply)=>{const b=request.body as any;const user=await currentUser(request);const clientId=user?.role==='client'?Number(user.client_id):Number(b?.clientId||0);if(!clientId||!b?.categoryId)return reply.code(400).send({error:'clientId and categoryId are required'});const r=await pool.query(`INSERT INTO missions(client_id,category_id,description,scheduled_at) VALUES($1,$2,$3,$4) RETURNING *`,[clientId,b.categoryId,b.description?.trim()||null,b.scheduledAt||null]);const offersCreated=await dispatchMission(Number(r.rows[0].id),b.categoryId);const refreshed=await pool.query('SELECT * FROM missions WHERE id=$1',[r.rows[0].id]);return reply.code(201).send({mission:refreshed.rows[0],dispatch:{offersCreated}})});
app.get('/api/missions/:id',async(request,reply)=>{const{id}=request.params as any;const user=await currentUser(request);const r=await pool.query(`SELECT m.*,c.name category_name,c.hourly_rate_cents FROM missions m LEFT JOIN categories c ON c.id=m.category_id WHERE m.id=$1`,[id]);if(!r.rowCount)return reply.code(404).send({error:'mission not found'});const m=r.rows[0];if(user?.role==='client'&&String(m.client_id)!==String(user.client_id))return reply.code(403).send({error:'forbidden'});if(user?.role==='provider'&&String(m.provider_id)!==String(user.provider_id))return reply.code(403).send({error:'forbidden'});return{mission:m}});
app.get('/api/client/missions',async(request,reply)=>{const user=await requireRole(request,reply,'client');if(!user)return;const r=await pool.query(`SELECT m.id,m.category_id,c.name category_name,m.status,m.description,m.duration_minutes,m.created_at,m.completed_at,b.client_total_cents,b.billable_minutes,b.status billing_status,p.status payment_status FROM missions m LEFT JOIN categories c ON c.id=m.category_id LEFT JOIN mission_billing b ON b.mission_id=m.id LEFT JOIN payments p ON p.mission_id=m.id AND p.kind='client_charge' WHERE m.client_id=$1 ORDER BY m.created_at DESC`,[user.client_id]);return{missions:r.rows}});

app.post('/api/offers/:offerId/accept',async(request,reply)=>{const user=await requireRole(request,reply,'provider');if(!user)return;const{offerId}=request.params as any;const client=await pool.connect();try{await client.query('BEGIN');const o=await client.query(`SELECT id,mission_id,provider_id FROM mission_offers WHERE id=$1 AND provider_id=$2 AND status='pending' FOR UPDATE`,[offerId,user.provider_id]);if(!o.rowCount){await client.query('ROLLBACK');return reply.code(404).send({error:'pending offer not found'})}const x=o.rows[0];const m=await client.query(`UPDATE missions SET provider_id=$1,status='assigned',updated_at=NOW() WHERE id=$2 AND provider_id IS NULL RETURNING *`,[x.provider_id,x.mission_id]);if(!m.rowCount){await client.query(`UPDATE mission_offers SET status='expired',responded_at=NOW() WHERE id=$1`,[offerId]);await client.query('COMMIT');return reply.code(409).send({error:'mission already taken'})}await client.query(`UPDATE mission_offers SET status=CASE WHEN id=$1 THEN 'accepted' ELSE 'expired' END,responded_at=NOW() WHERE mission_id=$2`,[offerId,x.mission_id]);await client.query('COMMIT');return{mission:m.rows[0]}}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}});
app.post('/api/offers/:offerId/decline',async(request,reply)=>{const user=await requireRole(request,reply,'provider');if(!user)return;const{offerId}=request.params as any;const r=await pool.query(`UPDATE mission_offers SET status='declined',responded_at=NOW() WHERE id=$1 AND provider_id=$2 AND status='pending' RETURNING *`,[offerId,user.provider_id]);if(!r.rowCount)return reply.code(404).send({error:'pending offer not found'});return{offer:r.rows[0]}});

async function transitionMission(request:any,reply:any,from:string[],to:string,timestampColumn:string){const user=await requireRole(request,reply,'provider');if(!user)return;const{id}=request.params as any;const r=await pool.query(`UPDATE missions SET status=$1,${timestampColumn}=NOW(),updated_at=NOW() WHERE id=$2 AND provider_id=$3 AND status=ANY($4::text[]) RETURNING *`,[to,id,user.provider_id,from]);if(!r.rowCount)return reply.code(409).send({error:`mission cannot transition to ${to}`});return{mission:r.rows[0]}}
app.post('/api/missions/:id/en-route',async(request,reply)=>transitionMission(request,reply,['assigned'],'en_route','en_route_at'));
app.post('/api/missions/:id/arrive',async(request,reply)=>transitionMission(request,reply,['en_route'],'arrived','arrived_at'));
app.post('/api/missions/:id/start',async(request,reply)=>transitionMission(request,reply,['arrived'],'in_progress','started_at'));
app.post('/api/missions/:id/complete',async(request,reply)=>{const user=await requireRole(request,reply,'provider');if(!user)return;const{id}=request.params as any;const r=await pool.query(`UPDATE missions SET status='completed',completed_at=NOW(),duration_minutes=GREATEST(1,CEIL(EXTRACT(EPOCH FROM(NOW()-started_at))/60)::int),updated_at=NOW() WHERE id=$1 AND provider_id=$2 AND status='in_progress' AND started_at IS NOT NULL RETURNING *`,[id,user.provider_id]);if(!r.rowCount)return reply.code(409).send({error:'mission cannot be completed'});const billing=await finalizeBilling(Number(id));return{mission:r.rows[0],billing}});

app.get('/api/missions/:id/billing',async(request,reply)=>{const{id}=request.params as any;const user=await currentUser(request);if(!user)return reply.code(401).send({error:'authentication required'});const m=await pool.query('SELECT client_id,provider_id,status FROM missions WHERE id=$1',[id]);if(!m.rowCount)return reply.code(404).send({error:'mission not found'});const row=m.rows[0];if(user.role==='client'&&String(row.client_id)!==String(user.client_id))return reply.code(403).send({error:'forbidden'});if(user.role==='provider'&&String(row.provider_id)!==String(user.provider_id))return reply.code(403).send({error:'forbidden'});if(row.status==='completed'&&!(await pool.query('SELECT 1 FROM mission_billing WHERE mission_id=$1',[id])).rowCount)await finalizeBilling(Number(id));const r=await pool.query(`SELECT b.*,p.status payment_status,p.payment_method,p.paid_at,pp.status payout_status,pp.release_at,pp.paid_at payout_paid_at FROM mission_billing b LEFT JOIN payments p ON p.mission_id=b.mission_id AND p.kind='client_charge' LEFT JOIN provider_payouts pp ON pp.mission_id=b.mission_id WHERE b.mission_id=$1`,[id]);if(!r.rowCount)return reply.code(409).send({error:'billing is not ready yet'});return{billing:r.rows[0],paymentsMode:PAYMENTS_MODE}});

app.post('/api/missions/:id/pay/mock',async(request,reply)=>{if(PAYMENTS_MODE==='live')return reply.code(404).send({error:'mock payments disabled'});const user=await requireRole(request,reply,'client');if(!user)return;const{id}=request.params as any;const m=await pool.query(`SELECT id,status FROM missions WHERE id=$1 AND client_id=$2`,[id,user.client_id]);if(!m.rowCount)return reply.code(404).send({error:'mission not found'});if(m.rows[0].status!=='completed')return reply.code(409).send({error:'mission must be completed before payment'});const billing=await finalizeBilling(Number(id));if(!billing)return reply.code(409).send({error:'billing unavailable'});await pool.query(`UPDATE payments SET status='paid',payment_method='mock',provider='mock',paid_at=NOW(),updated_at=NOW() WHERE mission_id=$1 AND kind='client_charge'`,[id]);await pool.query(`UPDATE mission_billing SET status='paid',updated_at=NOW() WHERE mission_id=$1`,[id]);await pool.query(`UPDATE provider_payouts SET status='holding',release_at=NOW()+INTERVAL '7 days',updated_at=NOW() WHERE mission_id=$1`,[id]);const paid=await pool.query(`SELECT b.*,p.status payment_status,p.payment_method,p.paid_at,pp.status payout_status,pp.release_at FROM mission_billing b LEFT JOIN payments p ON p.mission_id=b.mission_id AND p.kind='client_charge' LEFT JOIN provider_payouts pp ON pp.mission_id=b.mission_id WHERE b.mission_id=$1`,[id]);return{billing:paid.rows[0],mock:true}});

app.get('/api/provider/payouts',async(request,reply)=>{const user=await requireRole(request,reply,'provider');if(!user)return;const r=await pool.query(`SELECT pp.*,m.category_id,c.name category_name,m.duration_minutes FROM provider_payouts pp JOIN missions m ON m.id=pp.mission_id LEFT JOIN categories c ON c.id=m.category_id WHERE pp.provider_id=$1 ORDER BY pp.created_at DESC`,[user.provider_id]);return{payouts:r.rows}});

app.addHook('onClose',async()=>{await pool.end()});
const port=Number(process.env.PORT??3000);const host=process.env.HOST??'0.0.0.0';
initializeDatabase().then(()=>app.listen({port,host})).catch(error=>{app.log.error(error);process.exit(1)});
