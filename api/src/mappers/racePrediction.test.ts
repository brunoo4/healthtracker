import { describe, it, expect } from 'vitest';
import { toRacePrediction } from './racePrediction.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ingestionFitnessSchema,
  type IngestionFitness
} from '../types/ingestion.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// Dois cenários: um atleta com as quatro previsões estimadas e um sem nenhuma
// (Garmin ainda não calculou). Os testes fazem spread + override a partir daqui.
// O bloco fitness não tem data — ela vem de meta.generated_at, passada à parte.

const generatedAt = '2026-07-20T14:30:00';

const rawFull: IngestionFitness = {
  race_prediction_5k_s: 1350,
  race_prediction_10k_s: 2820,
  race_prediction_half_s: 6300,
  race_prediction_full_s: 13500
};

const rawEmpty: IngestionFitness = {
  race_prediction_5k_s: null,
  race_prediction_10k_s: null,
  race_prediction_half_s: null,
  race_prediction_full_s: null
};

describe('toRacePrediction', () => {
  it('mapeia todas as previsões (âncora)', () => {
    const expected: Prisma.RacePredictionCreateInput = {
      date: new Date('2026-07-20'),
      racePrediction5kS: 1350,
      racePrediction10kS: 2820,
      racePredictionHalfS: 6300,
      racePredictionFullS: 13500
    };

    expect(toRacePrediction(rawFull, generatedAt)).toEqual(expected);
  });

  it('deriva date de generated_at, descartando a hora (meia-noite UTC)', () => {
    const data = toRacePrediction(rawFull, generatedAt);
    expect(data.date).toBeInstanceOf(Date);
    expect((data.date as Date).toISOString()).toBe('2026-07-20T00:00:00.000Z');
  });

  it('preserva os nulos quando não há previsões', () => {
    const data = toRacePrediction(rawEmpty, generatedAt);
    expect(data.racePrediction5kS).toBeNull();
    expect(data.racePrediction10kS).toBeNull();
    expect(data.racePredictionHalfS).toBeNull();
    expect(data.racePredictionFullS).toBeNull();
  });

  it('não define id nem createdAt (ficam nos defaults do banco)', () => {
    const data = toRacePrediction(rawFull, generatedAt);
    expect(data.id).toBeUndefined();
    expect(data.createdAt).toBeUndefined();
  });

  it('as fixtures são payloads de ingestão válidos', () => {
    expect(() => ingestionFitnessSchema.parse(rawFull)).not.toThrow();
    expect(() => ingestionFitnessSchema.parse(rawEmpty)).not.toThrow();
  });
});
