import pg from 'pg';

const { Pool } = pg;

export function createPool(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return new Pool({ connectionString: databaseUrl });
}
