import type {
  IngestionActivity,
  IngestionSplit,
  IngestionHrZone
} from '../types/ingestion.js';
import type { Sport } from '../types/domain.js';
import { MappedActivity, MappedHrZone, MappedSplit } from '@/types/mapped.js';

const SPORT_BY_ACTIVITY_TYPE: Record<string, Sport> = {
  running: 'run',
  treadmill_running: 'run',
  strength_training: 'strength'
};

export function toSport(activityType: string): Sport {
  const sport = SPORT_BY_ACTIVITY_TYPE[activityType];

  if (sport === undefined) {
    console.warn(
      `[mapper] activity_type desconhecido: "${activityType}" → mapeado como "other"`
    );
    return 'other';
  }

  return sport;
}

function toSplitCreate(split: IngestionSplit): MappedSplit {
  return {
    index: split.index,
    distanceM: split.distance_m,
    durationS: split.duration_s,
    avgSpeedMps: split.avg_speed_mps,
    avgHrBpm: split.avg_hr_bpm,
    maxHrBpm: split.max_hr_bpm,
    elevationGainM: split.elevation_gain_m
  };
}

function toHrZoneCreate(zone: IngestionHrZone): MappedHrZone {
  return {
    zone: zone.zone,
    secondsInZone: zone.seconds_in_zone,
    zoneLowBpm: zone.zone_low_bpm
  };
}

export function toActivity(raw: IngestionActivity): MappedActivity {
  return {
    activity: {
      garminActivityId: raw.activity_id,
      activityType: raw.activity_type,
      sport: toSport(raw.activity_type),
      name: raw.name,

      date: raw.date,
      startedAt: raw.started_at,
      startedAtGmt: raw.started_at_gmt,

      durationS: raw.duration_s,
      movingDurationS: raw.moving_duration_s,

      distanceM: raw.distance_m,
      avgSpeedMps: raw.avg_speed_mps,
      maxSpeedMps: raw.max_speed_mps,

      avgHrBpm: raw.avg_hr_bpm,
      maxHrBpm: raw.max_hr_bpm,
      calories: raw.calories,

      elevationGainM: raw.elevation_gain_m,
      elevationLossM: raw.elevation_loss_m,

      avgCadenceSpm: raw.avg_cadence_spm,
      maxCadenceSpm: raw.max_cadence_spm,
      avgStrideLengthM: raw.avg_stride_length_m,

      trainingEffectAerobic: raw.training_effect_aerobic,
      trainingEffectAnaerobic: raw.training_effect_anaerobic,
      trainingLoad: raw.training_load,
      vo2maxEstimated: raw.vo2max_estimated
    },
    splits: raw.splits.map(toSplitCreate),
    hrZones: raw.hr_zones.map(toHrZoneCreate)
  };
}
