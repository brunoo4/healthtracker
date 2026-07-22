import { fastify } from 'fastify'; //Entender o motivo
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import { fastifySwagger } from '@fastify/swagger';
import { fastifyCors } from '@fastify/cors';
import SacalarApiReference from '@scalar/fastify-api-reference';
import { routes } from './routes';
import { fastifySwaggerUi } from '@fastify/swagger-ui';

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Health Tracker API',
      version: '1.0.0'
    }
  },
  transform: jsonSchemaTransform
});

app.register(fastifySwaggerUi, {
  routePrefix: '/docs'
});

app.listen({ port: 3333, host: '0.0.0.0' }).then(() => {
  console.log('HTTP server running!');
});

app.register(routes);
