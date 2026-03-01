import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useCastaways } from '@/hooks/useCastaways';
import { EVENT_LABELS, EVENT_SCORES, getSurvivalPoints, PROPHECY_QUESTIONS } from '@/lib/constants';
import { useTribeColors } from '@/hooks/useTribeColors';
import { colors } from '@/theme/colors';
import type { Castaway, EventType, Profile, Picks, ProphecyOutcome, ProphecyAnswer, ScoreSnapshot } from '@/types';

export default function EpisodeRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const episodeId = Number(id);
  const activeGroup = useAuthStore((state) => state.activeGroup);
  const groupId = activeGroup?.id ?? null;
  const { data: castaways, isLoading: castawaysLoading } = useCastaways();
  const tribeColors = useTribeColors();
  const castawayMap = useMemo(() => {
    const map = new Map<number, Castaway>();
    castaways?.forEach((c) => map.set(c.id, c));
    return map;
  }, [castaways]);

  const { data: episode, isLoading: episodeLoading } = useQuery({
    queryKey: ['episode', episodeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('episodes')
        .select('id, episode_number, is_merge, is_finale')
        .eq('id', episodeId)
        .single();
      return data;
    },
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['episode-events', episodeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('castaway_events')
        .select('castaway_id, event_type')
        .eq('episode_id', episodeId);
      return data ?? [];
    },
  });

  // Fantasy data — depends on episode being loaded
  const epNum = episode?.episode_number ?? 0;
  const { data: fantasyData, isLoading: fantasyLoading } = useQuery({
    queryKey: ['episode-fantasy', episodeId, groupId, epNum],
    queryFn: async () => {
      const [membersRes, profilesRes, picksRes, curSnapsRes, prevSnapsRes, prophecyOutRes, prophecyAnsRes] = await Promise.all([
        supabase.from('group_members').select('user_id').eq('group_id', groupId!),
        supabase.from('profiles').select('id, display_name, avatar_url'),
        supabase.from('picks').select('player_id, trio_castaway_1, trio_castaway_2, trio_castaway_3, icky_castaway'),
        supabase.from('score_snapshots').select('*').eq('group_id', groupId!).eq('episode_number', epNum),
        epNum > 1
          ? supabase.from('score_snapshots').select('*').eq('group_id', groupId!).eq('episode_number', epNum - 1)
          : Promise.resolve({ data: [] as ScoreSnapshot[], error: null }),
        supabase.from('prophecy_outcomes').select('*').eq('episode_number', epNum),
        supabase.from('prophecy_answers').select('*'),
      ]);

      const memberIds = new Set((membersRes.data ?? []).map((m: any) => m.user_id));
      const profiles = (profilesRes.data as Pick<Profile, 'id' | 'display_name' | 'avatar_url'>[] ?? [])
        .filter((p) => memberIds.has(p.id));
      const picks = (picksRes.data as Picks[] ?? []).filter((p) => memberIds.has(p.player_id));
      const curSnaps = (curSnapsRes.data ?? []) as ScoreSnapshot[];
      const prevSnaps = (prevSnapsRes.data ?? []) as ScoreSnapshot[];
      const prophecyOuts = (prophecyOutRes.data ?? []) as ProphecyOutcome[];
      const prophecyAns = (prophecyAnsRes.data ?? []) as ProphecyAnswer[];

      return { profiles, picks, curSnaps, prevSnaps, prophecyOuts, prophecyAns, memberIds };
    },
    enabled: !!epNum && !!groupId,
  });

  const grouped = useMemo(() => {
    if (!events || !castawayMap) return [];

    const byPlayer: Record<number, EventType[]> = {};
    for (const { castaway_id, event_type } of events) {
      if (!byPlayer[castaway_id]) byPlayer[castaway_id] = [];
      byPlayer[castaway_id].push(event_type);
    }

    const epNum = episode?.episode_number ?? 1;
    const survivalPts = getSurvivalPoints(epNum);

    return Object.entries(byPlayer)
      .map(([idStr, eventList]) => {
        const castawayId = Number(idStr);
        const castaway = castawayMap.get(castawayId);
        const survived = eventList.includes('survived_episode');
        const notable = eventList.filter((e) => e !== 'survived_episode');

        let totalPoints = 0;
        if (survived) totalPoints += survivalPts;
        for (const e of notable) {
          totalPoints += EVENT_SCORES[e] ?? 0;
        }

        return {
          castawayId,
          name: castaway?.name ?? `#${castawayId}`,
          tribe: castaway?.original_tribe,
          survived,
          notable,
          totalPoints,
        };
      })
      .sort((a, b) => {
        // Show notable events first, then survived-only
        const aHasNotable = a.notable.length > 0;
        const bHasNotable = b.notable.length > 0;
        if (aHasNotable && !bHasNotable) return -1;
        if (!aHasNotable && bHasNotable) return 1;
        // Then by absolute points descending
        if (Math.abs(b.totalPoints) !== Math.abs(a.totalPoints)) {
          return Math.abs(b.totalPoints) - Math.abs(a.totalPoints);
        }
        return a.name.localeCompare(b.name);
      });
  }, [events, castawayMap, episode]);

  // Compute per-player fantasy score deltas for this episode
  const fantasyScores = useMemo(() => {
    if (!fantasyData) return [];
    const { profiles, picks, curSnaps, prevSnaps } = fantasyData;
    const prevMap = new Map(prevSnaps.map((s) => [s.player_id, s]));
    const curMap = new Map(curSnaps.map((s) => [s.player_id, s]));
    const picksMap = new Map(picks.map((p) => [p.player_id, p]));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return profiles
      .map((profile) => {
        const cur = curMap.get(profile.id);
        const prev = prevMap.get(profile.id);
        const pick = picksMap.get(profile.id);
        if (!cur) return null;

        const trioDelta = cur.trio_points - (prev?.trio_points ?? 0);
        const ickyDelta = cur.icky_points - (prev?.icky_points ?? 0);
        const prophecyDelta = cur.prophecy_points - (prev?.prophecy_points ?? 0);
        const totalDelta = cur.total_points - (prev?.total_points ?? 0);

        return {
          playerId: profile.id,
          displayName: profile.display_name,
          trioDelta,
          ickyDelta,
          prophecyDelta,
          totalDelta,
          trioIds: pick ? [pick.trio_castaway_1, pick.trio_castaway_2, pick.trio_castaway_3] : [],
          ickyCastawayId: pick?.icky_castaway ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.totalDelta - a.totalDelta);
  }, [fantasyData]);

  // Compute prophecy resolutions for this episode
  const prophecyResolutions = useMemo(() => {
    if (!fantasyData || fantasyData.prophecyOuts.length === 0) return [];
    const { prophecyOuts, prophecyAns, memberIds } = fantasyData;
    const playerAnswers = prophecyAns.filter((a) => memberIds.has(a.player_id));

    return prophecyOuts.map((outcome) => {
      const question = PROPHECY_QUESTIONS.find((q) => q.id === outcome.question_id);
      if (!question) return null;
      const answersForQ = playerAnswers.filter((a) => a.question_id === outcome.question_id);
      const correct = answersForQ.filter((a) => a.answer === outcome.outcome);
      const wrong = answersForQ.filter((a) => a.answer !== outcome.outcome);

      return {
        questionId: outcome.question_id,
        text: question.text,
        points: question.points,
        outcome: outcome.outcome,
        correctPlayerIds: correct.map((a) => a.player_id),
        wrongPlayerIds: wrong.map((a) => a.player_id),
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [fantasyData]);

  const isLoading = episodeLoading || eventsLoading || castawaysLoading;

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (!episode) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Episode not found.</Text>
      </View>
    );
  }

  const survivalPts = getSurvivalPoints(epNum);
  const survivedCount = grouped.filter((g) => g.survived).length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Episode ${epNum}` }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Episode header */}
        <View style={styles.header}>
          <Text style={styles.title}>Episode {epNum}</Text>
          <View style={styles.headerBadges}>
            {episode.is_merge && (
              <View style={styles.tagBadge}><Text style={styles.tagBadgeText}>Merge</Text></View>
            )}
            {episode.is_finale && (
              <View style={styles.tagBadge}><Text style={styles.tagBadgeText}>Finale</Text></View>
            )}
          </View>
        </View>

        {/* Survival context */}
        <View style={styles.survivalBanner}>
          <Text style={styles.survivalText}>
            {survivedCount} castaways survived  ·  +{survivalPts} pt{survivalPts !== 1 ? 's' : ''} each
          </Text>
        </View>

        {/* Castaway event groups */}
        {grouped.map((entry) => (
          <View key={entry.castawayId} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                {entry.tribe && (
                  <View style={[styles.tribeDot, { backgroundColor: tribeColors[entry.tribe] }]} />
                )}
                <Text style={styles.castawayName}>{entry.name}</Text>
              </View>
              <Text style={[
                styles.pointsTotal,
                entry.totalPoints > 0 && { color: colors.scorePositive },
                entry.totalPoints < 0 && { color: colors.scoreNegative },
                entry.totalPoints === 0 && { color: colors.scoreNeutral },
              ]}>
                {entry.totalPoints > 0 ? '+' : ''}{entry.totalPoints}
              </Text>
            </View>

            <View style={styles.eventList}>
              {entry.survived && (
                <View style={styles.eventRow}>
                  <Text style={styles.eventLabel}>Survived</Text>
                  <Text style={[styles.eventPoints, { color: colors.scorePositive }]}>
                    +{survivalPts}
                  </Text>
                </View>
              )}
              {entry.notable.map((event, i) => {
                const pts = EVENT_SCORES[event] ?? 0;
                return (
                  <View key={`${event}-${i}`} style={styles.eventRow}>
                    <Text style={styles.eventLabel}>{EVENT_LABELS[event] ?? event}</Text>
                    <Text style={[
                      styles.eventPoints,
                      pts > 0 && { color: colors.scorePositive },
                      pts < 0 && { color: colors.scoreNegative },
                      pts === 0 && { color: colors.scoreNeutral },
                    ]}>
                      {pts > 0 ? '+' : ''}{pts}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Fantasy Scores */}
        {fantasyScores.length > 0 && (
          <>
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>Fantasy Scores</Text>
            </View>
            {fantasyScores.map((player) => (
              <View key={player.playerId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.castawayName}>{player.displayName}</Text>
                  <Text style={[
                    styles.pointsTotal,
                    player.totalDelta > 0 && { color: colors.scorePositive },
                    player.totalDelta < 0 && { color: colors.scoreNegative },
                    player.totalDelta === 0 && { color: colors.scoreNeutral },
                  ]}>
                    {player.totalDelta > 0 ? '+' : ''}{player.totalDelta}
                  </Text>
                </View>
                <View style={styles.eventList}>
                  {player.trioDelta !== 0 && (
                    <View style={styles.eventRow}>
                      <Text style={styles.eventLabel}>
                        Trio ({player.trioIds.map((cid) => castawayMap.get(cid)?.name ?? '?').join(', ')})
                      </Text>
                      <Text style={[
                        styles.eventPoints,
                        player.trioDelta > 0 && { color: colors.scorePositive },
                        player.trioDelta < 0 && { color: colors.scoreNegative },
                      ]}>
                        {player.trioDelta > 0 ? '+' : ''}{player.trioDelta}
                      </Text>
                    </View>
                  )}
                  {player.ickyDelta !== 0 && (
                    <View style={styles.eventRow}>
                      <Text style={styles.eventLabel}>
                        Icky ({castawayMap.get(player.ickyCastawayId ?? 0)?.name ?? '?'})
                      </Text>
                      <Text style={[
                        styles.eventPoints,
                        player.ickyDelta > 0 && { color: colors.scorePositive },
                        player.ickyDelta < 0 && { color: colors.scoreNegative },
                      ]}>
                        {player.ickyDelta > 0 ? '+' : ''}{player.ickyDelta}
                      </Text>
                    </View>
                  )}
                  {player.prophecyDelta !== 0 && (
                    <View style={styles.eventRow}>
                      <Text style={styles.eventLabel}>Prophecy</Text>
                      <Text style={[styles.eventPoints, { color: colors.scorePositive }]}>
                        +{player.prophecyDelta}
                      </Text>
                    </View>
                  )}
                  {player.totalDelta === 0 && (
                    <View style={styles.eventRow}>
                      <Text style={styles.eventLabel}>No scoring changes</Text>
                      <Text style={[styles.eventPoints, { color: colors.scoreNeutral }]}>0</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Prophecy Resolutions */}
        {prophecyResolutions.length > 0 && (
          <>
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>Prophecy Resolutions</Text>
            </View>
            {prophecyResolutions.map((res) => {
              const profileMap = fantasyData ? new Map(fantasyData.profiles.map((p) => [p.id, p])) : new Map();
              return (
                <View key={res.questionId} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.castawayName}>{res.text}</Text>
                      <Text style={styles.prophecyOutcomeText}>
                        Answer: {res.outcome ? 'YES' : 'NO'}  ·  {res.points} pt{res.points !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  {(res.correctPlayerIds.length > 0 || res.wrongPlayerIds.length > 0) && (
                    <View style={styles.eventList}>
                      {res.correctPlayerIds.length > 0 && (
                        <View style={styles.eventRow}>
                          <Text style={[styles.eventLabel, { color: colors.success }]}>
                            ✓ {res.correctPlayerIds.map((id) => profileMap.get(id)?.display_name ?? '?').join(', ')}
                          </Text>
                          <Text style={[styles.eventPoints, { color: colors.success }]}>+{res.points}</Text>
                        </View>
                      )}
                      {res.wrongPlayerIds.length > 0 && (
                        <View style={styles.eventRow}>
                          <Text style={[styles.eventLabel, { color: colors.textMuted }]}>
                            ✗ {res.wrongPlayerIds.map((id) => profileMap.get(id)?.display_name ?? '?').join(', ')}
                          </Text>
                          <Text style={[styles.eventPoints, { color: colors.textMuted }]}>+0</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  headerBadges: { flexDirection: 'row', gap: 6 },
  tagBadge: {
    backgroundColor: colors.primary + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  tagBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  survivalBanner: {
    backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
  },
  survivalText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  card: {
    backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tribeDot: { width: 8, height: 8, borderRadius: 4 },
  castawayName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  pointsTotal: { fontSize: 16, fontWeight: '800' },
  eventList: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlass,
    paddingHorizontal: 14, paddingVertical: 8, gap: 4,
  },
  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 3,
  },
  eventLabel: { color: colors.textSecondary, fontSize: 13 },
  eventPoints: { fontSize: 13, fontWeight: '600' },
  sectionDivider: {
    marginTop: 12, marginBottom: 2, paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlass,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  prophecyOutcomeText: { color: colors.textSecondary, fontSize: 12 },
});
