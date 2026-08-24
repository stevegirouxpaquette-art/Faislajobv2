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
    await pool.query(
      `INSERT INTO categories (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [category.id, category.name],
    );
  }
}

async function dispatchMission(missionId: number, categoryId: string) {
  const providers = await pool.query(
    `SELECT p.id
       FROM providers p
       JOIN provider_categories pc ON pc.provider_id = p.id
      WHERE p.status = 'active'
        AND p.is_online = TRUE
        AND pc.category_id = $1`,
    [categoryId],
  );

  if (!providers.rowCount) return 0;

  for (const provider of providers.rows) {
    await pool.query(
      `INSERT INTO mission_offers (mission_id, provider_id)
       VALUES ($1, $2)
       ON CONFLICT (mission_id, provider_id) DO NOTHING`,
      [missionId, provider.id],
    );
  }

  await pool.query(
    `UPDATE missions SET status = 'offered', updated_at = NOW()
      WHERE id = $1 AND provider_id IS NULL`,
    [missionId],
  );

  return providers.rowCount ?? 0;
}

app.get('/health', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { ok: true, service: 'faislajob-api', version: '0.5.0', database: 'connected' };
  } catch (error) {
    app.log.error(error);
    return reply.code(503).send({ ok: false, service: 'faislajob-api', database: 'disconnected' });
  }
});

app.get('/api/categories', async () => {
  const result = await pool.query('SELECT id, name FROM categories ORDER BY name ASC');
  return { categories: result.rows };
});

app.post('/api/clients', async (request, reply) => {
  const body = request.body as { name?: string; email?: string; phone?: string };
  if (!body?.name?.trim()) return reply.code(400).send({ error: 'name is required' });

  const name = body.name.trim();
  const email = body.email?.trim().toLowerCase() || null;
  const phone = body.phone?.trim() || null;

  if (email) {
    const existing = await pool.query(
      `SELECT id, name, email, phone, created_at FROM clients WHERE LOWER(email) = $1 LIMIT 1`,
      [email],
    );
    if (existing.rowCount) {
      const updated = await pool.query(
        `UPDATE clients SET name = $1, phone = $2, updated_at = NOW() WHERE id = $3
         RETURNING id, name, email, phone, created_at`,
        [name, phone, existing.rows[0].id],
      );
      return { client: updated.rows[0], existing: true };
    }
  }

  const result = await pool.query(
    `INSERT INTO clients (name, email, phone) VALUES ($1, $2, $3)
     RETURNING id, name, email, phone, created_at`,
    [name, email, phone],
  );
  return reply.code(201).send({ client: result.rows[0], existing: false });
});

app.get('/api/clients/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = await pool.query('SELECT id, name, email, phone, created_at, updated_at FROM clients WHERE id = $1', [id]);
  if (!result.rowCount) return reply.code(404).send({ error: 'client not found' });
  return { client: result.rows[0] };
});

app.post('/api/providers', async (request, reply) => {
  const body = request.body as { name?: string; email?: string; phone?: string };
  if (!body?.name?.trim()) return reply.code(400).send({ error: 'name is required' });
  const result = await pool.query(
    `INSERT INTO providers (name, email, phone, status) VALUES ($1, $2, $3, 'active')
     RETURNING id, name, email, phone, status, is_online, created_at`,
    [body.name.trim(), body.email?.trim() || null, body.phone?.trim() || null],
  );
  return reply.code(201).send({ provider: result.rows[0] });
});

app.get('/api/providers/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = await pool.query('SELECT id, name, email, phone, status, is_online, last_online_at, created_at, updated_at FROM providers WHERE id = $1', [id]);
  if (!result.rowCount) return reply.code(404).send({ error: 'provider not found' });
  return { provider: result.rows[0] };
});

app.post('/api/providers/:id/availability', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { online?: boolean; categoryIds?: string[] };
  if (typeof body?.online !== 'boolean') return reply.code(400).send({ error: 'online boolean is required' });

  const provider = await pool.query('SELECT id FROM providers WHERE id = $1 AND status = $2', [id, 'active']);
  if (!provider.rowCount) return reply.code(404).send({ error: 'active provider not found' });

  await pool.query(
    `UPDATE providers SET is_online = $1, last_online_at = CASE WHEN $1 THEN NOW() ELSE last_online_at END, updated_at = NOW() WHERE id = $2`,
    [body.online, id],
  );

  if (Array.isArray(body.categoryIds)) {
    await pool.query('DELETE FROM provider_categories WHERE provider_id = $1', [id]);
    for (const categoryId of body.categoryIds) {
      await pool.query(
        `INSERT INTO provider_categories (provider_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, categoryId],
      );
    }
  }

  const result = await pool.query(
    `SELECT p.id, p.name, p.status, p.is_online,
            COALESCE(array_agg(pc.category_id) FILTER (WHERE pc.category_id IS NOT NULL), '{}') AS category_ids
       FROM providers p
       LEFT JOIN provider_categories pc ON pc.provider_id = p.id
      WHERE p.id = $1
      GROUP BY p.id`,
    [id],
  );
  return { provider: result.rows[0] };
});

app.get('/api/providers/:id/offers', async (request) => {
  const { id } = request.params as { id: string };
  const result = await pool.query(
    `SELECT o.id AS offer_id, o.status AS offer_status, o.offered_at,
            m.id AS mission_id, m.category_id, c.name AS category_name,
            m.description, m.scheduled_at, m.status AS mission_status
       FROM mission_offers o
       JOIN missions m ON m.id = o.mission_id
       LEFT JOIN categories c ON c.id = m.category_id
      WHERE o.provider_id = $1 AND o.status = 'pending' AND m.provider_id IS NULL
      ORDER BY o.offered_at ASC`,
    [id],
  );
  return { offers: result.rows };
});

app.post('/api/missions', async (request, reply) => {
  const body = request.body as { clientId?: number; categoryId?: string; description?: string; scheduledAt?: string };
  if (!body?.clientId || !body?.categoryId) return reply.code(400).send({ error: 'clientId and categoryId are required' });
  const result = await pool.query(
    `INSERT INTO missions (client_id, category_id, description, scheduled_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, client_id, provider_id, category_id, status, description, scheduled_at, created_at`,
    [body.clientId, body.categoryId, body.description?.trim() || null, body.scheduledAt || null],
  );
  const mission = result.rows[0];
  const offersCreated = await dispatchMission(Number(mission.id), body.categoryId);
  const refreshed = await pool.query('SELECT * FROM missions WHERE id = $1', [mission.id]);
  return reply.code(201).send({ mission: refreshed.rows[0], dispatch: { offersCreated } });
});

app.get('/api/missions/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = await pool.query(
    `SELECT m.id, m.client_id, m.provider_id, m.category_id, c.name AS category_name,
            m.status, m.description, m.scheduled_at, m.created_at, m.updated_at
     FROM missions m LEFT JOIN categories c ON c.id = m.category_id WHERE m.id = $1`,
    [id],
  );
  if (!result.rowCount) return reply.code(404).send({ error: 'mission not found' });
  return { mission: result.rows[0] };
});

app.post('/api/missions/:id/assign', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { providerId?: number };
  if (!body?.providerId) return reply.code(400).send({ error: 'providerId is required' });
  const provider = await pool.query('SELECT id FROM providers WHERE id = $1 AND status = $2', [body.providerId, 'active']);
  if (!provider.rowCount) return reply.code(404).send({ error: 'active provider not found' });
  const result = await pool.query(
    `UPDATE missions SET provider_id = $1, status = 'assigned', updated_at = NOW()
     WHERE id = $2 AND provider_id IS NULL
     RETURNING id, client_id, provider_id, category_id, status, description, scheduled_at, updated_at`,
    [body.providerId, id],
  );
  if (!result.rowCount) return reply.code(409).send({ error: 'mission already assigned or not found' });
  await pool.query(`UPDATE mission_offers SET status = CASE WHEN provider_id = $1 THEN 'accepted' ELSE 'expired' END, responded_at = NOW() WHERE mission_id = $2`, [body.providerId, id]);
  return { mission: result.rows[0] };
});

app.post('/api/offers/:offerId/accept', async (request, reply) => {
  const { offerId } = request.params as { offerId: string };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const offer = await client.query(
      `SELECT o.id, o.mission_id, o.provider_id
         FROM mission_offers o
        WHERE o.id = $1 AND o.status = 'pending'
        FOR UPDATE`,
      [offerId],
    );
    if (!offer.rowCount) {
      await client.query('ROLLBACK');
      return reply.code(404).send({ error: 'pending offer not found' });
    }

    const row = offer.rows[0];
    const mission = await client.query(
      `UPDATE missions SET provider_id = $1, status = 'assigned', updated_at = NOW()
        WHERE id = $2 AND provider_id IS NULL
        RETURNING id, client_id, provider_id, category_id, status, description, scheduled_at, updated_at`,
      [row.provider_id, row.mission_id],
    );

    if (!mission.rowCount) {
      await client.query(`UPDATE mission_offers SET status = 'expired', responded_at = NOW() WHERE id = $1`, [offerId]);
      await client.query('COMMIT');
      return reply.code(409).send({ error: 'mission already taken' });
    }

    await client.query(
      `UPDATE mission_offers
          SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'expired' END,
              responded_at = NOW()
        WHERE mission_id = $2`,
      [offerId, row.mission_id],
    );
    await client.query('COMMIT');
    return { mission: mission.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/api/offers/:offerId/decline', async (request, reply) => {
  const { offerId } = request.params as { offerId: string };
  const result = await pool.query(
    `UPDATE mission_offers SET status = 'declined', responded_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING id, mission_id, provider_id, status`,
    [offerId],
  );
  if (!result.rowCount) return reply.code(404).send({ error: 'pending offer not found' });
  return { offer: result.rows[0] };
});

app.addHook('onClose', async () => { await pool.end(); });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

initializeDatabase()
  .then(() => app.listen({ port, host }))
  .catch((error) => { app.log.error(error); process.exit(1); });
