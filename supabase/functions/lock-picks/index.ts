// ============================================================
// lock-picks Edge Function
// Scheduled cron — checks each group's picks_deadline and
// locks picks for any player in a group whose deadline has passed.
// Picks are global (per-player), so we lock the player's single
// pick row if any of their groups' deadlines have expired.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (_req) => {
  try {
    // Picks are global (per-player, not per-group). Lock a player's picks
    // if ANY group they belong to has a passed deadline.
    const { data: expiredGroups, error: groupsError } = await supabase
      .from('groups')
      .select('id')
      .lt('picks_deadline', new Date().toISOString());

    if (groupsError) throw groupsError;

    if (!expiredGroups || expiredGroups.length === 0) {
      return new Response(JSON.stringify({ success: true, locked: 0, groups_checked: 0 }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Collect all player IDs that belong to any expired-deadline group
    const expiredGroupIds = expiredGroups.map((g: any) => g.id);
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .in('group_id', expiredGroupIds);

    if (membersError) throw membersError;

    const playerIds = [...new Set((members ?? []).map((m: any) => m.user_id))];

    let totalLocked = 0;
    if (playerIds.length > 0) {
      const { data, error } = await supabase
        .from('picks')
        .update({ is_locked: true })
        .in('player_id', playerIds)
        .eq('is_locked', false)
        .select('player_id');

      if (error) throw error;
      totalLocked = data?.length ?? 0;
    }

    console.log(`Locked ${totalLocked} pick(s) for players in ${expiredGroups.length} expired-deadline group(s).`);

    return new Response(JSON.stringify({ success: true, locked: totalLocked, groups_checked: expiredGroups.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('lock-picks error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
