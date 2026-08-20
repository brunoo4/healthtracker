import { z } from 'zod';
import {
  calendarDateSchema,
  localDateTimeSchema,
  utcDateTimeSchema
} from './primitives.js';

/**
 * Tipos de domínio do garmin-dashboard.
 *
 * Descrevem a entidade persistida e a forma serializada que sai na resposta
 * HTTP. Não descrevem a entrada da ingestão: o JSON cru do script Python tem
 * outro vocabulário (snake_case, sem id nem timestamps) e é validado em
 * `ingestion.ts`. A tradução entre os dois vive nos mappers.
 *
 * Os schemas Zod são a fonte; os tipos saem por `z.infer`. É o que o RNF01
 * pede — tipo derivado da validação, não duplicado à mão.
 */

// ── Vocabulários do Garmin ────────────────────────────────────────────────────
//
// Modelados como texto no banco e união fechada aqui. Um enum nativo do
// Postgres exigiria migration para cada valor novo que a Garmin introduzisse,
// e a ingestão quebraria até lá. Segurança de tipo onde importa, tolerância
// onde é preciso.

export const hrvStatusSchema = z.enum(['BALANCED', 'LOW', 'UNBALANCED']);
export const readinessLevelSchema = z.enum([
  'PRIME',
  'HIGH',
  'MODERATE',
  'LOW',
  'POOR'
]);
export const activityTypeSchema = z.enum([
  'running',
  'treadmill_running',
  'strength_training'
]);

/** Família do esporte. `other` é o destino de tipo novo do Garmin. */
export const sportSchema = z.enum(['run', 'strength', 'other']);

export const syncStatusSchema = z.enum([
  'running',
  'success',
  'failure',
  'partial'
]);

export type HrvStatus = z.infer<typeof hrvStatusSchema>;
export type ReadinessLevel = z.infer<typeof readinessLevelSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type Sport = z.infer<typeof sportSchema>;
export type SyncStatus = z.infer<typeof syncStatusSchema>;

// ── daily_metrics ─────────────────────────────────────────────────────────────

export const dailyMetricSchema = z.object({
  id: z.uuid(),
  date: calendarDateSchema,

  // Atividade geral
  steps: z.int().nullable(),
  activeCalories: z.int().nullable(),
  floorsClimbed: z.int().nullable(),

  // Cardio
  restingHeartRateBpm: z.int().nullable(),
  minHeartRateBpm: z.int().nullable(),
  maxHeartRateBpm: z.int().nullable(),

  // Estresse
  stressAvg: z.int().nullable(),
  stressMax: z.int().nullable(),

  // Body battery
  bodyBatteryCharged: z.int().nullable(),
  bodyBatteryDrained: z.int().nullable(),
  bodyBatteryMax: z.int().nullable(),
  bodyBatteryMin: z.int().nullable(),

  // HRV. Sem média semanal: é a média móvel de 7 dias de hrvLastNightMs
  // (desvio de -1,43 a +0,43 ms em 31 dias) e o RF04.2 já exige que a API
  // calcule a própria tendência.
  hrvWeeklyAvgMs: z.int().nullable(),
  hrv5minHighMs: z.int().nullable(),
  hrvStatus: hrvStatusSchema.nullable(),
  hrvBaselineLowMs: z.int().nullable(),
  hrvBaselineHighMs: z.int().nullable(),

  // Sono
  sleepDurationS: z.int().nullable(),
  sleepDeepS: z.int().nullable(),
  sleepLightS: z.int().nullable(),
  sleepRemS: z.int().nullable(),
  sleepAwakeS: z.int().nullable(),
  sleepScore: z.int().nullable(),

  // Readiness
  readinessScore: z.int().nullable(),
  readinessLevel: readinessLevelSchema.nullable(),
  recoveryTimeMin: z.int().nullable(),

  createdAt: utcDateTimeSchema,
  updatedAt: utcDateTimeSchema
});

export type DailyMetric = z.infer<typeof dailyMetricSchema>;

// ── activities ────────────────────────────────────────────────────────────────

export const activitySchema = z.object({
  id: z.uuid(),
  /** Identificador de origem. Texto: não sofre aritmética nem tem limite. */
  garminActivityId: z.string(),
  /** Tipo cru do Garmin — usado no detalhe. */
  activityType: z.string(),
  /** Família — usada em filtro e agregação, senão esteira não conta como corrida. */
  sport: sportSchema,
  name: z.string().nullable(),

  /** Dia local da atividade. Chave de cruzamento com dailyMetric.date. */
  date: calendarDateSchema,
  /** Horário local, sem fuso: para exibir sem recalcular. */
  startedAt: localDateTimeSchema,
  /** UTC. Fonte da verdade para ordenação e cursor de paginação. */
  startedAtGmt: utcDateTimeSchema,

  durationS: z.number(),
  movingDurationS: z.number().nullable(),

  // Nulo, não zero, em atividade sem deslocamento: zero contaminaria
  // qualquer média de distância ou pace. Pace é derivado de avgSpeedMps
  // na leitura, e por isso não existe como campo.
  distanceM: z.number().nullable(),
  avgSpeedMps: z.number().nullable(),
  maxSpeedMps: z.number().nullable(),

  avgHrBpm: z.int().nullable(),
  maxHrBpm: z.int().nullable(),
  calories: z.number().nullable(),

  elevationGainM: z.number().nullable(),
  elevationLossM: z.number().nullable(),

  avgCadenceSpm: z.number().nullable(),
  maxCadenceSpm: z.number().nullable(),
  avgStrideLengthM: z.number().nullable(),

  trainingEffectAerobic: z.number().nullable(),
  trainingEffectAnaerobic: z.number().nullable(),
  trainingLoad: z.number().nullable(),
  vo2maxEstimated: z.number().nullable(),

  createdAt: utcDateTimeSchema
});

export type Activity = z.infer<typeof activitySchema>;

// ── activity_splits ───────────────────────────────────────────────────────────

export const activitySplitSchema = z.object({
  id: z.uuid(),
  activityId: z.uuid(),
  index: z.int().min(1),
  distanceM: z.number().nullable(),
  durationS: z.number().nullable(),
  avgSpeedMps: z.number().nullable(),
  avgHrBpm: z.int().nullable(),
  maxHrBpm: z.int().nullable(),
  elevationGainM: z.number().nullable()
});

export type ActivitySplit = z.infer<typeof activitySplitSchema>;

// ── activity_hr_zones ─────────────────────────────────────────────────────────

export const activityHrZoneSchema = z.object({
  id: z.uuid(),
  activityId: z.uuid(),
  zone: z.int().min(1).max(5),
  /** Zero aqui é medição: zona não utilizada no treino. */
  secondsInZone: z.number(),
  /** Limite vigente naquele treino — os limites mudam ao longo do tempo. */
  zoneLowBpm: z.number()
});

export type ActivityHrZone = z.infer<typeof activityHrZoneSchema>;

// ── race_predictions ──────────────────────────────────────────────────────────

export const racePredictionSchema = z.object({
  id: z.uuid(),
  /** Obter a data do meta.generated_at */
  date: calendarDateSchema,
  racePrediction5kS: z.int().nullable(),
  racePrediction10kS: z.int().nullable(),
  racePredictionHalfS: z.int().nullable(),
  racePredictionFullS: z.int().nullable(),
  createdAt: utcDateTimeSchema
});

export type RacePrediction = z.infer<typeof racePredictionSchema>;

// ── sync_logs ─────────────────────────────────────────────────────────────────

export const syncLogSchema = z.object({
  id: z.uuid(),
  startedAt: utcDateTimeSchema,
  /** Nulo enquanto roda. É esse estado que barra execução concorrente (RF05.3). */
  finishedAt: utcDateTimeSchema.nullable(),
  status: syncStatusSchema,
  /** Período processado, exigido pelo RF01.4. */
  periodStart: calendarDateSchema,
  periodEnd: calendarDateSchema,
  recordsProcessed: z.int(),
  errorMessage: z.string().nullable()
});

export type SyncLog = z.infer<typeof syncLogSchema>;
