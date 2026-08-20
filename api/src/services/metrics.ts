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
      const diffMs =
        new Date(query.to).getTime() - new Date(query.from).getTime();
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffDays = Math.floor(diffMs / msPerDay);

      if (diffDays > 365) {
        throw new ValidationError(
          'O intervalo não pode ser maior que 365 dias'
        );
      }

      // regra: intervalo máximo de 365 dias
      // (cálculo aqui)

      return repository.findDaily(query);
    }
  };
}

export type MetricsService = ReturnType<typeof makeMetricsService>;
