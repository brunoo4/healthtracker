import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingest } from './ingest.js';

// Prisma falso: só o método que o ingest usa
function makeFakePrisma() {
  const tx = {
    activity: {
      upsert: vi.fn().mockResolvedValue({ id: 'activity-uuid-1' })
    },
    activitySplit: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({})
    },
    activityHrZone: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({})
    }
  };

  return {
    tx, // exposto pra inspecionar nos asserts
    dailyMetric: {
      upsert: vi.fn().mockResolvedValue({})
    },
    racePrediction: {
      upsert: vi.fn().mockResolvedValue({})
    },
    syncLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      update: vi.fn().mockResolvedValue({})
    },
    // executa a callback passando o tx — isto é o que faz os asserts funcionarem
    $transaction: vi.fn(async (cb) => cb(tx))
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

function validActivity(overrides = {}) {
  return {
    activity_id: '19283746',
    activity_type: 'running',
    name: 'Corrida matinal',
    date: '2026-07-20',
    started_at: '2026-07-20T06:12:00',
    started_at_gmt: '2026-07-20T09:12:00Z',
    duration_s: 1834.2,
    moving_duration_s: 1801,
    distance_m: 5012.4,
    avg_speed_mps: 2.73,
    max_speed_mps: 3.9,
    avg_hr_bpm: 152,
    max_hr_bpm: 171,
    calories: 320.5,
    elevation_gain_m: 42,
    elevation_loss_m: 40,
    avg_cadence_spm: 168,
    max_cadence_spm: 180,
    avg_stride_length_m: 0.98,
    training_effect_aerobic: 3.1,
    training_effect_anaerobic: 0.4,
    training_load: 88,
    vo2max_estimated: 52,
    splits: [
      {
        index: 1,
        distance_m: 1000,
        duration_s: 366,
        avg_speed_mps: 2.7,
        avg_hr_bpm: 148,
        max_hr_bpm: 158,
        elevation_gain_m: 8
      },
      {
        index: 2,
        distance_m: 1000,
        duration_s: 360,
        avg_speed_mps: 2.8,
        avg_hr_bpm: 155,
        max_hr_bpm: 162,
        elevation_gain_m: 6
      }
    ],
    hr_zones: [
      { zone: 1, seconds_in_zone: 200, zone_low_bpm: 104 },
      { zone: 2, seconds_in_zone: 800, zone_low_bpm: 124 }
    ],
    ...overrides
  };
}

function nullFitness() {
  return {
    race_prediction_5k_s: null,
    race_prediction_10k_s: null,
    race_prediction_half_s: null,
    race_prediction_full_s: null
  };
}

function makePayload(
  opts: {
    dailyMetrics?: unknown[];
    activities?: unknown[];
    fitness?: unknown;
  } = {}
) {
  return {
    meta: {
      schema_version: 3,
      generated_at: '2026-07-21T10:00:00',
      start_date: '2026-07-14',
      end_date: '2026-07-21',
      period_days: 7
    },
    daily_metrics: opts.dailyMetrics ?? [],
    activities: opts.activities ?? [],
    fitness: opts.fitness ?? nullFitness()
  } as any;
}

describe('ingest — daily_metrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('processa todos os registros válidos', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload({
      dailyMetrics: [
        validDailyMetric('2026-07-14'),
        validDailyMetric('2026-07-15'),
        validDailyMetric('2026-07-16')
      ]
    });

    const result = await ingest(prisma as any, payload);

    // 3 daily_metrics + 1 race_prediction (sempre processado)
    expect(result.processed).toBe(4);
    expect(result.failed).toBe(0);
    expect(prisma.dailyMetric.upsert).toHaveBeenCalledTimes(3);
  });

  it('pula registro inválido e continua os demais', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prisma = makeFakePrisma();
    const payload = makePayload({
      dailyMetrics: [
        validDailyMetric('2026-07-14'),
        { date: 'not-a-date' }, // inválido
        validDailyMetric('2026-07-16')
      ]
    });

    const result = await ingest(prisma as any, payload);

    expect(result.processed).toBe(3);
    expect(result.failed).toBe(1);
    expect(prisma.dailyMetric.upsert).toHaveBeenCalledTimes(2);
  });

  it('usa date como chave do upsert', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload({
      dailyMetrics: [validDailyMetric('2026-07-14')]
    });

    await ingest(prisma as any, payload);

    expect(prisma.dailyMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: expect.anything() }
      })
    );
  });
});

describe('ingest — activities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('grava atividade e seus filhos dentro da transação', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload({ activities: [validActivity()] });

    await ingest(prisma as any, payload);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tx.activity.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.tx.activitySplit.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.tx.activityHrZone.createMany).toHaveBeenCalledTimes(1);
  });

  it('limpa filhos antigos antes de recriar (idempotência)', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload({ activities: [validActivity()] });

    await ingest(prisma as any, payload);

    // deleteMany tem que rodar — é o que impede duplicação no re-sync
    expect(prisma.tx.activitySplit.deleteMany).toHaveBeenCalledWith({
      where: { activityId: 'activity-uuid-1' }
    });
    expect(prisma.tx.activityHrZone.deleteMany).toHaveBeenCalledWith({
      where: { activityId: 'activity-uuid-1' }
    });
  });

  it('injeta o activityId do pai nos filhos', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload({ activities: [validActivity()] });

    await ingest(prisma as any, payload);

    const splitCall = prisma.tx.activitySplit.createMany.mock.calls[0][0];
    expect(
      splitCall.data.every((s: any) => s.activityId === 'activity-uuid-1')
    ).toBe(true);
  });

  it('usa garminActivityId como chave do upsert', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload({ activities: [validActivity()] });

    await ingest(prisma as any, payload);

    expect(prisma.tx.activity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { garminActivityId: '19283746' }
      })
    );
  });

  it('pula atividade inválida sem interromper as demais', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prisma = makeFakePrisma();
    const payload = makePayload({
      activities: [
        validActivity(),
        { activity_id: 'broken' },
        validActivity({ activity_id: '999' })
      ]
    });

    const result = await ingest(prisma as any, payload);

    expect(result.failed).toBe(1);
    expect(prisma.tx.activity.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('ingest — race_prediction', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('grava previsão usando date derivada do meta', async () => {
    const prisma = makeFakePrisma();
    const payload = makePayload({
      fitness: {
        race_prediction_5k_s: 1500,
        race_prediction_10k_s: 3200,
        race_prediction_half_s: 7000,
        race_prediction_full_s: 15000
      }
    });

    await ingest(prisma as any, payload);

    expect(prisma.racePrediction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: expect.anything() }
      })
    );
  });
});
