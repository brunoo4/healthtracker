import {
  ingestionDailyMetricSchema,
  IngestionPayload
} from './types/ingestion.js';
import { toDailyMetric } from './mappers/dailyMetric.js';
import { readFileSync } from 'node:fs';
import { PrismaClient } from './generated/prisma/client.js';

export interface IngestResult {
  processed: number;
  failed: number;
}

export async function ingest(
  prisma: PrismaClient,
  payload: IngestionPayload
): Promise<IngestResult> {
  let processed = 0;
  let failed = 0;
  console.log('Start seeding...');

  //Obtem os daily_metrics do payload parseado e dá um safeParse pq um registro ruim aqui não pode derrubar os outros
  //DailyMetric não tem objetos filhos.
  for (const raw of payload.daily_metrics) {
    const result = ingestionDailyMetricSchema.safeParse(raw);
    if (!result.success) {
      console.warn('Invalid record: ', result.error.issues);
      failed++;
      continue;
    }

    const dailyMetric = toDailyMetric(result.data);

    await prisma.dailyMetric.upsert({
      where: { date: dailyMetric.date },
      create: dailyMetric,
      update: dailyMetric
    });
    processed++;
  }

  return { processed, failed };
}
