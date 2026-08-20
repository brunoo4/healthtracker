import { MetricsService } from '@/services/metrics.js';
import { ApiResponse, DailyMetric } from '@/types/domain.js';
import { DailyQuery } from '@/types/requests.js';

export function makeMetricsController(service: MetricsService) {
  return {
    async getDaily(query: DailyQuery) {
      const metrics = await service.getDaily(query);

      return {
        data: metrics
      } satisfies ApiResponse<DailyMetric[]>;
    }
  };
}

export type MetricsController = ReturnType<typeof makeMetricsController>;
