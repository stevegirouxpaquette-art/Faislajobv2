import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createPool } from './db.js';

const pool = createPool();
const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });

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

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

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
    `SELECT u.id, u.email, u.role, u.client_id, u.provider_id,
            COALESCE(c.name, p.name) AS name,
            COALESCE(c.phone, p.phone) AS phone
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN clients c ON c.id = u.client_id
       LEFT JOIN providers p ON p.id = u.provider_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1`,
    [tokenHash(token)],
  );
  return result.rows[0] ?? null;
}

async function requireRole(request: any, reply: any, role: 'client' | 'provider') {
  const user = await currentUser(request);
  if (!user) {
    reply.code(401).send({ error: 'authentication required' });
    return null;
  }
  if (user.role !== role) {
    reply.code(403).send({ error: `${role} account required` });
    return null;
  }
  return user;
}

async function createSession(reply: any, userId: number) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
    [userId, tokenHash(token)],
  );
  reply.header('Set-Cookie', sessionCookie(token, 60 * 60 * 24 * 30));
}

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
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('client','provider')),
      client_id BIGINT UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
      provider_id BIGINT UNIQUE REFERENCES providers(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK ((role='client' AND client_id IS NOT NULL AND provider_id IS NULL) OR
             (role='provider' AND provider_id IS NOT NULL AND client_id IS NULL))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
  `);
  for (const category of defaultCategories) {
    await pool.query(`INSERT INTO categories (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`, [category.id, category.name]);
  }
  await pool.query(`DELETE FROM sessions WHERE expires_at <= NOW()`);
}

async function dispatchMission(missionId: number, categoryId: string) {
  const providers = await pool.query(`SELECT p.id FROM providers p JOIN provider_categories pc ON pc.provider_id=p.id WHERE p.status='active' AND p.is_online=TRUE AND pc.category_id=$1`, [categoryId]);
  for (const provider of providers.rows) await pool.query(`INSERT INTO mission_offers (mission_id,provider_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [missionId, provider.id]);
  if (providers.rowCount) await pool.query(`UPDATE missions SET status='offered',updated_at=NOW() WHERE id=$1 AND provider_id IS NULL`, [missionId]);
  return providers.rowCount ?? 0;
}

app.get('/health', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { ok: true, service: 'faislajob-api', version: '0.7.0', database: 'connected' };
  } catch (error) {
    app.log.error(error);
    return reply.code(503).send({ ok: false, service: 'faislajob-api', database: 'disconnected' });
  }
});

app.post('/api/auth/register', async (request, reply) => {
  const body = request.body as { name?: string; email?: string; phone?: string; password?: string; role?: string };
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const phone = body?.phone?.trim() || null;
  const password = body?.password || '';
  const role = body?.role;
  if (!name || !email || !['client', 'provider'].includes(role || '')) return reply.code(400).send({ error: 'name, email and valid role are required' });
  if (password.length < 8) return reply.code(400).send({ error: 'password must contain at least 8 characters' });
  if (!email.includes('@')) return reply.code(400).send({ error: 'valid email is required' });
  const existingUser = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existingUser.rowCount) return reply.code(409).send({ error: 'an account already exists with this email' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let profileId: number;
    if (role === 'client') {
      const existing = await client.query('SELECT id FROM clients WHERE LOWER(email)=$1 LIMIT 1', [email]);
      if (existing.rowCount) {
        profileId = Number(existing.rows[0].id);
        await client.query('UPDATE clients SET name=$1, phone=$2, updated_at=NOW() WHERE id=$3', [name, phone, profileId]);
      } else {
        const profile = await client.query('INSERT INTO clients(name,email,phone) VALUES($1,$2,$3) RETURNING id', [name, email, phone]);
        profileId = Number(profile.rows[0].id);
      }
    } else {
      const existing = await client.query('SELECT id FROM providers WHERE LOWER(email)=$1 LIMIT 1', [email]);
      if (existing.rowCount) {
        profileId = Number(existing.rows[0].id);
        await client.query(`UPDATE providers SET name=$1, phone=$2, status='active', updated_at=NOW() WHERE id=$3`, [name, phone, profileId]);
      } else {
        const profile = await client.query(`INSERT INTO providers(name,email,phone,status) VALUES($1,$2,$3,'active') RETURNING id`, [name, email, phone]);
        profileId = Number(profile.rows[0].id);
      }
    }
    const userResult = await client.query(
      `INSERT INTO users(email,password_hash,role,client_id,provider_id)
       VALUES($1,$2,$3,$4,$5) RETURNING id,email,role,client_id,provider_id`,
      [email, hashPassword(password), role, role === 'client' ? profileId : null, role === 'provider' ? profileId : null],
    );
    await client.query('COMMIT');
    await createSession(reply, Number(userResult.rows[0].id));
    return reply.code(201).send({ user: { ...userResult.rows[0], name, phone } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (request, reply) => {
  const body = request.body as { email?: string; password?: string };
  const email = body?.email?.trim().toLowerCase();
  if (!email || !body?.password) return reply.code(400).send({ error: 'email and password are required' });
  const result = await pool.query(
    `SELECT u.id,u.email,u.password_hash,u.role,u.client_id,u.provider_id,
            COALESCE(c.name,p.name) AS name, COALESCE(c.phone,p.phone) AS phone
       FROM users u LEFT JOIN clients c ON c.id=u.client_id LEFT JOIN providers p ON p.id=u.provider_id
      WHERE u.email=$1 LIMIT 1`,
    [email],
  );
  const user = result.rows[0];
  if (!user || !verifyPassword(body.password, user.password_hash)) return reply.code(401).send({ error: 'invalid email or password' });
  await createSession(reply, Number(user.id));
  delete user.password_hash;
  return { user };
});

app.post('/api/auth/logout', async (request, reply) => {
  const token = cookieValue(request.headers.cookie, 'faislajob_session');
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(token)]);
  reply.header('Set-Cookie', sessionCookie('', 0));
  return { ok: true };
});

app.get('/api/auth/me', async (request, reply) => {
  const user = await currentUser(request);
  if (!user) return reply.code(401).send({ error: 'not authenticated' });
  return { user };
});

app.get('/api/categories', async () => ({ categories: (await pool.query('SELECT id,name FROM categories ORDER BY name')).rows }));

app.post('/api/clients', async (request, reply) => {
  const body = request.body as any;
  if (!body?.name?.trim()) return reply.code(400).send({ error: 'name is required' });
  const email = body.email?.trim().toLowerCase() || null;
  if (email) {
    const existing = await pool.query('SELECT * FROM clients WHERE LOWER(email)=$1 LIMIT 1', [email]);
    if (existing.rowCount) return { client: existing.rows[0], existing: true };
  }
  const result = await pool.query(`INSERT INTO clients(name,email,phone) VALUES($1,$2,$3) RETURNING id,name,email,phone,created_at`, [body.name.trim(), email, body.phone?.trim() || null]);
  return reply.code(201).send({ client: result.rows[0], existing: false });
});

app.get('/api/providers/:id', async (request, reply) => {
  const { id } = request.params as any;
  const user = await requireRole(request, reply, 'provider');
  if (!user) return;
  if (String(user.provider_id) !== String(id)) return reply.code(403).send({ error: 'forbidden' });
  const result = await pool.query('SELECT * FROM providers WHERE id=$1', [id]);
  if (!result.rowCount) return reply.code(404).send({ error: 'provider not found' });
  return { provider: result.rows[0] };
});

app.post('/api/providers/:id/availability', async (request, reply) => {
  const { id } = request.params as any;
  const user = await requireRole(request, reply, 'provider');
  if (!user) return;
  if (String(user.provider_id) !== String(id)) return reply.code(403).send({ error: 'forbidden' });
  const body = request.body as any;
  if (typeof body?.online !== 'boolean') return reply.code(400).send({ error: 'online boolean is required' });
  await pool.query(`UPDATE providers SET is_online=$1,last_online_at=CASE WHEN $1 THEN NOW() ELSE last_online_at END,updated_at=NOW() WHERE id=$2`, [body.online, id]);
  if (Array.isArray(body.categoryIds)) {
    await pool.query('DELETE FROM provider_categories WHERE provider_id=$1', [id]);
    for (const categoryId of body.categoryIds) await pool.query(`INSERT INTO provider_categories(provider_id,category_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [id, categoryId]);
  }
  const result = await pool.query(`SELECT p.id,p.name,p.status,p.is_online,COALESCE(array_agg(pc.category_id) FILTER(WHERE pc.category_id IS NOT NULL),'{}') category_ids FROM providers p LEFT JOIN provider_categories pc ON pc.provider_id=p.id WHERE p.id=$1 GROUP BY p.id`, [id]);
  return { provider: result.rows[0] };
});

app.get('/api/providers/:id/offers', async (request, reply) => {
  const { id } = request.params as any;
  const user = await requireRole(request, reply, 'provider');
  if (!user) return;
  if (String(user.provider_id) !== String(id)) return reply.code(403).send({ error: 'forbidden' });
  const result = await pool.query(`SELECT o.id offer_id,o.status offer_status,o.offered_at,m.id mission_id,m.category_id,c.name category_name,m.description,m.scheduled_at,m.status mission_status FROM mission_offers o JOIN missions m ON m.id=o.mission_id LEFT JOIN categories c ON c.id=m.category_id WHERE o.provider_id=$1 AND o.status='pending' AND m.provider_id IS NULL ORDER BY o.offered_at`, [id]);
  return { offers: result.rows };
});

app.post('/api/missions', async (request, reply) => {
  const body = request.body as any;
  const user = await currentUser(request);
  const clientId = user?.role === 'client' ? Number(user.client_id) : Number(body?.clientId || 0);
  if (!clientId || !body?.categoryId) return reply.code(400).send({ error: 'clientId and categoryId are required' });
  const result = await pool.query(`INSERT INTO missions(client_id,category_id,description,scheduled_at) VALUES($1,$2,$3,$4) RETURNING *`, [clientId, body.categoryId, body.description?.trim() || null, body.scheduledAt || null]);
  const offersCreated = await dispatchMission(Number(result.rows[0].id), body.categoryId);
  const refreshed = await pool.query('SELECT * FROM missions WHERE id=$1', [result.rows[0].id]);
  return reply.code(201).send({ mission: refreshed.rows[0], dispatch: { offersCreated } });
});

app.get('/api/missions/:id', async (request, reply) => {
  const { id } = request.params as any;
  const user = await currentUser(request);
  const result = await pool.query(`SELECT m.*,c.name category_name FROM missions m LEFT JOIN categories c ON c.id=m.category_id WHERE m.id=$1`, [id]);
  if (!result.rowCount) return reply.code(404).send({ error: 'mission not found' });
  const mission = result.rows[0];
  if (user?.role === 'client' && String(mission.client_id) !== String(user.client_id)) return reply.code(403).send({ error: 'forbidden' });
  if (user?.role === 'provider' && String(mission.provider_id) !== String(user.provider_id)) return reply.code(403).send({ error: 'forbidden' });
  return { mission };
});

app.post('/api/offers/:offerId/accept', async (request, reply) => {
  const user = await requireRole(request, reply, 'provider');
  if (!user) return;
  const { offerId } = request.params as any;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const offer = await client.query(`SELECT id,mission_id,provider_id FROM mission_offers WHERE id=$1 AND provider_id=$2 AND status='pending' FOR UPDATE`, [offerId, user.provider_id]);
    if (!offer.rowCount) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'pending offer not found' }); }
    const row = offer.rows[0];
    const mission = await client.query(`UPDATE missions SET provider_id=$1,status='assigned',updated_at=NOW() WHERE id=$2 AND provider_id IS NULL RETURNING *`, [row.provider_id, row.mission_id]);
    if (!mission.rowCount) { await client.query(`UPDATE mission_offers SET status='expired',responded_at=NOW() WHERE id=$1`, [offerId]); await client.query('COMMIT'); return reply.code(409).send({ error: 'mission already taken' }); }
    await client.query(`UPDATE mission_offers SET status=CASE WHEN id=$1 THEN 'accepted' ELSE 'expired' END,responded_at=NOW() WHERE mission_id=$2`, [offerId, row.mission_id]);
    await client.query('COMMIT');
    return { mission: mission.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
});

app.post('/api/offers/:offerId/decline', async (request, reply) => {
  const user = await requireRole(request, reply, 'provider');
  if (!user) return;
  const { offerId } = request.params as any;
  const result = await pool.query(`UPDATE mission_offers SET status='declined',responded_at=NOW() WHERE id=$1 AND provider_id=$2 AND status='pending' RETURNING *`, [offerId, user.provider_id]);
  if (!result.rowCount) return reply.code(404).send({ error: 'pending offer not found' });
  return { offer: result.rows[0] };
});

async function transitionMission(request: any, reply: any, from: string[], to: string, timestampColumn: string) {
  const user = await requireRole(request, reply, 'provider');
  if (!user) return;
  const { id } = request.params as any;
  const result = await pool.query(`UPDATE missions SET status=$1,${timestampColumn}=NOW(),updated_at=NOW() WHERE id=$2 AND provider_id=$3 AND status=ANY($4::text[]) RETURNING *`, [to, id, user.provider_id, from]);
  if (!result.rowCount) return reply.code(409).send({ error: `mission cannot transition to ${to}` });
  return { mission: result.rows[0] };
}

app.post('/api/missions/:id/en-route', async (request, reply) => transitionMission(request, reply, ['assigned'], 'en_route', 'en_route_at'));
app.post('/api/missions/:id/arrive', async (request, reply) => transitionMission(request, reply, ['en_route'], 'arrived', 'arrived_at'));
app.post('/api/missions/:id/start', async (request, reply) => transitionMission(request, reply, ['arrived'], 'in_progress', 'started_at'));
app.post('/api/missions/:id/complete', async (request, reply) => {
  const user = await requireRole(request, reply, 'provider');
  if (!user) return;
  const { id } = request.params as any;
  const result = await pool.query(`UPDATE missions SET status='completed',completed_at=NOW(),duration_minutes=GREATEST(1,CEIL(EXTRACT(EPOCH FROM (NOW()-started_at))/60)::int),updated_at=NOW() WHERE id=$1 AND provider_id=$2 AND status='in_progress' AND started_at IS NOT NULL RETURNING *`, [id, user.provider_id]);
  if (!result.rowCount) return reply.code(409).send({ error: 'mission cannot be completed' });
  return { mission: result.rows[0] };
});

app.addHook('onClose', async () => { await pool.end(); });
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
initializeDatabase().then(() => app.listen({ port, host })).catch(error => { app.log.error(error); process.exit(1); });
