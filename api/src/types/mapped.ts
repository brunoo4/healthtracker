import type { Prisma } from '../generated/prisma/client.js';

/**
 * Split mapeado, pronto para gravar, mas sem o vínculo com o pai:
 * o activityId é injetado no ingest, depois do upsert da atividade.
 */
export type MappedSplit = Omit<
  Prisma.ActivitySplitCreateManyInput,
  'activityId'
>;

export type MappedHrZone = Omit<
  Prisma.ActivityHrZoneCreateManyInput,
  'activityId'
>;

/**
 * Atividade mapeada na forma de domínio: campos escalares + filhos como
 * arrays soltos. Sem a semântica de `create` nested do Prisma — a gravação
 * é decidida no ingest, não aqui.
 */
export interface MappedActivity {
  activity: Prisma.ActivityCreateManyInput;
  splits: MappedSplit[];
  hrZones: MappedHrZone[];
}
