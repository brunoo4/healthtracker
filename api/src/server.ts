import { fastify } from 'fastify';
import 'dotenv/config';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import { fastifySwagger } from '@fastify/swagger';
import { fastifySwaggerUi } from '@fastify/swagger-ui';
import { prisma, pool } from '@/db.js';

import { makeMetricsRepository } from '@/repositories/metrics.js';
import { makeMetricsService } from '@/services/metrics.js';
import { makeMetricsController } from '@/controllers/metrics.js';
import { metricsRoutes } from '@/routes/metrics.js';
import { registerErrorHandler } from '@/errors.js';

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// tratamento de erro central
registerErrorHandler(app);

app.register(fastifySwagger, {
  openapi: { info: { title: 'Health Tracker API', version: '1.0.0' } },
  transform: jsonSchemaTransform
});
app.register(fastifySwaggerUi, { routePrefix: '/docs' });

const metricsController = makeMetricsController(
  makeMetricsService(makeMetricsRepository(prisma))
);

// registra as rotas, injetando o controller
app.register(async (instance) => {
  await metricsRoutes(instance, metricsController);
});

app
  .listen({ port: 3333, host: '0.0.0.0' })
  .then(() => {
    console.log('HTTP server running on :3333');
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

app.addHook('onClose', async () => {
  await prisma.$disconnect();
  await pool.end();
});
