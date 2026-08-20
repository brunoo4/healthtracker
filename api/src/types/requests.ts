import z from 'zod';

export const dailyQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date()
});

export type DailyQuery = z.infer<typeof dailyQuerySchema>;
