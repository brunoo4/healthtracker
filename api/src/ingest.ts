import {
  ingestionActivitySchema,
  ingestionDailyMetricSchema,
  IngestionPayload
} from './types/ingestion.js';
import { toDailyMetric } from './mappers/dailyMetric.js';
import { PrismaClient } from './generated/prisma/client.js';
import { toActivity } from './mappers/activity.js';
import { toRacePrediction } from './mappers/racePrediction.js';

export interface IngestResult {
  processed: number;
  failed: number;
}

export async function ingest(
  prisma: PrismaClient,
  payload: IngestionPayload
): Promise<IngestResult> {
  const log = await prisma.syncLog.create({
    data: {
      startedAt: new Date(),
      status: 'running',
      periodStart: new Date(payload.meta.start_date),
      periodEnd: new Date(payload.meta.end_date),
      recordsProcessed: 0
    }
  });

  let processed = 0;
  let failed = 0;
  console.log('Start seeding...');

  try {
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

    const racePrediction = toRacePrediction(
      payload.fitness,
      payload.meta.generated_at
    );

    await prisma.racePrediction.upsert({
      where: { date: racePrediction.date },
      create: racePrediction,
      update: racePrediction
    });
    processed++;

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: failed === 0 ? 'success' : 'partial',
        recordsProcessed: processed
      }
    });
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: 'failure',
        errorMessage: err instanceof Error ? err.message : String(err)
      }
    });
    throw err;
  }

  return { processed, failed };
}
