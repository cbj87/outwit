import { describe, it, expect } from 'vitest';
import {
  calculateCastawayPoints,
  calculateTrioPoints,
  calculateIckyPoints,
  calculateProphecyPoints,
  sortAndRankScores,
} from '@/lib/scoring';
import { getSurvivalPoints, PROPHECY_POINTS } from '@/lib/constants';
import type { CastawayEvent, ProphecyAnswer, ProphecyOutcome, FinalPlacement } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let eventCounter = 0;
function makeEvent(
  castaway_id: number,
  event_type: CastawayEvent['event_type'],
  episode_id: number,
): CastawayEvent {
  return {
    id: `evt-${++eventCounter}`,
    castaway_id,
    event_type,
    episode_id,
    created_at: new Date().toISOString(),
  };
}

function makeAnswer(questionId: number, answer: boolean, playerId = 'player-1'): ProphecyAnswer {
  return { id: `ans-${playerId}-${questionId}`, player_id: playerId, question_id: questionId, answer };
}

function makeOutcome(questionId: number, outcome: boolean | null): ProphecyOutcome {
  return { question_id: questionId, outcome, resolved_at: outcome !== null ? new Date().toISOString() : null, updated_by: null, episode_number: null };
}

// Standard episode map: episode_id -> episode_number (1-based)
const EPISODE_MAP = new Map<number, number>();
for (let i = 1; i <= 14; i++) {
  EPISODE_MAP.set(100 + i - 1, i); // id 100 = ep 1, id 101 = ep 2, ...
}

/**
 * Simulate the full score calculation for a player, mirroring the Edge Function logic.
 */
function calculateFullPlayerScore(params: {
  trioCastawayIds: [number, number, number];
  ickyCastawayId: number;
  ickyPlacement: FinalPlacement;
  events: CastawayEvent[];
  episodeNumbers: Map<number, number>;
  prophecyAnswers: ProphecyAnswer[];
  prophecyOutcomes: ProphecyOutcome[];
}) {
  const trioPoints = calculateTrioPoints(
    params.trioCastawayIds,
    params.events,
    params.episodeNumbers,
  );
  const ickyPoints = calculateIckyPoints(params.ickyPlacement);
  const prophecyPoints = calculateProphecyPoints(
    params.prophecyAnswers,
    params.prophecyOutcomes,
  );
  return {
    trioPoints,
    ickyPoints,
    prophecyPoints,
    totalPoints: trioPoints + ickyPoints + prophecyPoints,
  };
}

// ---------------------------------------------------------------------------
// Full Player Scoring Scenarios
// ---------------------------------------------------------------------------
describe('Full Player Scoring Scenarios', () => {
  it('calculates a pre-season player with no events as all zeros', () => {
    const result = calculateFullPlayerScore({
      trioCastawayIds: [1, 2, 3],
      ickyCastawayId: 4,
      ickyPlacement: null, // still active
      events: [],
      episodeNumbers: EPISODE_MAP,
      prophecyAnswers: [],
      prophecyOutcomes: [],
    });

    expect(result).toEqual({
      trioPoints: 0,
      ickyPoints: 0,
      prophecyPoints: 0,
      totalPoints: 0,
    });
  });

  it('calculates early-game player (3 episodes survived, 1 idol found)', () => {
    const events = [
      // Castaway 1: survived eps 1-3 + found idol in ep 2
      makeEvent(1, 'survived_episode', 100), // ep 1 → 1pt
      makeEvent(1, 'survived_episode', 101), // ep 2 → 1pt
      makeEvent(1, 'idol_found', 101),       // +5
      makeEvent(1, 'survived_episode', 102), // ep 3 → 1pt
      // Castaway 2: survived eps 1-2
      makeEvent(2, 'survived_episode', 100), // ep 1 → 1pt
      makeEvent(2, 'survived_episode', 101), // ep 2 → 1pt
      // Castaway 3: first boot
      makeEvent(3, 'first_boot', 100),       // -25
    ];

    const result = calculateFullPlayerScore({
      trioCastawayIds: [1, 2, 3],
      ickyCastawayId: 4,
      ickyPlacement: null,
      events,
      episodeNumbers: EPISODE_MAP,
      prophecyAnswers: [],
      prophecyOutcomes: [],
    });

    // Castaway 1: 1+1+5+1 = 8
    // Castaway 2: 1+1 = 2
    // Castaway 3: -25
    expect(result.trioPoints).toBe(8 + 2 + (-25));
    expect(result.totalPoints).toBe(-15);
  });

  it('calculates mid-season player with icky pick scored', () => {
    const events = [
      // Castaway 1: survived eps 1-6, won individual immunity ep 5
      ...Array.from({ length: 6 }, (_, i) => makeEvent(1, 'survived_episode', 100 + i)),
      makeEvent(1, 'individual_immunity_win', 104),
      // Castaway 2: survived eps 1-4, voted out with idol ep 5
      ...Array.from({ length: 4 }, (_, i) => makeEvent(2, 'survived_episode', 100 + i)),
      makeEvent(2, 'voted_out_with_idol', 104),
      // Castaway 3: survived eps 1-6
      ...Array.from({ length: 6 }, (_, i) => makeEvent(3, 'survived_episode', 100 + i)),
    ];

    const result = calculateFullPlayerScore({
      trioCastawayIds: [1, 2, 3],
      ickyCastawayId: 4,
      ickyPlacement: 'pre_merge',
      events,
      episodeNumbers: EPISODE_MAP,
      prophecyAnswers: [],
      prophecyOutcomes: [],
    });

    // Castaway 1: (1+1+1+2+2+2) + 6 = 15
    // Castaway 2: (1+1+1+2) + (-12) = -7
    // Castaway 3: (1+1+1+2+2+2) = 9
    expect(result.trioPoints).toBe(15 + (-7) + 9);
    expect(result.ickyPoints).toBe(8); // pre_merge
    expect(result.totalPoints).toBe(17 + 8);
  });

  it('calculates endgame player with all components', () => {
    const events = [
      // Castaway 1: survived all 13 eps, sole survivor
      ...Array.from({ length: 13 }, (_, i) => makeEvent(1, 'survived_episode', 100 + i)),
      makeEvent(1, 'made_jury', 106),
      makeEvent(1, 'individual_immunity_win', 108),
      makeEvent(1, 'individual_immunity_win', 110),
      makeEvent(1, 'final_immunity_win', 112),
      makeEvent(1, 'sole_survivor', 112),
      // Castaway 2: survived 9 eps, jury member
      ...Array.from({ length: 9 }, (_, i) => makeEvent(2, 'survived_episode', 100 + i)),
      makeEvent(2, 'made_jury', 106),
      // Castaway 3: survived 5 eps
      ...Array.from({ length: 5 }, (_, i) => makeEvent(3, 'survived_episode', 100 + i)),
    ];

    // 3 correct prophecy answers
    const answers = [
      makeAnswer(1, true),   // Q1 = 1pt
      makeAnswer(5, false),  // Q5 = 2pt (wrong)
      makeAnswer(10, true),  // Q10 = 4pt
      makeAnswer(16, true),  // Q16 = 4pt
    ];
    const outcomes = [
      makeOutcome(1, true),
      makeOutcome(5, true),  // player said false, outcome true → wrong
      makeOutcome(10, true),
      makeOutcome(16, true),
    ];

    const result = calculateFullPlayerScore({
      trioCastawayIds: [1, 2, 3],
      ickyCastawayId: 4,
      ickyPlacement: 'first_boot',
      events,
      episodeNumbers: EPISODE_MAP,
      prophecyAnswers: answers,
      prophecyOutcomes: outcomes,
    });

    // Castaway 1 survival: (1*3)+(2*3)+(3*3)+(5*3)+(7*1) = 3+6+9+15+7 = 40
    // Castaway 1 events: 5+6+6+12+40 = 69
    // Castaway 1 total: 40+69 = 109
    const c1Survival = (1 + 1 + 1) + (2 + 2 + 2) + (3 + 3 + 3) + (5 + 5 + 5) + 7;
    const c1Events = 5 + 6 + 6 + 12 + 40; // made_jury + 2x immunity + final immunity + sole survivor
    expect(calculateCastawayPoints(1, events, EPISODE_MAP)).toBe(c1Survival + c1Events);

    // Castaway 2 survival: (1*3)+(2*3)+(3*3) = 3+6+9 = 18
    // Castaway 2 events: 5 (made_jury)
    const c2Survival = (1 + 1 + 1) + (2 + 2 + 2) + (3 + 3 + 3);
    const c2Events = 5;
    expect(calculateCastawayPoints(2, events, EPISODE_MAP)).toBe(c2Survival + c2Events);

    // Castaway 3 survival: (1*3)+(2*2) = 3+4 = 7
    const c3Survival = (1 + 1 + 1) + (2 + 2);

    const expectedTrio = (c1Survival + c1Events) + (c2Survival + c2Events) + c3Survival;
    expect(result.trioPoints).toBe(expectedTrio);
    expect(result.ickyPoints).toBe(15); // first_boot
    expect(result.prophecyPoints).toBe(1 + 0 + 4 + 4); // 9
    expect(result.totalPoints).toBe(expectedTrio + 15 + 9);
  });

  it('handles a player with worst-case icky pick (winner)', () => {
    const result = calculateFullPlayerScore({
      trioCastawayIds: [1, 2, 3],
      ickyCastawayId: 4,
      ickyPlacement: 'winner',
      events: [],
      episodeNumbers: EPISODE_MAP,
      prophecyAnswers: [],
      prophecyOutcomes: [],
    });

    expect(result.ickyPoints).toBe(-25);
    expect(result.totalPoints).toBe(-25);
  });

  it('handles perfect prophecy score (all 16 correct)', () => {
    const answers = Array.from({ length: 16 }, (_, i) => makeAnswer(i + 1, true));
    const outcomes = Array.from({ length: 16 }, (_, i) => makeOutcome(i + 1, true));

    const result = calculateFullPlayerScore({
      trioCastawayIds: [1, 2, 3],
      ickyCastawayId: 4,
      ickyPlacement: null,
      events: [],
      episodeNumbers: EPISODE_MAP,
      prophecyAnswers: answers,
      prophecyOutcomes: outcomes,
    });

    // 3*1 + 4*2 + 2*3 + 7*4 = 3+8+6+28 = 45
    expect(result.prophecyPoints).toBe(45);
    expect(result.totalPoints).toBe(45);
  });

  it('handles all prophecy outcomes still pending', () => {
    const answers = Array.from({ length: 16 }, (_, i) => makeAnswer(i + 1, true));
    const outcomes = Array.from({ length: 16 }, (_, i) => makeOutcome(i + 1, null)); // all pending

    const result = calculateFullPlayerScore({
      trioCastawayIds: [1, 2, 3],
      ickyCastawayId: 4,
      ickyPlacement: null,
      events: [],
      episodeNumbers: EPISODE_MAP,
      prophecyAnswers: answers,
      prophecyOutcomes: outcomes,
    });

    expect(result.prophecyPoints).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge Function Parity: Placement Inference
// ---------------------------------------------------------------------------
describe('Icky Pick placement coverage', () => {
  const placements: Array<{ placement: FinalPlacement; expected: number }> = [
    { placement: 'first_boot', expected: 15 },
    { placement: 'pre_merge', expected: 8 },
    { placement: 'jury', expected: -8 },
    { placement: '3rd', expected: -15 },
    { placement: 'winner', expected: -25 },
    { placement: 'runner_up', expected: 0 }, // not an icky category
    { placement: null, expected: 0 },         // still active
  ];

  for (const { placement, expected } of placements) {
    it(`returns ${expected} for placement "${placement}"`, () => {
      expect(calculateIckyPoints(placement)).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// Survival Points Boundary Tests
// ---------------------------------------------------------------------------
describe('getSurvivalPoints boundary values', () => {
  const cases: Array<{ episode: number; expected: number }> = [
    { episode: 0, expected: 1 },   // edge: falls into <=3 bracket
    { episode: 1, expected: 1 },
    { episode: 3, expected: 1 },   // boundary
    { episode: 4, expected: 2 },   // boundary
    { episode: 6, expected: 2 },   // boundary
    { episode: 7, expected: 3 },   // boundary
    { episode: 9, expected: 3 },   // boundary
    { episode: 10, expected: 5 },  // boundary
    { episode: 12, expected: 5 },  // boundary
    { episode: 13, expected: 7 },  // boundary (final 5+)
    { episode: 14, expected: 7 },
    { episode: 20, expected: 7 },
    { episode: 100, expected: 7 }, // extreme
  ];

  for (const { episode, expected } of cases) {
    it(`episode ${episode} → ${expected} points`, () => {
      expect(getSurvivalPoints(episode)).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// Leaderboard Ranking: Complex Scenarios
// ---------------------------------------------------------------------------
describe('sortAndRankScores complex scenarios', () => {
  it('handles a full 12-player league with realistic scores', () => {
    const players = [
      { display_name: 'Annie', trio_points: 45, icky_points: 8, prophecy_points: 12, total_points: 65 },
      { display_name: 'Bre', trio_points: 38, icky_points: -8, prophecy_points: 18, total_points: 48 },
      { display_name: 'Chad', trio_points: 52, icky_points: 15, prophecy_points: 8, total_points: 75 },
      { display_name: 'Cam', trio_points: 52, icky_points: 15, prophecy_points: 8, total_points: 75 }, // tied with Chad
      { display_name: 'Chase', trio_points: 30, icky_points: 0, prophecy_points: 22, total_points: 52 },
      { display_name: 'Cole', trio_points: 60, icky_points: -25, prophecy_points: 30, total_points: 65 }, // tied total with Annie
      { display_name: 'Hannah', trio_points: 25, icky_points: 8, prophecy_points: 5, total_points: 38 },
      { display_name: 'Jenna', trio_points: 10, icky_points: 0, prophecy_points: 3, total_points: 13 },
      { display_name: 'Kaylin', trio_points: 42, icky_points: -15, prophecy_points: 15, total_points: 42 },
      { display_name: 'Lizzie', trio_points: 35, icky_points: 8, prophecy_points: 20, total_points: 63 },
      { display_name: 'Scott', trio_points: 48, icky_points: -8, prophecy_points: 25, total_points: 65 }, // tied total with Annie and Cole
      { display_name: 'Taylor', trio_points: 20, icky_points: 0, prophecy_points: 10, total_points: 30 },
    ];

    const ranked = sortAndRankScores(players);

    // Verify correct order
    expect(ranked[0].display_name).toBe('Cam');     // 75 (tied with Chad, alphabetical wins)
    expect(ranked[1].display_name).toBe('Chad');     // 75
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
    expect(ranked[0].is_tied).toBe(true);
    expect(ranked[1].is_tied).toBe(true);

    // Cole (65, trio=60) > Scott (65, trio=48) > Annie (65, trio=45)
    expect(ranked[2].display_name).toBe('Cole');
    expect(ranked[3].display_name).toBe('Scott');
    expect(ranked[4].display_name).toBe('Annie');
    // These 3 have same total but different trio — not tied
    expect(ranked[2].is_tied).toBe(false);
    expect(ranked[2].rank).toBe(3);
    expect(ranked[3].rank).toBe(4);
    expect(ranked[4].rank).toBe(5);

    // Last place
    expect(ranked[11].display_name).toBe('Jenna');
    expect(ranked[11].rank).toBe(12);
  });

  it('correctly handles negative total scores', () => {
    const players = [
      { display_name: 'Alice', trio_points: -30, icky_points: -25, prophecy_points: 0, total_points: -55 },
      { display_name: 'Bob', trio_points: -10, icky_points: -8, prophecy_points: 5, total_points: -13 },
      { display_name: 'Charlie', trio_points: 5, icky_points: 0, prophecy_points: 2, total_points: 7 },
    ];

    const ranked = sortAndRankScores(players);
    expect(ranked[0].display_name).toBe('Charlie');
    expect(ranked[1].display_name).toBe('Bob');
    expect(ranked[2].display_name).toBe('Alice');
    expect(ranked.map(p => p.rank)).toEqual([1, 2, 3]);
  });

  it('handles all players with identical scores', () => {
    const players = Array.from({ length: 5 }, (_, i) => ({
      display_name: `Player${String.fromCharCode(65 + i)}`, // A, B, C, D, E
      trio_points: 10,
      icky_points: 5,
      prophecy_points: 3,
      total_points: 18,
    }));

    const ranked = sortAndRankScores(players);
    expect(ranked.every(p => p.rank === 1)).toBe(true);
    expect(ranked.every(p => p.is_tied)).toBe(true);
    // Alphabetically sorted
    expect(ranked.map(p => p.display_name)).toEqual([
      'PlayerA', 'PlayerB', 'PlayerC', 'PlayerD', 'PlayerE',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Edge Function Score Computation Parity
// ---------------------------------------------------------------------------
describe('Edge Function scoring parity', () => {
  it('trio scoring matches: events + survival for multiple castaways', () => {
    // Simulate what the Edge Function does for trio scoring
    const events: CastawayEvent[] = [
      // Castaway 10
      makeEvent(10, 'survived_episode', 100), // ep 1 → 1
      makeEvent(10, 'survived_episode', 101), // ep 2 → 1
      makeEvent(10, 'survived_episode', 102), // ep 3 → 1
      makeEvent(10, 'survived_episode', 103), // ep 4 → 2
      makeEvent(10, 'idol_found', 102),       // +5
      makeEvent(10, 'idol_played_correct', 103), // +8
      // Castaway 20
      makeEvent(20, 'survived_episode', 100), // ep 1 → 1
      makeEvent(20, 'survived_episode', 101), // ep 2 → 1
      makeEvent(20, 'voted_out_unanimously', 101), // -5
      // Castaway 30
      makeEvent(30, 'survived_episode', 100), // ep 1 → 1
      makeEvent(30, 'advantage_found', 100),  // +4
      makeEvent(30, 'survived_episode', 101), // ep 2 → 1
      makeEvent(30, 'survived_episode', 102), // ep 3 → 1
      makeEvent(30, 'survived_episode', 103), // ep 4 → 2
      makeEvent(30, 'survived_episode', 104), // ep 5 → 2
      makeEvent(30, 'survived_episode', 105), // ep 6 → 2
      makeEvent(30, 'individual_immunity_win', 105), // +6
    ];

    // Edge Function calculates per-castaway then sums
    const c10 = calculateCastawayPoints(10, events, EPISODE_MAP);
    const c20 = calculateCastawayPoints(20, events, EPISODE_MAP);
    const c30 = calculateCastawayPoints(30, events, EPISODE_MAP);

    // Castaway 10: (1+1+1+2) + 5 + 8 = 18
    expect(c10).toBe(5 + 8 + 1 + 1 + 1 + 2);
    // Castaway 20: (1+1) + (-5) = -3
    expect(c20).toBe(1 + 1 + (-5));
    // Castaway 30: 4 + 6 + (1+1+1+2+2+2) = 19
    expect(c30).toBe(4 + 6 + 1 + 1 + 1 + 2 + 2 + 2);

    // Trio total via helper
    const trioTotal = calculateTrioPoints([10, 20, 30], events, EPISODE_MAP);
    expect(trioTotal).toBe(c10 + c20 + c30);
  });

  it('prophecy scoring: partial outcomes resolved', () => {
    // Only questions 1, 3, 5, 10 have outcomes; rest are pending
    const outcomes = [
      makeOutcome(1, true),
      makeOutcome(3, false),
      makeOutcome(5, true),
      makeOutcome(10, true),
    ];

    const answers = [
      makeAnswer(1, true),   // correct → 1pt
      makeAnswer(2, true),   // no outcome → 0
      makeAnswer(3, true),   // wrong (outcome=false) → 0
      makeAnswer(5, true),   // correct → 2pt
      makeAnswer(10, false), // wrong (outcome=true) → 0
      makeAnswer(12, true),  // no outcome → 0
    ];

    const points = calculateProphecyPoints(answers, outcomes);
    expect(points).toBe(1 + 2); // only Q1 and Q5 correct
  });

  it('combined score equals trio + icky + prophecy', () => {
    const events = [
      makeEvent(1, 'survived_episode', 100),
      makeEvent(1, 'survived_episode', 101),
      makeEvent(2, 'idol_found', 100),
      makeEvent(3, 'survived_episode', 100),
    ];

    const answers = [makeAnswer(1, true), makeAnswer(8, true)];
    const outcomes = [makeOutcome(1, true), makeOutcome(8, true)];

    const trio = calculateTrioPoints([1, 2, 3], events, EPISODE_MAP);
    const icky = calculateIckyPoints('jury');
    const prophecy = calculateProphecyPoints(answers, outcomes);

    const total = trio + icky + prophecy;

    // Verify components
    expect(trio).toBe((1 + 1) + 5 + 1); // c1: 2 survival, c2: idol, c3: 1 survival
    expect(icky).toBe(-8);
    expect(prophecy).toBe(1 + 3); // Q1=1pt + Q8=3pt
    expect(total).toBe(8 + (-8) + 4);
  });
});
