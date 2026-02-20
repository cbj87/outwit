// ============================================================
// calculate-scores Edge Function
// Invoked by commissioner after finalizing an episode.
// Recalculates all player scores and upserts score_cache.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Event point values — must match src/lib/constants.ts
const EVENT_SCORES: Record<string, number> = {
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
};

const ICKY_PICK_SCORES: Record<string, number> = {
  first_boot: 15,
  pre_merge: 8,
  jury: -8,
  '3rd': -15,
  winner: -25,
};

const PROPHECY_POINTS: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 2,
  8: 3, 9: 3, 10: 4, 11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4,
};

function getSurvivalPoints(episodeNumber: number): number {
  if (episodeNumber <= 3) return 1;
  if (episodeNumber <= 6) return 2;
  if (episodeNumber <= 9) return 3;
  if (episodeNumber <= 12) return 5;
  return 7; // Final 5+ — commissioner sets correct phase via episode logging context
}

Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verify caller is authenticated commissioner
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_commissioner')
    .eq('id', user.id)
    .single();

  if (!profile?.is_commissioner) {
    return new Response('Forbidden', { status: 403 });
  }

  // Parse request
  const body = await req.json();
  const episodeId = body?.episode_id;

  try {
    // Load all data needed for scoring
    const [
      picksResult,
      answersResult,
      eventsResult,
      episodesResult,
      prophecyOutcomesResult,
      castawaysResult,
    ] = await Promise.all([
      supabase.from('picks').select('*'),
      supabase.from('prophecy_answers').select('*'),
      supabase.from('castaway_events').select('*, episodes(episode_number)'),
      supabase.from('episodes').select('id, episode_number').eq('is_finalized', true),
      supabase.from('prophecy_outcomes').select('*'),
      supabase.from('castaways').select('id, final_placement'),
    ]);

    const picks = picksResult.data ?? [];
    const allAnswers = answersResult.data ?? [];
    const allEvents = eventsResult.data ?? [];
    const prophecyOutcomes = prophecyOutcomesResult.data ?? [];
    const castaways = castawaysResult.data ?? [];

    // Build episode number map (episode_id → episode_number)
    const episodeNumberMap = new Map<number, number>();
    (episodesResult.data ?? []).forEach((ep: any) => {
      episodeNumberMap.set(ep.id, ep.episode_number);
    });

    const castawayPlacementMap = new Map<number, string | null>();
    castaways.forEach((c: any) => castawayPlacementMap.set(c.id, c.final_placement));

    // Calculate scores for each player
    const scoreCache: any[] = [];
    const trioDetails: any[] = [];

    for (const pick of picks) {
      const playerAnswers = allAnswers.filter((a: any) => a.player_id === pick.player_id);

      // Trusted Trio
      const trioCastawayIds = [pick.trio_castaway_1, pick.trio_castaway_2, pick.trio_castaway_3];
      let trioPoints = 0;

      for (const castawayId of trioCastawayIds) {
        const castawayEvents = allEvents.filter((e: any) => e.castaway_id === castawayId);
        let castawayPoints = 0;

        for (const event of castawayEvents) {
          if (event.event_type === 'survived_episode') {
            const episodeNum = event.episodes?.episode_number ?? 0;
            castawayPoints += getSurvivalPoints(episodeNum);
          } else {
            castawayPoints += EVENT_SCORES[event.event_type] ?? 0;
          }
        }

        trioPoints += castawayPoints;
        trioDetails.push({
          player_id: pick.player_id,
          castaway_id: castawayId,
          points_earned: castawayPoints,
        });
      }

      // Icky Pick
      const ickyPlacement = castawayPlacementMap.get(pick.icky_castaway);
      const ickyPoints = ickyPlacement ? (ICKY_PICK_SCORES[ickyPlacement] ?? 0) : 0;

      // Prophecy
      const outcomeMap = new Map(prophecyOutcomes.map((o: any) => [o.question_id, o.outcome]));
      let prophecyPoints = 0;
      for (const answer of playerAnswers) {
        const outcome = outcomeMap.get(answer.question_id);
        if (outcome !== null && outcome !== undefined) {
          if (answer.answer === outcome) {
            prophecyPoints += PROPHECY_POINTS[answer.question_id] ?? 0;
          }
        }
      }

      scoreCache.push({
        player_id: pick.player_id,
        trio_points: trioPoints,
        icky_points: ickyPoints,
        prophecy_points: prophecyPoints,
        total_points: trioPoints + ickyPoints + prophecyPoints,
        last_calculated_at: new Date().toISOString(),
      });
    }

    // Upsert score cache
    const { error: cacheError } = await supabase
      .from('score_cache')
      .upsert(scoreCache, { onConflict: 'player_id' });

    if (cacheError) throw cacheError;

    // Upsert trio detail
    if (trioDetails.length > 0) {
      const { error: detailError } = await supabase
        .from('score_cache_trio_detail')
        .upsert(trioDetails, { onConflict: 'player_id,castaway_id' });

      if (detailError) throw detailError;
    }

    // TODO: Send push notifications to all players

    return new Response(JSON.stringify({ success: true, players_updated: scoreCache.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('calculate-scores error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
