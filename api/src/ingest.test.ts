import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingest } from './ingest.js';

// Prisma falso: só o método que o ingest usa
function makeFakePrisma() {
  return {
    dailyMetric: {
      upsert: vi.fn().mockResolvedValue({})
    }
  };
}

// payload mínimo válido — só os campos que o schema exige
function validDailyMetric(date: string) {
  return {
    date,
    steps: 5000,
    active_calories: 300,
    floors_climbed: 4,
    resting_heart_rate_bpm: 50,
    min_heart_rate_bpm: 45,
    max_heart_rate_bpm: 120,
    stress_avg: 30,
    stress_max: 80,
    body_battery_charged: 60,
    body_battery_drained: 55,
    body_battery_max: 90,
    body_battery_min: 20,
    hrv_last_night_ms: 65,
    hrv_5min_high_ms: 90,
    hrv_weekly_avg_ms: 60,
    hrv_status: 'BALANCED',
    hrv_baseline_low_ms: 45,
    hrv_baseline_high_ms: 75,
    sleep_duration_s: 28000,
    sleep_deep_s: 6000,
    sleep_light_s: 15000,
    sleep_rem_s: 7000,
    sleep_awake_s: 1000,
    sleep_score: 85,
    readiness_score: 90,
    readiness_level: 'PRIME',
    recovery_time_min: 12
  };
}

function makePayload(dailyMetric: unknown[]) {
  return {
    meta: {
      schema_version: 3,
      generated_at: '2026-07-21T10:00:00',
      start_date: '2026-07-14',
      end_date: '2026-07-21',
      period_days: 7
    },
    daily_metrics: dailyMetric,
    activities: [],
    fitness: {
      race_prediction_5k_s: null,
      race_prediction_10k_s: null,
      race_prediction_half_s: null,
      race_prediction_full_s: null
    }
  } as any;
}

describe('ingest — daily_metrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('processa todos os registros válidos', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload([
      validDailyMetric('2026-07-14'),
      validDailyMetric('2026-07-15'),
      validDailyMetric('2026-07-16')
    ]);

    const result = await ingest(prisma as any, payload);

    expect(result.processed).toBe(3);
    expect(result.failed).toBe(0);
    expect(prisma.dailyMetric.upsert).toHaveBeenCalledTimes(3);
  });

  it('pula registro inválido e continua os demais', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prisma = makeFakePrisma();
    const payload = makePayload([
      validDailyMetric('2026-07-14'),
      { date: 'not-a-date' }, // inválido
      validDailyMetric('2026-07-16')
    ]);

    const result = await ingest(prisma as any, payload);

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(prisma.dailyMetric.upsert).toHaveBeenCalledTimes(2);
  });

  it('usa date como chave do upsert', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload([validDailyMetric('2026-07-14')]);

    await ingest(prisma as any, payload);

    expect(prisma.dailyMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: expect.anything() }
      })
    );
  });
});
