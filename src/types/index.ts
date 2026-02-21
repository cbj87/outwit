// ============================================================
// All TypeScript types for Outwit Open
// ============================================================

export type Tribe = 'VATU' | 'CILA' | 'KALO';

export type FinalPlacement =
  | 'winner'
  | 'runner_up'
  | '3rd'
  | 'jury'
  | 'pre_merge'
  | 'first_boot'
  | null;

export type EventType =
  | 'idol_found'
  | 'advantage_found'
  | 'idol_played_correct'
  | 'idol_played_incorrect'
  | 'shot_in_dark_success'
  | 'shot_in_dark_fail'
  | 'fire_making_win'
  | 'individual_immunity_win'
  | 'individual_reward_win'
  | 'final_immunity_win'
  | 'made_jury'
  | 'placed_3rd'
  | 'placed_runner_up'
  | 'sole_survivor'
  | 'first_boot'
  | 'voted_out_with_idol'
  | 'voted_out_with_advantage'
  | 'voted_out_unanimously'
  | 'quit'
  | 'survived_episode';

export interface Castaway {
  id: number;
  name: string;
  original_tribe: Tribe;
  current_tribe: string;
  photo_url: string | null;
  is_active: boolean;
  boot_order: number | null;
  final_placement: FinalPlacement;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  is_commissioner: boolean;
  avatar_url: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeasonConfig {
  id: 1;
  picks_deadline: string;
  picks_revealed: boolean;
  current_episode: number;
  season_name: string;
}

export interface Picks {
  id: string;
  player_id: string;
  trio_castaway_1: number;
  trio_castaway_2: number;
  trio_castaway_3: number;
  icky_castaway: number;
  submitted_at: string;
  is_locked: boolean;
}

export interface ProphecyAnswer {
  id: string;
  player_id: string;
  question_id: number;
  answer: boolean;
}

export interface ProphecyOutcome {
  question_id: number;
  outcome: boolean | null;
  resolved_at: string | null;
  updated_by: string | null;
}

export interface ProphecyQuestion {
  id: number;
  text: string;
  points: number;
}

export interface Episode {
  id: number;
  episode_number: number;
  air_date: string | null;
  title: string | null;
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
}

export interface CastawayEvent {
  id: string;
  episode_id: number;
  castaway_id: number;
  event_type: EventType;
  created_at: string;
}

export interface ScoreCache {
  player_id: string;
  trio_points: number;
  icky_points: number;
  prophecy_points: number;
  total_points: number;
  last_calculated_at: string;
}

export interface ScoreCacheTrioDetail {
  player_id: string;
  castaway_id: number;
  points_earned: number;
}

// ---- Derived / UI types ----

export interface PlayerScore {
  player_id: string;
  display_name: string;
  avatar_url: string | null;
  trio_points: number;
  icky_points: number;
  prophecy_points: number;
  total_points: number;
  rank: number;
  is_tied: boolean;
  // Revealed picks (null before reveal)
  trio_castaways: [number, number, number] | null;
  icky_castaway: number | null;
}

export interface PicksSubmission {
  trio_castaway_1: number;
  trio_castaway_2: number;
  trio_castaway_3: number;
  icky_castaway: number;
  prophecy_answers: Record<number, boolean>; // question_id -> answer
}

export interface CastawayWithEvents extends Castaway {
  events: CastawayEvent[];
  total_points: number;
}
