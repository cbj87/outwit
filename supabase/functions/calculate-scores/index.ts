// ============================================================
// calculate-scores Edge Function
// Invoked by commissioner after finalizing an episode.
// Recalculates player scores and upserts score_cache.
// Supports group_id param to scope to a single group,
// or omit to recalculate all groups.
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

  // Verify caller is authenticated commissioner (or service role for dashboard/CLI invocation)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');

  // Check if this is the service role key
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    ?? Deno.env.get('SERVICE_ROLE_KEY');
  const isServiceRole = serviceRoleKey && token === serviceRoleKey;

  // Parse request body
  const body = await req.json();
  const requestedGroupId = body?.group_id ?? null;
  const requestedEpisodeId = body?.episode_id ?? null;

  let userId: string | null = null;

  if (!isServiceRole) {
    // Decode the JWT payload locally (no network call) to get the user ID
    try {
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      userId = payload.sub ?? null;
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed token' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'No user ID in token' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check authorization: global commissioner OR group commissioner
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_commissioner')
      .eq('id', userId)
      .single();

    const isGlobalCommissioner = profile?.is_commissioner ?? false;

    if (!isGlobalCommissioner) {
      // Check if user is commissioner of the requested group
      if (!requestedGroupId) {
        return new Response(JSON.stringify({ error: 'Forbidden — group_id required for non-global commissioners' }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data: group } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', requestedGroupId)
        .single();

      if (!group || group.created_by !== userId) {
        return new Response(JSON.stringify({ error: 'Forbidden — not a commissioner of this group' }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  try {
    // Determine which groups to calculate for
    let groupIds: string[] = [];
    if (requestedGroupId) {
      groupIds = [requestedGroupId];
    } else {
      // All groups
      const { data: groups } = await supabase.from('groups').select('id');
      groupIds = (groups ?? []).map((g: any) => g.id);
    }

    // Load global data (shared across all groups)
    const [
      eventsResult,
      episodesResult,
      prophecyOutcomesResult,
      castawaysResult,
    ] = await Promise.all([
      supabase.from('castaway_events').select('*, episodes(episode_number)'),
      supabase.from('episodes').select('id, episode_number, is_merge').eq('is_finalized', true),
      supabase.from('prophecy_outcomes').select('*'),
      supabase.from('castaways').select('id, final_placement, is_active'),
    ]);

    const allEvents = eventsResult.data ?? [];
    const prophecyOutcomes = prophecyOutcomesResult.data ?? [];
    const castaways = castawaysResult.data ?? [];

    // Build episode number map (episode_id → episode_number)
    const mergeEpisodeNumbers = new Set<number>();
    (episodesResult.data ?? []).forEach((ep: any) => {
      if (ep.is_merge) mergeEpisodeNumbers.add(ep.episode_number);
    });

    // Determine merge episode number (earliest merge episode)
    const mergeEpisode = mergeEpisodeNumbers.size > 0 ? Math.min(...mergeEpisodeNumbers) : Infinity;

    const castawayPlacementMap = new Map<number, string | null>();
    const placementFixes: { id: number; final_placement: string }[] = [];
    castaways.forEach((c: any) => {
      let placement = c.final_placement;
      // Fallback: if castaway is eliminated but final_placement wasn't set, infer it
      if (!placement && !c.is_active) {
        const castawayEvents = allEvents.filter((e: any) => e.castaway_id === c.id);
        const hasFirstBoot = castawayEvents.some((e: any) => e.event_type === 'first_boot');
        const hasSoleSurvivor = castawayEvents.some((e: any) => e.event_type === 'sole_survivor');
        const hasRunnerUp = castawayEvents.some((e: any) => e.event_type === 'placed_runner_up');
        const has3rd = castawayEvents.some((e: any) => e.event_type === 'placed_3rd');

        if (hasSoleSurvivor) placement = 'winner';
        else if (hasRunnerUp) placement = 'runner_up';
        else if (has3rd) placement = '3rd';
        else if (hasFirstBoot) placement = 'first_boot';
        else {
          // Determine based on when they were eliminated relative to merge
          const lastEpisode = castawayEvents
            .map((e: any) => e.episodes?.episode_number ?? 0)
            .reduce((max: number, n: number) => Math.max(max, n), 0);
          placement = lastEpisode < mergeEpisode ? 'pre_merge' : 'jury';
        }
        placementFixes.push({ id: c.id, final_placement: placement });
      }
      castawayPlacementMap.set(c.id, placement);
    });

    // Persist any inferred placements back to the DB
    for (const fix of placementFixes) {
      await supabase
        .from('castaways')
        .update({ final_placement: fix.final_placement })
        .eq('id', fix.id);
    }

    // Load picks and prophecy answers globally (they are per-player, not per-group)
    const [picksResult, answersResult] = await Promise.all([
      supabase.from('picks').select('*'),
      supabase.from('prophecy_answers').select('*'),
    ]);

    const allPicks = picksResult.data ?? [];
    const allAnswers = answersResult.data ?? [];

    // Determine current episode number for snapshot
    let snapshotEpisodeNumber: number | null = null;
    if (requestedEpisodeId) {
      const ep = (episodesResult.data ?? []).find((e: any) => e.id === requestedEpisodeId);
      if (ep) snapshotEpisodeNumber = ep.episode_number;
    }
    if (!snapshotEpisodeNumber) {
      // Fall back to highest finalized episode
      snapshotEpisodeNumber = (episodesResult.data ?? [])
        .reduce((max: number, e: any) => Math.max(max, e.episode_number), 0) || null;
    }

    let totalPlayersUpdated = 0;

    // Process each group
    for (const groupId of groupIds) {
      // Get group members to filter picks
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      const memberIds = new Set((members ?? []).map((m: any) => m.user_id));
      const picks = allPicks.filter((p: any) => memberIds.has(p.player_id));

      // Calculate scores for each player in this group
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
            group_id: groupId,
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
          group_id: groupId,
          trio_points: trioPoints,
          icky_points: ickyPoints,
          prophecy_points: prophecyPoints,
          total_points: trioPoints + ickyPoints + prophecyPoints,
          last_calculated_at: new Date().toISOString(),
        });
      }

      // Upsert score cache for this group
      if (scoreCache.length > 0) {
        const { error: cacheError } = await supabase
          .from('score_cache')
          .upsert(scoreCache, { onConflict: 'player_id,group_id' });

        if (cacheError) throw cacheError;
      }

      // Upsert trio detail for this group
      if (trioDetails.length > 0) {
        const { error: detailError } = await supabase
          .from('score_cache_trio_detail')
          .upsert(trioDetails, { onConflict: 'player_id,castaway_id,group_id' });

        if (detailError) throw detailError;
      }

      // Save score snapshot for this episode (spoiler-safe leaderboard)
      if (snapshotEpisodeNumber && scoreCache.length > 0) {
        const snapshots = scoreCache.map((sc: any) => ({
          player_id: sc.player_id,
          group_id: groupId,
          episode_number: snapshotEpisodeNumber,
          trio_points: sc.trio_points,
          icky_points: sc.icky_points,
          prophecy_points: sc.prophecy_points,
          total_points: sc.total_points,
        }));

        const { error: snapError } = await supabase
          .from('score_snapshots')
          .upsert(snapshots, { onConflict: 'player_id,group_id,episode_number' });

        if (snapError) throw snapError;
      }

      totalPlayersUpdated += scoreCache.length;
    }

    // Update groups.current_episode so leaderboards reflect the latest finalized episode.
    // This runs with the service role key, bypassing RLS restrictions.
    if (snapshotEpisodeNumber) {
      await supabase
        .from('groups')
        .update({ current_episode: snapshotEpisodeNumber })
        .in('id', groupIds)
        .lt('current_episode', snapshotEpisodeNumber);
    }

    return new Response(JSON.stringify({
      success: true,
      players_updated: totalPlayersUpdated,
      groups_processed: groupIds.length,
    }), {
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
