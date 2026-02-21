import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCastaways } from '@/hooks/useCastaways';
import { EVENT_LABELS, EVENT_SCORES, getSurvivalPoints } from '@/lib/constants';
import { colors, tribeColors } from '@/theme/colors';
import type { Castaway, EventType, Tribe } from '@/types';

export default function EpisodeRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const episodeId = Number(id);
  const { data: castaways, isLoading: castawaysLoading } = useCastaways();
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
          tribe: castaway?.tribe as Tribe | undefined,
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

  const epNum = episode.episode_number;
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
});
