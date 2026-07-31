import type { Prisma } from '../generated/prisma/client.js';
import type { IngestionFitness } from '../types/ingestion.js';
import { toCalendarDate } from '../types/primitives.js';

export function toRacePrediction(
  raw: IngestionFitness,
  generatedAt: string
): Prisma.RacePredictionCreateInput {
  return {
    // O bloco fitness não traz data própria: a data da captura vem de
    // meta.generated_at (data da leitura, não do período consultado).
    date: new Date(toCalendarDate(generatedAt)),
    racePrediction5kS: raw.race_prediction_5k_s,
    racePrediction10kS: raw.race_prediction_10k_s,
    racePredictionHalfS: raw.race_prediction_half_s,
    racePredictionFullS: raw.race_prediction_full_s
  };
}
