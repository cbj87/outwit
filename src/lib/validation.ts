import { z } from 'zod';

export const picksSubmissionSchema = z
  .object({
    trio_castaway_1: z.number().int().positive(),
    trio_castaway_2: z.number().int().positive(),
    trio_castaway_3: z.number().int().positive(),
    icky_castaway: z.number().int().positive(),
    prophecy_answers: z.record(z.coerce.number(), z.boolean()).refine(
      (answers) => {
        const keys = Object.keys(answers).map(Number);
        return keys.length === 16 && keys.every((k) => k >= 1 && k <= 16);
      },
      { message: 'All 16 prophecy questions must be answered' },
    ),
  })
  .refine(
    (data) => {
      const trio = [data.trio_castaway_1, data.trio_castaway_2, data.trio_castaway_3];
      const uniqueTrio = new Set(trio);
      return uniqueTrio.size === 3;
    },
    { message: 'Trusted Trio must be 3 different castaways', path: ['trio_castaway_1'] },
  )
  .refine(
    (data) => {
      const trio = [data.trio_castaway_1, data.trio_castaway_2, data.trio_castaway_3];
      return !trio.includes(data.icky_castaway);
    },
    { message: 'Icky Pick cannot be the same as any Trusted Trio castaway', path: ['icky_castaway'] },
  );

export type PicksSubmissionInput = z.infer<typeof picksSubmissionSchema>;
