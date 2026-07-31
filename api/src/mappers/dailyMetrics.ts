import { Prisma } from '@/generated/prisma/client.js';
import { IngestionDailyMetric } from '@/types/ingestion.js';

export function toDailyMetrics(
  raw: IngestionDailyMetric
): Prisma.DailyMetricCreateInput {
  return {
    date: new Date(raw.date),
    steps: raw.steps,
    activeCalories: raw.active_calories,
    floorsClimbed: raw.floors_climbed,
    restingHeartRateBpm: raw.resting_heart_rate_bpm,
    minHeartRateBpm: raw.min_heart_rate_bpm,
    maxHeartRateBpm: raw.max_heart_rate_bpm,
    stressAvg: raw.stress_avg,
    stressMax: raw.stress_max,
    bodyBatteryCharged: raw.body_battery_charged,
    bodyBatteryDrained: raw.body_battery_drained,
    bodyBatteryMax: raw.body_battery_max,
    bodyBatteryMin: raw.body_battery_min,
    hrv5minHighMs: raw.hrv_5min_high_ms,
    hrvWeeklyAvgMs: raw.hrv_weekly_avg_ms,
    hrvStatus: raw.hrv_status,
    hrvBaselineLowMs: raw.hrv_baseline_low_ms,
    hrvBaselineHighMs: raw.hrv_baseline_high_ms,
    sleepDurationS: raw.sleep_duration_s,
    sleepDeepS: raw.sleep_deep_s,
    sleepLightS: raw.sleep_light_s,
    sleepRemS: raw.sleep_rem_s,
    sleepAwakeS: raw.sleep_awake_s,
    sleepScore: raw.sleep_score,
    readinessScore: raw.readiness_score,
    readinessLevel: raw.readiness_level,
    recoveryTimeMin: raw.recovery_time_min
  };
}
