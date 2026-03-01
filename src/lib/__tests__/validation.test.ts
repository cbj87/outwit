import { describe, it, expect } from 'vitest';
import { picksSubmissionSchema } from '@/lib/validation';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function validPicks() {
  return {
    trio_castaway_1: 1,
    trio_castaway_2: 2,
    trio_castaway_3: 3,
    icky_castaway: 4,
    prophecy_answers: { 1: true, 2: false, 3: true },
  };
}

// ---------------------------------------------------------------------------
// picksSubmissionSchema
// ---------------------------------------------------------------------------
describe('picksSubmissionSchema', () => {
  describe('valid submissions', () => {
    it('accepts a fully valid submission', () => {
      const result = picksSubmissionSchema.safeParse(validPicks());
      expect(result.success).toBe(true);
    });

    it('accepts all 16 prophecy answers', () => {
      const picks = validPicks();
      picks.prophecy_answers = Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i + 1, i % 2 === 0]),
      );
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(true);
    });

    it('accepts empty prophecy answers', () => {
      const picks = validPicks();
      picks.prophecy_answers = {};
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(true);
    });
  });

  describe('trio uniqueness', () => {
    it('rejects duplicate castaways in trio (1 == 2)', () => {
      const picks = validPicks();
      picks.trio_castaway_2 = picks.trio_castaway_1;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects duplicate castaways in trio (2 == 3)', () => {
      const picks = validPicks();
      picks.trio_castaway_3 = picks.trio_castaway_2;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects duplicate castaways in trio (1 == 3)', () => {
      const picks = validPicks();
      picks.trio_castaway_3 = picks.trio_castaway_1;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects all three castaways being the same', () => {
      const picks = validPicks();
      picks.trio_castaway_2 = picks.trio_castaway_1;
      picks.trio_castaway_3 = picks.trio_castaway_1;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });
  });

  describe('icky exclusivity', () => {
    it('rejects icky castaway matching trio member 1', () => {
      const picks = validPicks();
      picks.icky_castaway = picks.trio_castaway_1;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects icky castaway matching trio member 2', () => {
      const picks = validPicks();
      picks.icky_castaway = picks.trio_castaway_2;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects icky castaway matching trio member 3', () => {
      const picks = validPicks();
      picks.icky_castaway = picks.trio_castaway_3;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });
  });

  describe('castaway ID validation', () => {
    it('rejects zero as castaway ID', () => {
      const picks = validPicks();
      picks.trio_castaway_1 = 0;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects negative castaway ID', () => {
      const picks = validPicks();
      picks.trio_castaway_1 = -1;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects non-integer castaway ID', () => {
      const picks = validPicks();
      picks.trio_castaway_1 = 1.5;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });
  });

  describe('prophecy answer validation', () => {
    it('rejects question ID 0', () => {
      const picks = validPicks();
      picks.prophecy_answers = { 0: true };
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects question ID 17', () => {
      const picks = validPicks();
      picks.prophecy_answers = { 17: true };
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects more than 16 prophecy answers', () => {
      const picks = validPicks();
      picks.prophecy_answers = Object.fromEntries(
        Array.from({ length: 17 }, (_, i) => [i + 1, true]),
      );
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });
  });

  describe('missing fields', () => {
    it('rejects missing trio_castaway_1', () => {
      const picks = validPicks();
      delete (picks as any).trio_castaway_1;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects missing icky_castaway', () => {
      const picks = validPicks();
      delete (picks as any).icky_castaway;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });

    it('rejects missing prophecy_answers', () => {
      const picks = validPicks();
      delete (picks as any).prophecy_answers;
      const result = picksSubmissionSchema.safeParse(picks);
      expect(result.success).toBe(false);
    });
  });
});
