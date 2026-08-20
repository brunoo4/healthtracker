// src/repositories/metrics.ts
import type { PrismaClient } from '@/generated/prisma/client.js';
import { toDailyMetricResponse } from '@/mappers/read/dailyMetric.js';
import type { DailyMetric } from '@/types/domain.js';
import { DailyQuery } from '@/types/requests.js';

export function makeMetricsRepository(prisma: PrismaClient) {
  return {
    async findDaily(query: DailyQuery): Promise<DailyMetric[]> {
      const rows = await prisma.dailyMetric.findMany({
        where: {
          date: {
            gte: new Date(query.from),
            lte: new Date(query.to)
          }
        },
        orderBy: { date: 'asc' }
      });

      return rows.map(toDailyMetricResponse);
    }
  };
}

export type MetricsRepository = ReturnType<typeof makeMetricsRepository>;
