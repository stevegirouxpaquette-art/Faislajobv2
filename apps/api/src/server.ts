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
    return {
      ok: true,
      service: 'faislajob-api',
      version: '0.1.0',
      database: 'connected',
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(503).send({
      ok: false,
      service: 'faislajob-api',
      database: 'disconnected',
    });
  }
});

app.get('/api/categories', async () => {
  const result = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM categories ORDER BY name ASC',
  );

  return { categories: result.rows };
});

app.addHook('onClose', async () => {
  await pool.end();
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

initializeDatabase()
  .then(() => app.listen({ port, host }))
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
