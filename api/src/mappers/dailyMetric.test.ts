import { describe, it, expect } from 'vitest';
import { toDailyMetric } from './dailyMetric.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ingestionDailyMetricSchema,
  type IngestionDailyMetric
} from '../types/ingestion.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// Dois cenários de borda: um dia completo (todos os sensores reportaram) e um
// dia esparso (só passos, o resto nulo — típico de dia sem relógio no pulso).
// Os testes fazem spread + override a partir daqui.

const rawFull: IngestionDailyMetric = {
  date: '2026-07-20',
  steps: 8421,
  active_calories: 512,
  floors_climbed: 12,
  resting_heart_rate_bpm: 54,
  min_heart_rate_bpm: 48,
  max_heart_rate_bpm: 168,
  stress_avg: 33,
  stress_max: 88,
  body_battery_charged: 71,
  body_battery_drained: 60,
  body_battery_max: 94,
  body_battery_min: 24,
  hrv_last_night_ms: 62,
  hrv_5min_high_ms: 98,
  hrv_weekly_avg_ms: 65,
  hrv_status: 'balanced',
  hrv_baseline_low_ms: 55,
  hrv_baseline_high_ms: 80,
  sleep_duration_s: 27000,
  sleep_deep_s: 5400,
  sleep_light_s: 15000,
  sleep_rem_s: 6000,
  sleep_awake_s: 600,
  sleep_score: 82,
  readiness_score: 76,
  readiness_level: 'ready',
  recovery_time_min: 180
};

const rawSparse: IngestionDailyMetric = {
  date: '2026-07-21',
  steps: 1203,
  active_calories: null,
  floors_climbed: null,
  resting_heart_rate_bpm: null,
  min_heart_rate_bpm: null,
  max_heart_rate_bpm: null,
  stress_avg: null,
  stress_max: null,
  body_battery_charged: null,
  body_battery_drained: null,
  body_battery_max: null,
  body_battery_min: null,
  hrv_last_night_ms: null,
  hrv_5min_high_ms: null,
  hrv_weekly_avg_ms: null,
  hrv_status: null,
  hrv_baseline_low_ms: null,
  hrv_baseline_high_ms: null,
  sleep_duration_s: null,
  sleep_deep_s: null,
  sleep_light_s: null,
  sleep_rem_s: null,
  sleep_awake_s: null,
  sleep_score: null,
  readiness_score: null,
  readiness_level: null,
  recovery_time_min: null
};

describe('toDailyMetric', () => {
  it('mapeia todos os campos de um dia completo (âncora)', () => {
    const expected: Prisma.DailyMetricCreateInput = {
      date: new Date('2026-07-20'),
      steps: 8421,
      activeCalories: 512,
      floorsClimbed: 12,
      restingHeartRateBpm: 54,
      minHeartRateBpm: 48,
      maxHeartRateBpm: 168,
      stressAvg: 33,
      stressMax: 88,
      bodyBatteryCharged: 71,
      bodyBatteryDrained: 60,
      bodyBatteryMax: 94,
      bodyBatteryMin: 24,
      hrv5minHighMs: 98,
      hrvWeeklyAvgMs: 65,
      hrvStatus: 'balanced',
      hrvBaselineLowMs: 55,
      hrvBaselineHighMs: 80,
      sleepDurationS: 27000,
      sleepDeepS: 5400,
      sleepLightS: 15000,
      sleepRemS: 6000,
      sleepAwakeS: 600,
      sleepScore: 82,
      readinessScore: 76,
      readinessLevel: 'ready',
      recoveryTimeMin: 180
    };

    expect(toDailyMetric(rawFull)).toEqual(expected);
  });

  it('converte date em um Date à meia-noite UTC', () => {
    const data = toDailyMetric(rawFull);
    expect(data.date).toBeInstanceOf(Date);
    expect(data.date).toEqual(new Date('2026-07-20'));
    expect((data.date as Date).toISOString()).toBe('2026-07-20T00:00:00.000Z');
  });

  it('preserva os nulos de um dia esparso', () => {
    const data = toDailyMetric(rawSparse);
    expect(data.steps).toBe(1203);
    expect(data.activeCalories).toBeNull();
    expect(data.restingHeartRateBpm).toBeNull();
    expect(data.hrvStatus).toBeNull();
    expect(data.sleepScore).toBeNull();
    expect(data.readinessLevel).toBeNull();
    expect(data.recoveryTimeMin).toBeNull();
  });

  it('não propaga hrv_last_night_ms (não existe no modelo)', () => {
    expect('hrvLastNightMs' in toDailyMetric(rawFull)).toBe(false);
  });

  it('não define id nem createdAt (ficam nos defaults do banco)', () => {
    const data = toDailyMetric(rawFull);
    expect(data.id).toBeUndefined();
    expect(data.createdAt).toBeUndefined();
  });

  it('as fixtures são payloads de ingestão válidos', () => {
    expect(() => ingestionDailyMetricSchema.parse(rawFull)).not.toThrow();
    expect(() => ingestionDailyMetricSchema.parse(rawSparse)).not.toThrow();
  });
});
