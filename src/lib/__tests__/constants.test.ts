import { describe, it, expect } from 'vitest';
import {
  EVENT_SCORES,
  ICKY_PICK_SCORES,
  PROPHECY_POINTS,
  PROPHECY_QUESTIONS,
  getSurvivalPoints,
  SURVIVAL_POINTS_BY_PHASE,
} from '@/lib/constants';

// ---------------------------------------------------------------------------
// EVENT_SCORES
// ---------------------------------------------------------------------------
describe('EVENT_SCORES', () => {
  it('contains all 20 event types (19 + survived_episode)', () => {
    expect(Object.keys(EVENT_SCORES)).toHaveLength(20);
  });

  it('has correct positive event values', () => {
    expect(EVENT_SCORES.idol_found).toBe(5);
    expect(EVENT_SCORES.advantage_found).toBe(4);
    expect(EVENT_SCORES.idol_played_correct).toBe(8);
    expect(EVENT_SCORES.shot_in_dark_success).toBe(6);
    expect(EVENT_SCORES.fire_making_win).toBe(10);
    expect(EVENT_SCORES.individual_immunity_win).toBe(6);
    expect(EVENT_SCORES.individual_reward_win).toBe(3);
    expect(EVENT_SCORES.final_immunity_win).toBe(12);
    expect(EVENT_SCORES.made_jury).toBe(5);
    expect(EVENT_SCORES.placed_3rd).toBe(20);
    expect(EVENT_SCORES.placed_runner_up).toBe(25);
    expect(EVENT_SCORES.sole_survivor).toBe(40);
  });

  it('has correct negative event values', () => {
    expect(EVENT_SCORES.idol_played_incorrect).toBe(-3);
    expect(EVENT_SCORES.shot_in_dark_fail).toBe(-5);
    expect(EVENT_SCORES.first_boot).toBe(-25);
    expect(EVENT_SCORES.voted_out_with_idol).toBe(-12);
    expect(EVENT_SCORES.voted_out_with_advantage).toBe(-10);
    expect(EVENT_SCORES.voted_out_unanimously).toBe(-5);
    expect(EVENT_SCORES.quit).toBe(-25);
  });

  it('survived_episode is 0 (variable scoring handled by getSurvivalPoints)', () => {
    expect(EVENT_SCORES.survived_episode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getSurvivalPoints
// ---------------------------------------------------------------------------
describe('getSurvivalPoints', () => {
  it('returns 1 for episodes 1-3', () => {
    expect(getSurvivalPoints(1)).toBe(1);
    expect(getSurvivalPoints(2)).toBe(1);
    expect(getSurvivalPoints(3)).toBe(1);
  });

  it('returns 2 for episodes 4-6', () => {
    expect(getSurvivalPoints(4)).toBe(2);
    expect(getSurvivalPoints(5)).toBe(2);
    expect(getSurvivalPoints(6)).toBe(2);
  });

  it('returns 3 for episodes 7-9', () => {
    expect(getSurvivalPoints(7)).toBe(3);
    expect(getSurvivalPoints(8)).toBe(3);
    expect(getSurvivalPoints(9)).toBe(3);
  });

  it('returns 5 for episodes 10-12', () => {
    expect(getSurvivalPoints(10)).toBe(5);
    expect(getSurvivalPoints(11)).toBe(5);
    expect(getSurvivalPoints(12)).toBe(5);
  });

  it('returns 7 for episodes 13+ (Final 5 default)', () => {
    expect(getSurvivalPoints(13)).toBe(7);
    expect(getSurvivalPoints(14)).toBe(7);
    expect(getSurvivalPoints(15)).toBe(7);
  });

  it('handles episode 0 (edge case)', () => {
    // Episode 0 falls into <= 3 bracket
    expect(getSurvivalPoints(0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SURVIVAL_POINTS_BY_PHASE
// ---------------------------------------------------------------------------
describe('SURVIVAL_POINTS_BY_PHASE', () => {
  it('has all 6 phases', () => {
    expect(Object.keys(SURVIVAL_POINTS_BY_PHASE)).toHaveLength(6);
  });

  it('matches getSurvivalPoints values', () => {
    expect(SURVIVAL_POINTS_BY_PHASE.episodes_1_3).toBe(1);
    expect(SURVIVAL_POINTS_BY_PHASE.episodes_4_6).toBe(2);
    expect(SURVIVAL_POINTS_BY_PHASE.episodes_7_9).toBe(3);
    expect(SURVIVAL_POINTS_BY_PHASE.episodes_10_12).toBe(5);
    expect(SURVIVAL_POINTS_BY_PHASE.final_5).toBe(7);
    expect(SURVIVAL_POINTS_BY_PHASE.final_4).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// ICKY_PICK_SCORES
// ---------------------------------------------------------------------------
describe('ICKY_PICK_SCORES', () => {
  it('contains all 5 placement categories', () => {
    expect(Object.keys(ICKY_PICK_SCORES)).toHaveLength(5);
  });

  it('has correct values matching CLAUDE.md spec', () => {
    expect(ICKY_PICK_SCORES.first_boot).toBe(15);
    expect(ICKY_PICK_SCORES.pre_merge).toBe(8);
    expect(ICKY_PICK_SCORES.jury).toBe(-8);
    expect(ICKY_PICK_SCORES['3rd']).toBe(-15);
    expect(ICKY_PICK_SCORES.winner).toBe(-25);
  });

  it('first_boot is the most positive (reward for predicting early exit)', () => {
    const maxVal = Math.max(...Object.values(ICKY_PICK_SCORES));
    expect(ICKY_PICK_SCORES.first_boot).toBe(maxVal);
  });

  it('winner is the most negative (penalty for icky pick winning)', () => {
    const minVal = Math.min(...Object.values(ICKY_PICK_SCORES));
    expect(ICKY_PICK_SCORES.winner).toBe(minVal);
  });
});

// ---------------------------------------------------------------------------
// PROPHECY_POINTS
// ---------------------------------------------------------------------------
describe('PROPHECY_POINTS', () => {
  it('has all 16 questions', () => {
    expect(Object.keys(PROPHECY_POINTS)).toHaveLength(16);
  });

  it('Q1-Q3 are worth 1 point each', () => {
    expect(PROPHECY_POINTS[1]).toBe(1);
    expect(PROPHECY_POINTS[2]).toBe(1);
    expect(PROPHECY_POINTS[3]).toBe(1);
  });

  it('Q4-Q7 are worth 2 points each', () => {
    expect(PROPHECY_POINTS[4]).toBe(2);
    expect(PROPHECY_POINTS[5]).toBe(2);
    expect(PROPHECY_POINTS[6]).toBe(2);
    expect(PROPHECY_POINTS[7]).toBe(2);
  });

  it('Q8-Q9 are worth 3 points each', () => {
    expect(PROPHECY_POINTS[8]).toBe(3);
    expect(PROPHECY_POINTS[9]).toBe(3);
  });

  it('Q10-Q16 are worth 4 points each', () => {
    for (let q = 10; q <= 16; q++) {
      expect(PROPHECY_POINTS[q]).toBe(4);
    }
  });

  it('total possible prophecy score is 45', () => {
    const total = Object.values(PROPHECY_POINTS).reduce((sum, pts) => sum + pts, 0);
    expect(total).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// PROPHECY_QUESTIONS
// ---------------------------------------------------------------------------
describe('PROPHECY_QUESTIONS', () => {
  it('has all 16 questions', () => {
    expect(PROPHECY_QUESTIONS).toHaveLength(16);
  });

  it('question IDs are 1-16', () => {
    const ids = PROPHECY_QUESTIONS.map((q) => q.id);
    expect(ids).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it('each question has non-empty text', () => {
    for (const q of PROPHECY_QUESTIONS) {
      expect(q.text.length).toBeGreaterThan(0);
    }
  });

  it('question points match PROPHECY_POINTS map', () => {
    for (const q of PROPHECY_QUESTIONS) {
      expect(q.points).toBe(PROPHECY_POINTS[q.id]);
    }
  });
});
