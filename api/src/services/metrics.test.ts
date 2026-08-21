// src/services/metrics.test.ts
import { describe, it, expect, vi } from 'vitest';
import { makeMetricsService } from './metrics.js';
import { ValidationError } from '@/errors.js';

function makeFakeRepo() {
  return {
    findDaily: vi.fn().mockResolvedValue([])
  };
}

describe('metricsService.getDaily', () => {
  it('lança se from é posterior a to', async () => {
    const repo = makeFakeRepo();
    const service = makeMetricsService(repo as any);

    await expect(
      service.getDaily({ from: '2026-07-20', to: '2026-07-14' })
    ).rejects.toThrow(ValidationError);

    // regra barrou antes de tocar o repositório
    expect(repo.findDaily).not.toHaveBeenCalled();
  });

  it('delega ao repositório quando o intervalo é válido', async () => {
    const repo = makeFakeRepo();
    const service = makeMetricsService(repo as any);

    await service.getDaily({ from: '2026-07-14', to: '2026-07-20' });

    expect(repo.findDaily).toHaveBeenCalledWith({
      from: '2026-07-14',
      to: '2026-07-20'
    });
  });
});
