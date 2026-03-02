import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCastaways } from '@/hooks/useCastaways';
import { EVENT_LABELS, EVENT_SCORES, ICKY_PICK_SCORES, getSurvivalPoints, PROPHECY_QUESTIONS } from '@/lib/constants';
import { useTribeColors } from '@/hooks/useTribeColors';
import { colors } from '@/theme/colors';
import type { Castaway, EventType } from '@/types';

// Map event types to icky placement categories
const ICKY_EVENT_MAP: Partial<Record<EventType, string>> = {
  first_boot: 'first_boot',
  made_jury: 'jury',
  placed_3rd: '3rd',
  sole_survivor: 'winner',
};

export default function EpisodeRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const episodeId = Number(id);
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

  const epNum = episode?.episode_number ?? 0;

  // Prophecy outcomes resolved this episode
  const { data: prophecyOutcomes } = useQuery({
    queryKey: ['episode-prophecy', episodeId, epNum],
    queryFn: async () => {
      const { data } = await supabase
        .from('prophecy_outcomes')
        .select('question_id, outcome')
        .eq('episode_number', epNum);
      return data ?? [];
    },
    enabled: !!epNum,
  });

  // Group events by castaway, compute trio + icky breakdowns
  const grouped = useMemo(() => {
    if (!events || !castawayMap) return [];

    const byPlayer: Record<number, EventType[]> = {};
    for (const { castaway_id, event_type } of events) {
      if (!byPlayer[castaway_id]) byPlayer[castaway_id] = [];
      byPlayer[castaway_id].push(event_type);
    }

    const survivalPts = getSurvivalPoints(epNum || 1);

    return Object.entries(byPlayer)
      .map(([idStr, eventList]) => {
        const castawayId = Number(idStr);
        const castaway = castawayMap.get(castawayId);
        const survived = eventList.includes('survived_episode');
        const notable = eventList.filter((e) => e !== 'survived_episode');

        // Trusted Trio: all events with trio point values
        const trioEvents: { label: string; points: number }[] = [];
        let trioTotal = 0;
        if (survived) {
          trioEvents.push({ label: 'Survived', points: survivalPts });
          trioTotal += survivalPts;
        }
        for (const e of notable) {
          const pts = EVENT_SCORES[e] ?? 0;
          trioEvents.push({ label: EVENT_LABELS[e] ?? e, points: pts });
          trioTotal += pts;
        }

        // Icky Pick: only events that map to icky placements
        const ickyEvents: { label: string; points: number }[] = [];
        let ickyTotal = 0;
        for (const e of notable) {
          const placement = ICKY_EVENT_MAP[e];
          if (placement && ICKY_PICK_SCORES[placement] !== undefined) {
            const pts = ICKY_PICK_SCORES[placement];
            ickyEvents.push({ label: EVENT_LABELS[e] ?? e, points: pts });
            ickyTotal += pts;
          }
        }

        return {
          castawayId,
          name: castaway?.name ?? `#${castawayId}`,
          tribe: castaway?.original_tribe,
          trioEvents,
          trioTotal,
          ickyEvents,
          ickyTotal,
          hasNotable: notable.length > 0,
        };
      })
      .sort((a, b) => {
        if (a.hasNotable && !b.hasNotable) return -1;
        if (!a.hasNotable && b.hasNotable) return 1;
        if (Math.abs(b.trioTotal) !== Math.abs(a.trioTotal)) {
          return Math.abs(b.trioTotal) - Math.abs(a.trioTotal);
        }
        return a.name.localeCompare(b.name);
      });
  }, [events, castawayMap, epNum]);

  // Prophecy resolutions
  const prophecyResolutions = useMemo(() => {
    if (!prophecyOutcomes || prophecyOutcomes.length === 0) return [];
    return prophecyOutcomes
      .map((outcome) => {
        const question = PROPHECY_QUESTIONS.find((q) => q.id === outcome.question_id);
        if (!question) return null;
        return {
          questionId: outcome.question_id,
          text: question.text,
          points: question.points,
          outcome: outcome.outcome,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [prophecyOutcomes]);

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
  const survivedCount = grouped.filter((g) => g.trioEvents.some((e) => e.label === 'Survived')).length;

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

        {/* Castaway event cards */}
        {grouped.map((entry) => (
          <View key={entry.castawayId} style={styles.card}>
            {/* Castaway name — no points total */}
            <View style={styles.cardHeader}>
              {entry.tribe && (
                <View style={[styles.tribeDot, { backgroundColor: tribeColors[entry.tribe] }]} />
              )}
              <Text style={styles.castawayName}>{entry.name}</Text>
            </View>

            {/* Trusted Trio breakdown */}
            <View style={styles.scoringSection}>
              <View style={styles.scoringSectionHeader}>
                <Text style={styles.scoringSectionLabel}>TRUSTED TRIO</Text>
                <Text style={[
                  styles.scoringSectionTotal,
                  entry.trioTotal > 0 && { color: colors.scorePositive },
                  entry.trioTotal < 0 && { color: colors.scoreNegative },
                ]}>
                  {entry.trioTotal > 0 ? '+' : ''}{entry.trioTotal}
                </Text>
              </View>
              {entry.trioEvents.map((ev, i) => (
                <View key={i} style={styles.eventRow}>
                  <Text style={styles.eventLabel}>{ev.label}</Text>
                  <Text style={[
                    styles.eventPoints,
                    ev.points > 0 && { color: colors.scorePositive },
                    ev.points < 0 && { color: colors.scoreNegative },
                  ]}>
                    {ev.points > 0 ? '+' : ''}{ev.points}
                  </Text>
                </View>
              ))}
            </View>

            {/* Icky Pick breakdown — only shown when applicable */}
            {entry.ickyEvents.length > 0 && (
              <View style={styles.scoringSection}>
                <View style={styles.scoringSectionHeader}>
                  <Text style={styles.scoringSectionLabel}>ICKY PICK</Text>
                  <Text style={[
                    styles.scoringSectionTotal,
                    entry.ickyTotal > 0 && { color: colors.scorePositive },
                    entry.ickyTotal < 0 && { color: colors.scoreNegative },
                  ]}>
                    {entry.ickyTotal > 0 ? '+' : ''}{entry.ickyTotal}
                  </Text>
                </View>
                {entry.ickyEvents.map((ev, i) => (
                  <View key={i} style={styles.eventRow}>
                    <Text style={styles.eventLabel}>{ev.label}</Text>
                    <Text style={[
                      styles.eventPoints,
                      ev.points > 0 && { color: colors.scorePositive },
                      ev.points < 0 && { color: colors.scoreNegative },
                    ]}>
                      {ev.points > 0 ? '+' : ''}{ev.points}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Prophecy Picks resolved this episode */}
        {prophecyResolutions.length > 0 && (
          <>
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>Prophecy Picks</Text>
            </View>
            {prophecyResolutions.map((res) => (
              <View key={res.questionId} style={styles.card}>
                <View style={styles.prophecyCard}>
                  <Text style={styles.prophecyText}>{res.text}</Text>
                  <View style={styles.prophecyMeta}>
                    <Text style={[styles.prophecyOutcome, res.outcome ? { color: colors.success } : { color: colors.error }]}>
                      {res.outcome ? 'YES' : 'NO'}
                    </Text>
                    <Text style={styles.prophecyPts}>{res.points}pt</Text>
                  </View>
                </View>
              </View>
            ))}
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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  tribeDot: { width: 8, height: 8, borderRadius: 4 },
  castawayName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  // Scoring category sections within each card
  scoringSection: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlass,
    paddingHorizontal: 14, paddingVertical: 8, gap: 4,
  },
  scoringSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 2,
  },
  scoringSectionLabel: {
    color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
  },
  scoringSectionTotal: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 2,
  },
  eventLabel: { color: colors.textSecondary, fontSize: 13 },
  eventPoints: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  // Prophecy section
  sectionDivider: {
    marginTop: 12, marginBottom: 2, paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderGlass,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  prophecyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  prophecyText: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  prophecyMeta: { alignItems: 'flex-end', gap: 2 },
  prophecyOutcome: { fontSize: 12, fontWeight: '800' },
  prophecyPts: { color: colors.textMuted, fontSize: 10 },
});
