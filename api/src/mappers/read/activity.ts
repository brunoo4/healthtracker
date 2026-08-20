// src/mappers/read/activity.ts
import type { Activity as PrismaActivity } from '@/generated/prisma/client.js';
import type { Activity } from '@/types/domain.js';

export function toActivityResponse(row: PrismaActivity): Activity {
  return {
    id: row.id,
    garminActivityId: row.garminActivityId,
    activityType: row.activityType,
    sport: row.sport as Activity['sport'],
    name: row.name,

    date: row.date.toISOString().slice(0, 10),
    startedAt: toLocalIsoString(row.startedAt),
    startedAtGmt: row.startedAtGmt.toISOString(),

    durationS: row.durationS,
    movingDurationS: row.movingDurationS,

    distanceM: row.distanceM,
    avgSpeedMps: row.avgSpeedMps,
    maxSpeedMps: row.maxSpeedMps,

    avgHrBpm: row.avgHrBpm,
    maxHrBpm: row.maxHrBpm,
    calories: row.calories,

    elevationGainM: row.elevationGainM,
    elevationLossM: row.elevationLossM,

    avgCadenceSpm: row.avgCadenceSpm,
    maxCadenceSpm: row.maxCadenceSpm,
    avgStrideLengthM: row.avgStrideLengthM,

    trainingEffectAerobic: row.trainingEffectAerobic,
    trainingEffectAnaerobic: row.trainingEffectAnaerobic,
    trainingLoad: row.trainingLoad,
    vo2maxEstimated: row.vo2maxEstimated,

    createdAt: row.createdAt.toISOString()
  };
}

function toLocalIsoString(date: Date): string {
  // extrai os componentes UTC (que é como o Timestamp sem fuso foi guardado)
  // e monta a string local, sem o Z
  return date.toISOString().slice(0, 19); // '2026-07-20T12:20:19', sem o .000Z
}
