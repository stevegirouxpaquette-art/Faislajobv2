import Fastify from 'fastify';
import { createPool } from './db.js';

const pool = createPool();
const app = Fastify({ logger: true });

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
    )
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

app.get('/health', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { ok: true, service: 'faislajob-api', version: '0.3.0', database: 'connected' };
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
  const result = await pool.query(
    `INSERT INTO clients (name, email, phone) VALUES ($1, $2, $3)
     RETURNING id, name, email, phone, created_at`,
    [body.name.trim(), body.email?.trim() || null, body.phone?.trim() || null],
  );
  return reply.code(201).send({ client: result.rows[0] });
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
     RETURNING id, name, email, phone, status, created_at`,
    [body.name.trim(), body.email?.trim() || null, body.phone?.trim() || null],
  );
  return reply.code(201).send({ provider: result.rows[0] });
});

app.get('/api/providers/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const result = await pool.query('SELECT id, name, email, phone, status, created_at, updated_at FROM providers WHERE id = $1', [id]);
  if (!result.rowCount) return reply.code(404).send({ error: 'provider not found' });
  return { provider: result.rows[0] };
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
  return reply.code(201).send({ mission: result.rows[0] });
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
     WHERE id = $2
     RETURNING id, client_id, provider_id, category_id, status, description, scheduled_at, updated_at`,
    [body.providerId, id],
  );
  if (!result.rowCount) return reply.code(404).send({ error: 'mission not found' });
  return { mission: result.rows[0] };
});

app.addHook('onClose', async () => { await pool.end(); });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

initializeDatabase()
  .then(() => app.listen({ port, host }))
  .catch((error) => { app.log.error(error); process.exit(1); });
