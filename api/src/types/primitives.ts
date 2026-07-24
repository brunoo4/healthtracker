import { z } from 'zod';

/** Horário de parede, sem fuso. O refine rejeita `Z` ou `+03:00`. */
export const localDateTimeSchema = z.iso
  .datetime({ local: true })
  .refine((value) => !/(Z|[+-]\d{2}:\d{2})$/.test(value), {
    message: 'Deve ser horário local, sem marcador de fuso'
  });

/** Instante em UTC. Exige o `Z`. */
export const utcDateTimeSchema = z.iso.datetime();

/** Dia do calendário: YYYY-MM-DD. */
export const calendarDateSchema = z.iso.date();

/** Extrai o dia de um datetime ISO. */
export const toCalendarDate = (isoDateTime: string): string =>
  isoDateTime.slice(0, 10);
