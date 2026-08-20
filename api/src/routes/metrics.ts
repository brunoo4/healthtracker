import { MetricsController } from '@/controllers/metrics.js';
import { FastifyTypedInstance } from '@/types/fastify.js';
import { dailyQuerySchema } from '@/types/requests.js';

export async function metricsRoutes(
  fastify: FastifyTypedInstance,
  controller: MetricsController
) {
  fastify.get(
    '/v1/metrics/daily',
    {
      schema: {
        querystring: dailyQuerySchema
      }
    },
    async (request, reply) => {
      const result = await controller.getDaily(request.query);
      return reply.send(result);
    }
  );
}
