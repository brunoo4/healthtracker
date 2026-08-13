import {
  ingestionActivitySchema,
  ingestionDailyMetricSchema,
  IngestionPayload
} from './types/ingestion.js';
import { toDailyMetric } from './mappers/dailyMetric.js';
import { readFileSync } from 'node:fs';
import { PrismaClient } from './generated/prisma/client.js';
import { toActivity } from './mappers/activity.js';

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

  for (const raw of payload.activities) {
    const result = ingestionActivitySchema.safeParse(raw);
    if (!result.success) {
      console.warn('Invalid record: ', result.error.issues);
      failed++;
      continue;
    }

    const { activity, splits, hrZones } = toActivity(result.data);

    await prisma.$transaction(async (tx) => {
      const saved = await tx.activity.upsert({
        where: { garminActivityId: activity.garminActivityId },
        create: activity,
        update: activity
      });

      await tx.activitySplit.deleteMany({ where: { activityId: saved.id } });
      await tx.activityHrZone.deleteMany({ where: { activityId: saved.id } });

      await tx.activitySplit.createMany({
        data: splits.map((s) => ({ ...s, activityId: saved.id }))
      });

      await tx.activityHrZone.createMany({
        data: hrZones.map((h) => ({ ...h, activityId: saved.id }))
      });
    });
    processed++;
  }

  return { processed, failed };
}
