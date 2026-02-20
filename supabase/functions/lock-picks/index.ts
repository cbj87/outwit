// ============================================================
// lock-picks Edge Function
// Scheduled cron to run at picks_deadline.
// Sets is_locked = true on all submitted picks.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (_req) => {
  try {
    const { data, error } = await supabase
      .from('picks')
      .update({ is_locked: true })
      .eq('is_locked', false)
      .select('player_id');

    if (error) throw error;

    const lockedCount = data?.length ?? 0;
    console.log(`Locked ${lockedCount} pick(s).`);

    return new Response(JSON.stringify({ success: true, locked: lockedCount }), {
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
