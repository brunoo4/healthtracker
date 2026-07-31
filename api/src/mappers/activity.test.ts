import { describe, it, expect, vi } from 'vitest';
import { toSport, toActivity } from './activity.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ingestionActivitySchema,
  type IngestionActivity
} from '../types/ingestion.js';

describe('toSport', () => {
  it('mapeia running para run', () => {
    expect(toSport('running')).toBe('run');
  });

  it('mapeia treadmill_running para run', () => {
    expect(toSport('treadmill_running')).toBe('run');
  });

  it('mapeia strength_training para strength', () => {
    expect(toSport('strength_training')).toBe('strength');
  });

  it('mapeia tipo desconhecido para other', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(toSport('beach_volleyball')).toBe('other');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// Dois cenários de borda do domínio: uma corrida (com deslocamento, splits e
// zonas) e uma musculação (sem deslocamento — distância, velocidade, cadência e
// passada nulas, sem splits nem zonas). Os testes fazem spread + override a
// partir daqui.

const rawRunning: IngestionActivity = {
  activity_id: '19283746',
  activity_type: 'running',
  name: 'Corrida matinal',
  date: '2026-07-20',
  started_at: '2026-07-20T06:12:00',
  started_at_gmt: '2026-07-20T09:12:00Z',
  duration_s: 1834.2,
  moving_duration_s: 1801.0,
  distance_m: 5012.4,
  avg_speed_mps: 2.73,
  max_speed_mps: 3.9,
  avg_hr_bpm: 152,
  max_hr_bpm: 171,
  calories: 320.5,
  elevation_gain_m: 42.0,
  elevation_loss_m: 40.0,
  avg_cadence_spm: 168.0,
  max_cadence_spm: 182.0,
  avg_stride_length_m: 0.98,
  training_effect_aerobic: 3.1,
  training_effect_anaerobic: 0.4,
  training_load: 88.0,
  vo2max_estimated: 52.0,
  splits: [
    {
      index: 1,
      distance_m: 1000.0,
      duration_s: 366.0,
      avg_speed_mps: 2.73,
      avg_hr_bpm: 148,
      max_hr_bpm: 158,
      elevation_gain_m: 8.0
    },
    {
      index: 2,
      distance_m: 1000.0,
      duration_s: 372.0,
      avg_speed_mps: 2.69,
      avg_hr_bpm: 155,
      max_hr_bpm: 164,
      elevation_gain_m: 6.0
    }
  ],
  hr_zones: [
    { zone: 2, seconds_in_zone: 900.0, zone_low_bpm: 121.0 },
    { zone: 3, seconds_in_zone: 610.0, zone_low_bpm: 140.0 }
  ]
};

const rawStrength: IngestionActivity = {
  activity_id: '55667788',
  activity_type: 'strength_training',
  name: null,
  date: '2026-07-21',
  started_at: '2026-07-21T18:00:00',
  started_at_gmt: '2026-07-21T21:00:00Z',
  duration_s: 2700.0,
  moving_duration_s: null,
  distance_m: null,
  avg_speed_mps: null,
  max_speed_mps: null,
  avg_hr_bpm: 118,
  max_hr_bpm: 149,
  calories: 240.0,
  elevation_gain_m: null,
  elevation_loss_m: null,
  avg_cadence_spm: null,
  max_cadence_spm: null,
  avg_stride_length_m: null,
  training_effect_aerobic: 1.2,
  training_effect_anaerobic: 2.4,
  training_load: 55.0,
  vo2max_estimated: null,
  splits: [],
  hr_zones: []
};

describe('toActivity', () => {
  it('mapeia todos os campos da corrida (âncora)', () => {
    const expected: Prisma.ActivityCreateInput = {
      garminActivityId: '19283746',
      activityType: 'running',
      sport: 'run',
      name: 'Corrida matinal',
      date: '2026-07-20',
      startedAt: '2026-07-20T06:12:00',
      startedAtGmt: '2026-07-20T09:12:00Z',
      durationS: 1834.2,
      movingDurationS: 1801.0,
      distanceM: 5012.4,
      avgSpeedMps: 2.73,
      maxSpeedMps: 3.9,
      avgHrBpm: 152,
      maxHrBpm: 171,
      calories: 320.5,
      elevationGainM: 42.0,
      elevationLossM: 40.0,
      avgCadenceSpm: 168.0,
      maxCadenceSpm: 182.0,
      avgStrideLengthM: 0.98,
      trainingEffectAerobic: 3.1,
      trainingEffectAnaerobic: 0.4,
      trainingLoad: 88.0,
      vo2maxEstimated: 52.0,
      splits: {
        create: [
          {
            index: 1,
            distanceM: 1000.0,
            durationS: 366.0,
            avgSpeedMps: 2.73,
            avgHrBpm: 148,
            maxHrBpm: 158,
            elevationGainM: 8.0
          },
          {
            index: 2,
            distanceM: 1000.0,
            durationS: 372.0,
            avgSpeedMps: 2.69,
            avgHrBpm: 155,
            maxHrBpm: 164,
            elevationGainM: 6.0
          }
        ]
      },
      hrZones: {
        create: [
          { zone: 2, secondsInZone: 900.0, zoneLowBpm: 121.0 },
          { zone: 3, secondsInZone: 610.0, zoneLowBpm: 140.0 }
        ]
      }
    };

    expect(toActivity(rawRunning)).toEqual(expected);
  });

  it('deriva sport de activity_type', () => {
    expect(toActivity(rawRunning).sport).toBe('run');
    expect(toActivity(rawStrength).sport).toBe('strength');
  });

  it('mapeia activity_type desconhecido para sport other e avisa uma vez', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      toActivity({ ...rawRunning, activity_type: 'beach_volleyball' }).sport
    ).toBe('other');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('preserva os nulos de uma atividade sem deslocamento', () => {
    const data = toActivity(rawStrength);
    expect(data.movingDurationS).toBeNull();
    expect(data.distanceM).toBeNull();
    expect(data.avgSpeedMps).toBeNull();
    expect(data.maxSpeedMps).toBeNull();
    expect(data.avgCadenceSpm).toBeNull();
    expect(data.maxCadenceSpm).toBeNull();
    expect(data.avgStrideLengthM).toBeNull();
    expect(data.vo2maxEstimated).toBeNull();
  });

  it('propaga name nulo e name preenchido', () => {
    expect(toActivity(rawStrength).name).toBeNull();
    expect(toActivity(rawRunning).name).toBe('Corrida matinal');
  });

  it('passa as datas como string, sem converter', () => {
    const data = toActivity(rawRunning);
    expect(data.date).toBe('2026-07-20');
    expect(data.startedAt).toBe('2026-07-20T06:12:00');
    expect(data.startedAtGmt).toBe('2026-07-20T09:12:00Z');
  });

  it('gera splits vazios quando não há splits', () => {
    expect(toActivity(rawStrength).splits).toEqual({ create: [] });
  });

  it('preserva ordem e index dos splits', () => {
    const data = toActivity(rawRunning);
    const created = (data.splits as { create: Prisma.ActivitySplitCreateWithoutActivityInput[] })
      .create;
    expect(created).toHaveLength(2);
    expect(created.map((s) => s.index)).toEqual([1, 2]);
  });

  it('gera hrZones vazias quando não há zonas', () => {
    expect(toActivity(rawStrength).hrZones).toEqual({ create: [] });
  });

  it('não define id nem createdAt (ficam nos defaults do banco)', () => {
    const data = toActivity(rawRunning);
    expect(data.id).toBeUndefined();
    expect(data.createdAt).toBeUndefined();
  });

  it('as fixtures são payloads de ingestão válidos', () => {
    expect(() => ingestionActivitySchema.parse(rawRunning)).not.toThrow();
    expect(() => ingestionActivitySchema.parse(rawStrength)).not.toThrow();
  });
});
