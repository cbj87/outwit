// ============================================================
// Scoring constants — canonical source of truth
// All scoring logic in scoring.ts and the Edge Function references this.
// ============================================================

import type { EventType, ProphecyQuestion } from '@/types';

// Points per event type (used for Trusted Trio castaways)
export const EVENT_SCORES: Record<EventType, number> = {
  idol_found: 5,
  advantage_found: 4,
  idol_played_correct: 8,
  idol_played_incorrect: -3,
  shot_in_dark_success: 6,
  shot_in_dark_fail: -5,
  fire_making_win: 10,
  individual_immunity_win: 6,
  individual_reward_win: 3,
  final_immunity_win: 12,
  made_jury: 5,
  placed_3rd: 20,
  placed_runner_up: 25,
  sole_survivor: 40,
  first_boot: -25,
  voted_out_with_idol: -12,
  voted_out_with_advantage: -10,
  voted_out_unanimously: -5,
  quit: -25,
  survived_episode: 0, // Variable — determined by episode phase below
};

// Survival points per episode survived, indexed by episode number (1-based)
// Episodes beyond 12 use Final 5 (7) or Final 4 (10) rules set by commissioner
export function getSurvivalPoints(episodeNumber: number): number {
  if (episodeNumber <= 3) return 1;
  if (episodeNumber <= 6) return 2;
  if (episodeNumber <= 9) return 3;
  if (episodeNumber <= 12) return 5;
  // Episodes 13+ are labeled by commissioner as Final 5 or Final 4
  // The Edge Function uses the episode title to determine this.
  // Default to 7 (Final 5) — commissioner sets correct value via episode title.
  return 7;
}

export const SURVIVAL_POINTS_BY_PHASE: Record<string, number> = {
  'episodes_1_3': 1,
  'episodes_4_6': 2,
  'episodes_7_9': 3,
  'episodes_10_12': 5,
  'final_5': 7,
  'final_4': 10,
};

// Icky Pick points by final placement
export const ICKY_PICK_SCORES: Record<string, number> = {
  first_boot: 15,
  pre_merge: 8,
  jury: -8,
  '3rd': -15,
  winner: -25,
};

// Prophecy question points (question_id -> points)
export const PROPHECY_POINTS: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
  4: 2,
  5: 2,
  6: 2,
  7: 2,
  8: 3,
  9: 3,
  10: 4,
  11: 4,
  12: 4,
  13: 4,
  14: 4,
  15: 4,
  16: 4,
};

// Prophecy question text (for display)
export const PROPHECY_QUESTIONS: ProphecyQuestion[] = [
  { id: 1,  text: 'Q mentions cancelling Christmas',                       points: 1 },
  { id: 2,  text: 'Someone says they\'re "playing chess not checkers"',     points: 1 },
  { id: 3,  text: 'They play the eagle screech sound when Coach is on screen', points: 1 },
  { id: 4,  text: 'Jeff uses his British accent',                           points: 2 },
  { id: 5,  text: 'A live tribal occurs',                                   points: 2 },
  { id: 6,  text: 'Someone is voted out with an idol in their pocket',      points: 2 },
  { id: 7,  text: 'A player plays an idol for someone else',                points: 2 },
  { id: 8,  text: 'Someone plays a fake idol',                              points: 3 },
  { id: 9,  text: 'A unanimous vote happens post-merge, pre-final tribal',  points: 3 },
  { id: 10, text: 'A player gives up individual immunity',                  points: 4 },
  { id: 11, text: 'Someone plays Shot in the Dark successfully',            points: 4 },
  { id: 12, text: 'A medical evacuation occurs',                            points: 4 },
  { id: 13, text: 'A rock draw happens',                                    points: 4 },
  { id: 14, text: 'There is an actual loved one visit',                     points: 4 },
  { id: 15, text: 'The winner receives a unanimous jury vote',              points: 4 },
  { id: 16, text: 'Final tribal ends in a 4–4 tie',                        points: 4 },
];

// Castaways listed by tribe (for display order)
export const CASTAWAY_TRIBES = {
  VATU: ['Colby', 'Genevieve', 'Rizzo', 'Angelina', 'Q', 'Stephenie', 'Kyle', 'Aubry'],
  CILA: ['Joe', 'Savannah', 'Christian', 'Cirie', 'Ozzy', 'Emily', 'Rick', 'Jenna'],
  KALO: ['Jonathan', 'Dee', 'Mike', 'Kamilla', 'Charlie', 'Tiffany', 'Coach', 'Chrissy'],
} as const;

// Event type labels for admin UI display
export const EVENT_LABELS: Record<string, string> = {
  survived_episode: 'Survived Episode',
  idol_found: 'Found Idol',
  advantage_found: 'Found or Earned Advantage',
  individual_immunity_win: 'Won Individual Immunity',
  individual_reward_win: 'Won Individual Reward',
  idol_played_correct: 'Played Idol (Correctly)',
  idol_played_incorrect: 'Played Idol (Incorrectly)',
  shot_in_dark_success: 'Shot in the Dark — Success',
  shot_in_dark_fail: 'Shot in the Dark — Still Unsafe',
  fire_making_win: 'Won Fire Making Challenge',
  final_immunity_win: 'Won Final Immunity (F4)',
  voted_out_with_idol: 'Voted Out with Idol',
  voted_out_with_advantage: 'Voted Out with Advantage',
  voted_out_unanimously: 'Voted Out Unanimously',
  quit: 'Quit (Non-Medical)',
  first_boot: 'First Boot',
  made_jury: 'Made Jury',
  placed_3rd: '3rd Place',
  placed_runner_up: 'Runner-Up',
  sole_survivor: 'Sole Survivor',
};
