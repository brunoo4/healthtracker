import 'dotenv/config';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { ingestionPayloadSchema } from '@/types/ingestion.js';
import { ingest } from '@/ingest.js';
import { prisma, pool } from '@/db.js';

const jsonPath =
  process.env.SEED_FILE ??
  path.resolve(process.cwd(), '../ingestion/output/garmin_data.json');

const json = JSON.parse(readFileSync(jsonPath, 'utf-8'));
const payload = ingestionPayloadSchema.parse(json);

ingest(prisma, payload)
  .then((r) =>
    console.log(`Done. ${r.processed} processed, ${r.failed} failed.`)
  )
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
