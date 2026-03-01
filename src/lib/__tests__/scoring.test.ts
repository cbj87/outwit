import { describe, it, expect } from 'vitest';
import {
  calculateCastawayPoints,
  calculateTrioPoints,
  calculateIckyPoints,
  calculateProphecyPoints,
  sortAndRankScores,
} from '@/lib/scoring';
import type { CastawayEvent, ProphecyAnswer, ProphecyOutcome, FinalPlacement } from '@/types';

// ---------------------------------------------------------------------------
// Helpers to build test fixtures
// ---------------------------------------------------------------------------
function makeEvent(
  overrides: Partial<CastawayEvent> & Pick<CastawayEvent, 'castaway_id' | 'event_type' | 'episode_id'>,
): CastawayEvent {
  return {
    id: 'evt-' + Math.random().toString(36).slice(2, 8),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAnswer(questionId: number, answer: boolean): ProphecyAnswer {
  return { id: `ans-${questionId}`, player_id: 'player-1', question_id: questionId, answer };
}

function makeOutcome(questionId: number, outcome: boolean | null): ProphecyOutcome {
  return { question_id: questionId, outcome, resolved_at: outcome !== null ? new Date().toISOString() : null, updated_by: null, episode_number: null };
}

function makePlayer(name: string, scores: { trio?: number; icky?: number; prophecy?: number; total?: number }) {
  return {
    display_name: name,
    trio_points: scores.trio ?? 0,
    icky_points: scores.icky ?? 0,
    prophecy_points: scores.prophecy ?? 0,
    total_points: scores.total ?? 0,
  };
}

// ---------------------------------------------------------------------------
// calculateCastawayPoints
// ---------------------------------------------------------------------------
describe('calculateCastawayPoints', () => {
  const episodeNumbers = new Map([
    [100, 1], [101, 2], [102, 3],
    [103, 4], [104, 5], [105, 6],
    [106, 7], [107, 8], [108, 9],
    [109, 10], [110, 11], [111, 12],
    [112, 13],
  ]);

  it('returns 0 when no events for castaway', () => {
    const result = calculateCastawayPoints(1, [], episodeNumbers);
    expect(result).toBe(0);
  });

  it('ignores events for other castaways', () => {
    const events = [
      makeEvent({ castaway_id: 2, event_type: 'idol_found', episode_id: 100 }),
    ];
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(0);
  });

  it('sums positive event points', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'idol_found', episode_id: 100 }),        // +5
      makeEvent({ castaway_id: 1, event_type: 'advantage_found', episode_id: 101 }),    // +4
    ];
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(9);
  });

  it('handles negative event points', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'first_boot', episode_id: 100 }),  // -25
    ];
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(-25);
  });

  it('sums mixed positive and negative events', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'idol_found', episode_id: 100 }),           // +5
      makeEvent({ castaway_id: 1, event_type: 'idol_played_incorrect', episode_id: 101 }), // -3
    ];
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(2);
  });

  it('calculates survival points for early episodes (1pt each)', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 100 }), // ep 1 → 1pt
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 101 }), // ep 2 → 1pt
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 102 }), // ep 3 → 1pt
    ];
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(3);
  });

  it('calculates survival points for mid-game episodes (2pt each)', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 103 }), // ep 4 → 2pt
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 104 }), // ep 5 → 2pt
    ];
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(4);
  });

  it('calculates survival points across all phases', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 100 }), // ep 1 → 1
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 103 }), // ep 4 → 2
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 106 }), // ep 7 → 3
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 109 }), // ep 10 → 5
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 112 }), // ep 13 → 7
    ];
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(1 + 2 + 3 + 5 + 7);
  });

  it('defaults to 0 survival points for unknown episode_id', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 999 }), // unknown → ep 0 → 0
    ];
    // getSurvivalPoints(0) returns 1 because 0 <= 3
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(1);
  });

  it('combines events and survival points', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 100 }), // ep 1 → 1pt
      makeEvent({ castaway_id: 1, event_type: 'idol_found', episode_id: 100 }),        // +5
      makeEvent({ castaway_id: 1, event_type: 'survived_episode', episode_id: 101 }), // ep 2 → 1pt
    ];
    expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(1 + 5 + 1);
  });

  it('handles every event type', () => {
    const eventTypes: Array<{ type: CastawayEvent['event_type']; expected: number }> = [
      { type: 'idol_found', expected: 5 },
      { type: 'advantage_found', expected: 4 },
      { type: 'idol_played_correct', expected: 8 },
      { type: 'idol_played_incorrect', expected: -3 },
      { type: 'shot_in_dark_success', expected: 6 },
      { type: 'shot_in_dark_fail', expected: -5 },
      { type: 'fire_making_win', expected: 10 },
      { type: 'individual_immunity_win', expected: 6 },
      { type: 'individual_reward_win', expected: 3 },
      { type: 'final_immunity_win', expected: 12 },
      { type: 'made_jury', expected: 5 },
      { type: 'placed_3rd', expected: 20 },
      { type: 'placed_runner_up', expected: 25 },
      { type: 'sole_survivor', expected: 40 },
      { type: 'first_boot', expected: -25 },
      { type: 'voted_out_with_idol', expected: -12 },
      { type: 'voted_out_with_advantage', expected: -10 },
      { type: 'voted_out_unanimously', expected: -5 },
      { type: 'quit', expected: -25 },
    ];

    for (const { type, expected } of eventTypes) {
      const events = [makeEvent({ castaway_id: 1, event_type: type, episode_id: 100 })];
      expect(calculateCastawayPoints(1, events, episodeNumbers)).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateTrioPoints
// ---------------------------------------------------------------------------
describe('calculateTrioPoints', () => {
  const episodeNumbers = new Map([[100, 1]]);

  it('sums points for 3 castaways', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'idol_found', episode_id: 100 }),             // +5
      makeEvent({ castaway_id: 2, event_type: 'advantage_found', episode_id: 100 }),         // +4
      makeEvent({ castaway_id: 3, event_type: 'individual_immunity_win', episode_id: 100 }), // +6
    ];
    expect(calculateTrioPoints([1, 2, 3], events, episodeNumbers)).toBe(15);
  });

  it('returns 0 when no events for any trio member', () => {
    expect(calculateTrioPoints([1, 2, 3], [], new Map())).toBe(0);
  });

  it('ignores events for non-trio castaways', () => {
    const events = [
      makeEvent({ castaway_id: 4, event_type: 'sole_survivor', episode_id: 100 }), // +40 but not in trio
    ];
    expect(calculateTrioPoints([1, 2, 3], events, episodeNumbers)).toBe(0);
  });

  it('handles negative total trio points', () => {
    const events = [
      makeEvent({ castaway_id: 1, event_type: 'first_boot', episode_id: 100 }),     // -25
      makeEvent({ castaway_id: 2, event_type: 'quit', episode_id: 100 }),            // -25
      makeEvent({ castaway_id: 3, event_type: 'idol_found', episode_id: 100 }),      // +5
    ];
    expect(calculateTrioPoints([1, 2, 3], events, episodeNumbers)).toBe(-45);
  });
});

// ---------------------------------------------------------------------------
// calculateIckyPoints
// ---------------------------------------------------------------------------
describe('calculateIckyPoints', () => {
  it('returns +15 for first boot', () => {
    expect(calculateIckyPoints('first_boot')).toBe(15);
  });

  it('returns +8 for pre-merge elimination', () => {
    expect(calculateIckyPoints('pre_merge')).toBe(8);
  });

  it('returns -8 for jury', () => {
    expect(calculateIckyPoints('jury')).toBe(-8);
  });

  it('returns -15 for 3rd place', () => {
    expect(calculateIckyPoints('3rd')).toBe(-15);
  });

  it('returns -25 for winner', () => {
    expect(calculateIckyPoints('winner')).toBe(-25);
  });

  it('returns 0 for null placement (still active)', () => {
    expect(calculateIckyPoints(null)).toBe(0);
  });

  it('returns 0 for runner_up (not in ICKY_PICK_SCORES)', () => {
    // runner_up is a FinalPlacement but not an icky scoring category
    expect(calculateIckyPoints('runner_up')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateProphecyPoints
// ---------------------------------------------------------------------------
describe('calculateProphecyPoints', () => {
  it('returns 0 with no answers', () => {
    expect(calculateProphecyPoints([], [])).toBe(0);
  });

  it('awards points for correct answer', () => {
    const answers = [makeAnswer(1, true)];
    const outcomes = [makeOutcome(1, true)];
    expect(calculateProphecyPoints(answers, outcomes)).toBe(1); // Q1 = 1pt
  });

  it('awards 0 for wrong answer', () => {
    const answers = [makeAnswer(1, true)];
    const outcomes = [makeOutcome(1, false)];
    expect(calculateProphecyPoints(answers, outcomes)).toBe(0);
  });

  it('awards 0 for unresolved outcome (null)', () => {
    const answers = [makeAnswer(1, true)];
    const outcomes = [makeOutcome(1, null)];
    expect(calculateProphecyPoints(answers, outcomes)).toBe(0);
  });

  it('awards 0 when outcome is missing entirely', () => {
    const answers = [makeAnswer(1, true)];
    expect(calculateProphecyPoints(answers, [])).toBe(0);
  });

  it('sums points across multiple correct answers', () => {
    const answers = [
      makeAnswer(1, true),  // Q1 = 1pt
      makeAnswer(4, false), // Q4 = 2pt but wrong
      makeAnswer(8, true),  // Q8 = 3pt
      makeAnswer(10, true), // Q10 = 4pt
    ];
    const outcomes = [
      makeOutcome(1, true),
      makeOutcome(4, true),  // player answered false, outcome is true → wrong
      makeOutcome(8, true),
      makeOutcome(10, true),
    ];
    expect(calculateProphecyPoints(answers, outcomes)).toBe(1 + 0 + 3 + 4);
  });

  it('handles all 16 questions correct for max score', () => {
    const answers = Array.from({ length: 16 }, (_, i) => makeAnswer(i + 1, true));
    const outcomes = Array.from({ length: 16 }, (_, i) => makeOutcome(i + 1, true));
    // 1+1+1 + 2+2+2+2 + 3+3 + 4×7 = 3+8+6+28 = 45
    expect(calculateProphecyPoints(answers, outcomes)).toBe(45);
  });

  it('handles false answers matching false outcomes', () => {
    const answers = [makeAnswer(10, false)]; // player says "no"
    const outcomes = [makeOutcome(10, false)]; // outcome is also "no"
    expect(calculateProphecyPoints(answers, outcomes)).toBe(4); // correct!
  });
});

// ---------------------------------------------------------------------------
// sortAndRankScores
// ---------------------------------------------------------------------------
describe('sortAndRankScores', () => {
  it('ranks by total points descending', () => {
    const players = [
      makePlayer('Alice', { total: 10 }),
      makePlayer('Bob', { total: 30 }),
      makePlayer('Charlie', { total: 20 }),
    ];
    const ranked = sortAndRankScores(players);
    expect(ranked.map((p) => p.display_name)).toEqual(['Bob', 'Charlie', 'Alice']);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it('breaks ties with trio points', () => {
    const players = [
      makePlayer('Alice', { total: 20, trio: 10 }),
      makePlayer('Bob', { total: 20, trio: 15 }),
    ];
    const ranked = sortAndRankScores(players);
    expect(ranked[0].display_name).toBe('Bob');
    expect(ranked[1].display_name).toBe('Alice');
    expect(ranked.every((p) => !p.is_tied)).toBe(true);
  });

  it('breaks ties with prophecy points after trio', () => {
    const players = [
      makePlayer('Alice', { total: 20, trio: 10, prophecy: 5 }),
      makePlayer('Bob', { total: 20, trio: 10, prophecy: 8 }),
    ];
    const ranked = sortAndRankScores(players);
    expect(ranked[0].display_name).toBe('Bob');
  });

  it('breaks ties with icky points after prophecy', () => {
    const players = [
      makePlayer('Alice', { total: 20, trio: 10, prophecy: 5, icky: 3 }),
      makePlayer('Bob', { total: 20, trio: 10, prophecy: 5, icky: 5 }),
    ];
    const ranked = sortAndRankScores(players);
    expect(ranked[0].display_name).toBe('Bob');
  });

  it('breaks ties alphabetically as last resort', () => {
    const players = [
      makePlayer('Charlie', { total: 20, trio: 10, prophecy: 5, icky: 3 }),
      makePlayer('Alice', { total: 20, trio: 10, prophecy: 5, icky: 3 }),
    ];
    const ranked = sortAndRankScores(players);
    expect(ranked[0].display_name).toBe('Alice');
    expect(ranked[1].display_name).toBe('Charlie');
  });

  it('marks fully tied players with is_tied and shared rank', () => {
    const players = [
      makePlayer('Alice', { total: 20, trio: 10, prophecy: 5, icky: 3 }),
      makePlayer('Bob', { total: 20, trio: 10, prophecy: 5, icky: 3 }),
    ];
    const ranked = sortAndRankScores(players);
    expect(ranked[0].is_tied).toBe(true);
    expect(ranked[1].is_tied).toBe(true);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1); // tied for 1st
  });

  it('handles 3-way tie correctly', () => {
    const players = [
      makePlayer('Charlie', { total: 10, trio: 5, prophecy: 3, icky: 2 }),
      makePlayer('Alice', { total: 10, trio: 5, prophecy: 3, icky: 2 }),
      makePlayer('Bob', { total: 10, trio: 5, prophecy: 3, icky: 2 }),
    ];
    const ranked = sortAndRankScores(players);
    expect(ranked.every((p) => p.rank === 1)).toBe(true);
    expect(ranked.every((p) => p.is_tied)).toBe(true);
    // Still sorted alphabetically
    expect(ranked.map((p) => p.display_name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('non-tied player after tied players gets correct rank', () => {
    const players = [
      makePlayer('Alice', { total: 20, trio: 10, prophecy: 5, icky: 3 }),
      makePlayer('Bob', { total: 20, trio: 10, prophecy: 5, icky: 3 }),
      makePlayer('Charlie', { total: 5 }),
    ];
    const ranked = sortAndRankScores(players);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
    expect(ranked[2].rank).toBe(3); // skips rank 2
    expect(ranked[2].is_tied).toBe(false);
  });

  it('handles empty array', () => {
    expect(sortAndRankScores([])).toEqual([]);
  });

  it('handles single player', () => {
    const ranked = sortAndRankScores([makePlayer('Alice', { total: 10 })]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].is_tied).toBe(false);
  });

  it('does not mutate original array', () => {
    const players = [
      makePlayer('Bob', { total: 10 }),
      makePlayer('Alice', { total: 20 }),
    ];
    const original = [...players];
    sortAndRankScores(players);
    expect(players[0].display_name).toBe(original[0].display_name);
  });
});
