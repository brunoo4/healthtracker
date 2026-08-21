import { ValidationError } from '@/errors.js';
import { MetricsRepository } from '@/repositories/metrics.js';
import { DailyMetric } from '@/types/domain.js';
import { DailyQuery } from '@/types/requests.js';

export function makeMetricsService(repository: MetricsRepository) {
  return {
    async getDaily(query: DailyQuery): Promise<DailyMetric[]> {
      if (query.from > query.to) {
        throw new ValidationError('from não pode ser maior que to');
      }
      return repository.findDaily(query);
    }
  };
}

export type MetricsService = ReturnType<typeof makeMetricsService>;
