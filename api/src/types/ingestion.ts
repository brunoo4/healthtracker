import { z } from 'zod';
import {
  calendarDateSchema,
  localDateTimeSchema,
  utcDateTimeSchema
} from './primitives.js';

/** Versão do script Python que este parser entende. */
export const SUPPORTED_SCHEMA_VERSION = 3;

//Descreve o bloco meta do JSON
export const ingestionMetaSchema = z.object({
  schema_version: z.literal(SUPPORTED_SCHEMA_VERSION), //O literal serve para restringir o valor recebido. Nesse caso, a versão do schema (declarado no garmin_insights.py) tem que bater com o SUPPORTED_SCHEMA_VERSION.
  generated_at: localDateTimeSchema,
  start_date: calendarDateSchema,
  end_date: calendarDateSchema,
  period_days: z.int()
});

export const ingestionDailyMetricSchema = z.object({
  date: calendarDateSchema,
  steps: z.int().nullable(),
  active_calories: z.int().nullable(),
  floors_climbed: z.int().nullable(),
  resting_heart_rate_bpm: z.int().nullable(),
  min_heart_rate_bpm: z.int().nullable(),
  max_heart_rate_bpm: z.int().nullable(),
  stress_avg: z.int().nullable(),
  stress_max: z.int().nullable(),
  body_battery_charged: z.int().nullable(),
  body_battery_drained: z.int().nullable(),
  body_battery_max: z.int().nullable(),
  body_battery_min: z.int().nullable(),
  hrv_last_night_ms: z.int().nullable(),
  hrv_5min_high_ms: z.int().nullable(),
  hrv_weekly_avg_ms: z.int().nullable(),
  hrv_status: z.string().nullable(),
  hrv_baseline_low_ms: z.int().nullable(),
  hrv_baseline_high_ms: z.int().nullable(),
  sleep_duration_s: z.int().nullable(),
  sleep_deep_s: z.int().nullable(),
  sleep_light_s: z.int().nullable(),
  sleep_rem_s: z.int().nullable(),
  sleep_awake_s: z.int().nullable(),
  sleep_score: z.int().nullable(),
  readiness_score: z.int().nullable(),
  readiness_level: z.string().nullable(),
  recovery_time_min: z.int().nullable()
});

const ingestionSplitSchema = z.object({
  index: z.int().min(1),
  distance_m: z.number().nullable(),
  duration_s: z.number().nullable(),
  avg_speed_mps: z.number().nullable(),
  avg_hr_bpm: z.int().nullable(),
  max_hr_bpm: z.int().nullable(),
  elevation_gain_m: z.number().nullable()
});

const ingestionHrZoneSchema = z.object({
  zone: z.int().min(1).max(5),
  seconds_in_zone: z.number(),
  zone_low_bpm: z.number()
});

export const ingestionActivitySchema = z.object({
  activity_id: z.string(),
  activity_type: z.string(),
  name: z.string().nullable(),
  date: calendarDateSchema,
  started_at: localDateTimeSchema,
  started_at_gmt: utcDateTimeSchema,
  duration_s: z.number(),
  moving_duration_s: z.number().nullable(),
  distance_m: z.number().nullable(),
  avg_speed_mps: z.number().nullable(),
  max_speed_mps: z.number().nullable(),
  avg_hr_bpm: z.int().nullable(),
  max_hr_bpm: z.int().nullable(),
  calories: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable(),
  avg_cadence_spm: z.number().nullable(),
  max_cadence_spm: z.number().nullable(),
  avg_stride_length_m: z.number().nullable(),
  training_effect_aerobic: z.number().nullable(),
  training_effect_anaerobic: z.number().nullable(),
  training_load: z.number().nullable(),
  vo2max_estimated: z.number().nullable(),
  splits: z.array(ingestionSplitSchema),
  hr_zones: z.array(ingestionHrZoneSchema)
});

const ingestionFitnessSchema = z.object({
  race_prediction_5k_s: z.int().nullable(),
  race_prediction_10k_s: z.int().nullable(),
  race_prediction_half_s: z.int().nullable(),
  race_prediction_full_s: z.int().nullable()
});

export const ingestionPayloadSchema = z.object({
  meta: ingestionMetaSchema,
  daily_metrics: z.array(z.unknown()),
  activities: z.array(z.unknown()),
  fitness: ingestionFitnessSchema
});

export type IngestionMeta = z.infer<typeof ingestionMetaSchema>;
export type IngestionDailyMetric = z.infer<typeof ingestionDailyMetricSchema>;
export type IngestionSplit = z.infer<typeof ingestionSplitSchema>;
export type IngestionHrZone = z.infer<typeof ingestionHrZoneSchema>;
export type IngestionActivity = z.infer<typeof ingestionActivitySchema>;
export type IngestionFitness = z.infer<typeof ingestionFitnessSchema>;
export type IngestionPayload = z.infer<typeof ingestionPayloadSchema>;
