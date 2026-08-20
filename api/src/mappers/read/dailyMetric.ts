// src/mappers/read/dailyMetric.ts
import type { DailyMetric as PrismaDailyMetric } from '@/generated/prisma/client.js';
import type { DailyMetric } from '@/types/domain.js';

export function toDailyMetricResponse(row: PrismaDailyMetric): DailyMetric {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),

    // Atividade geral
    steps: row.steps,
    activeCalories: row.activeCalories,
    floorsClimbed: row.floorsClimbed,

    // Cardio
    restingHeartRateBpm: row.restingHeartRateBpm,
    minHeartRateBpm: row.minHeartRateBpm,
    maxHeartRateBpm: row.maxHeartRateBpm,

    // Estresse
    stressAvg: row.stressAvg,
    stressMax: row.stressMax,

    // Body battery
    bodyBatteryCharged: row.bodyBatteryCharged,
    bodyBatteryDrained: row.bodyBatteryDrained,
    bodyBatteryMax: row.bodyBatteryMax,
    bodyBatteryMin: row.bodyBatteryMin,

    // HRV
    hrvWeeklyAvgMs: row.hrvWeeklyAvgMs,
    hrv5minHighMs: row.hrv5minHighMs,
    hrvStatus: row.hrvStatus as DailyMetric['hrvStatus'],
    hrvBaselineLowMs: row.hrvBaselineLowMs,
    hrvBaselineHighMs: row.hrvBaselineHighMs,

    // Sono
    sleepDurationS: row.sleepDurationS,
    sleepDeepS: row.sleepDeepS,
    sleepLightS: row.sleepLightS,
    sleepRemS: row.sleepRemS,
    sleepAwakeS: row.sleepAwakeS,
    sleepScore: row.sleepScore,

    // Readiness
    readinessScore: row.readinessScore,
    readinessLevel: row.readinessLevel as DailyMetric['readinessLevel'],
    recoveryTimeMin: row.recoveryTimeMin,

    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
