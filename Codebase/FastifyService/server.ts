import Fastify from 'fastify';

const fastify = Fastify({
  logger: true
});

fastify.get('/', async () => {
  return { message: 'NeoTerritory Fastify auxiliary service is online' };
});

fastify.post('/analyze', async (request) => {
  const { code, filename } = request.body as { code: string; filename?: string };
  
  // Placeholder for future JavaScript-based analysis logic
  return {
    status: 'ok',
    patterns: [
      { pattern_id: 'js.fastify.adapter.example', confidence: 0.98 }
    ]
  };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 8000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Fastify service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
