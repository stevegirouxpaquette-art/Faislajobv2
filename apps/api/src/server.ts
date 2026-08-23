import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({
  ok: true,
  service: 'faislajob-api',
  version: '0.1.0',
}));

app.get('/api/categories', async () => ({
  categories: [
    { id: 'menage', name: 'Ménage' },
    { id: 'reparations', name: 'Petites réparations' },
    { id: 'exterieur', name: 'Terrain & extérieur' },
    { id: 'demenagement', name: 'Déménagement' },
    { id: 'deneigement', name: 'Déneigement' },
    { id: 'animaux', name: 'Animaux' },
  ],
}));

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
