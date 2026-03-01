// ============================================================
// Pure scoring functions
// Used by the Edge Function (calculate-scores) and client-side
// for displaying per-castaway breakdowns.
// ============================================================

import {
  EVENT_SCORES,
  ICKY_PICK_SCORES,
  PROPHECY_POINTS,
  getSurvivalPoints,
} from '@/lib/constants';
import type { CastawayEvent, ProphecyAnswer, ProphecyOutcome, FinalPlacement } from '@/types';

/**
 * Calculate the total points earned for a single castaway across all events.
 * Used for Trusted Trio scoring.
 */
export function calculateCastawayPoints(
  castawayId: number,
  events: CastawayEvent[],
  episodeNumbers: Map<number, number>, // episode_id -> episode_number
): number {
  return events
    .filter((e) => e.castaway_id === castawayId)
    .reduce((sum, e) => {
      if (e.event_type === 'survived_episode') {
        const episodeNumber = episodeNumbers.get(e.episode_id) ?? 0;
        return sum + getSurvivalPoints(episodeNumber);
      }
      return sum + (EVENT_SCORES[e.event_type] ?? 0);
    }, 0);
}

/**
 * Calculate Trusted Trio total for a player (sum of 3 castaways' points).
 */
export function calculateTrioPoints(
  trioCastawayIds: [number, number, number],
  events: CastawayEvent[],
  episodeNumbers: Map<number, number>,
): number {
  return trioCastawayIds.reduce(
    (sum, id) => sum + calculateCastawayPoints(id, events, episodeNumbers),
    0,
  );
}

/**
 * Calculate Icky Pick points based on the castaway's final placement.
 * Returns 0 if the castaway is still active (no placement yet).
 */
export function calculateIckyPoints(finalPlacement: FinalPlacement): number {
  if (!finalPlacement) return 0;
  return ICKY_PICK_SCORES[finalPlacement] ?? 0;
}

/**
 * Calculate Prophecy points for a player.
 * Correct answer = points listed; wrong answer = 0; unresolved = 0.
 */
export function calculateProphecyPoints(
  answers: ProphecyAnswer[],
  outcomes: ProphecyOutcome[],
): number {
  const outcomeMap = new Map(outcomes.map((o) => [o.question_id, o.outcome]));

  return answers.reduce((sum, answer) => {
    const outcome = outcomeMap.get(answer.question_id);
    if (outcome === null || outcome === undefined) return sum; // unresolved
    return sum + (answer.answer === outcome ? (PROPHECY_POINTS[answer.question_id] ?? 0) : 0);
  }, 0);
}

/**
 * Sort player scores applying tie-breaking rules:
 * Total → Trio → Prophecy → Icky → Alphabetical
 */
export function sortAndRankScores<
  T extends {
    display_name: string;
    total_points: number;
    trio_points: number;
    prophecy_points: number;
    icky_points: number;
  },
>(players: T[]): (T & { rank: number; is_tied: boolean })[] {
  const sorted = [...players].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.trio_points !== a.trio_points) return b.trio_points - a.trio_points;
    if (b.prophecy_points !== a.prophecy_points) return b.prophecy_points - a.prophecy_points;
    if (b.icky_points !== a.icky_points) return b.icky_points - a.icky_points;
    return a.display_name.localeCompare(b.display_name);
  });

  // Assign ranks and tied flags
  let currentRank = 1;
  return sorted.map((player, index, arr) => {
    const prev = arr[index - 1];
    const next = arr[index + 1];

    const isSameAsPrev = prev
      ? prev.total_points === player.total_points &&
        prev.trio_points === player.trio_points &&
        prev.prophecy_points === player.prophecy_points &&
        prev.icky_points === player.icky_points
      : false;

    const isSameAsNext = next
      ? next.total_points === player.total_points &&
        next.trio_points === player.trio_points &&
        next.prophecy_points === player.prophecy_points &&
        next.icky_points === player.icky_points
      : false;

    if (!isSameAsPrev) {
      currentRank = index + 1;
    }

    return {
      ...player,
      rank: currentRank,
      is_tied: isSameAsPrev || isSameAsNext,
    };
  });
}
