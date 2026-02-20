import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { EVENT_LABELS, EVENT_SCORES, getSurvivalPoints } from '@/lib/constants';
import { colors, tribeColors } from '@/theme/colors';
import type { Castaway, CastawayEvent } from '@/types';

export default function CastawayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['castaway', id],
    queryFn: async () => {
      const [castawayResult, eventsResult] = await Promise.all([
        supabase.from('castaways').select('*').eq('id', id).single(),
        supabase
          .from('castaway_events')
          .select('*, episodes(episode_number)')
          .eq('castaway_id', id)
          .order('episodes(episode_number)', { ascending: true }),
      ]);
      return {
        castaway: castawayResult.data as Castaway,
        events: eventsResult.data as (CastawayEvent & { episodes: { episode_number: number } })[],
      };
    },
  });

  if (isLoading || !data) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const { castaway, events } = data;
  const tribeColor = tribeColors[castaway.tribe];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tribeColor }]}>
        <View style={[styles.tribeBadge, { backgroundColor: tribeColor }]}>
          <Text style={styles.tribeBadgeText}>{castaway.tribe}</Text>
        </View>
        <Text style={styles.name}>{castaway.name}</Text>
        <Text style={[styles.status, !castaway.is_active && styles.statusEliminated]}>
          {castaway.is_active ? 'Active' : castaway.final_placement ? castaway.final_placement.replace('_', ' ').toUpperCase() : 'Eliminated'}
        </Text>
        {castaway.boot_order && (
          <Text style={styles.bootOrder}>Eliminated: Episode {castaway.boot_order}</Text>
        )}
      </View>

      {/* Event log */}
      <Text style={styles.sectionTitle}>Event History</Text>
      {events.length === 0 ? (
        <Text style={styles.noEvents}>No events logged yet.</Text>
      ) : (
        events.map((event) => {
          const pts = event.event_type === 'survived_episode'
            ? getSurvivalPoints(event.episodes?.episode_number ?? 0)
            : EVENT_SCORES[event.event_type];
          return (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventEpisode}>Ep {event.episodes?.episode_number ?? '?'}</Text>
              <Text style={styles.eventLabel}>{EVENT_LABELS[event.event_type] ?? event.event_type}</Text>
              <Text style={[styles.eventPoints, pts < 0 && styles.negative, pts > 0 && styles.positive]}>
                {pts > 0 ? `+${pts}` : pts}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { padding: 24, alignItems: 'center', borderBottomWidth: 2, marginBottom: 16 },
  tribeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, marginBottom: 8 },
  tribeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  name: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  status: { color: colors.success, fontSize: 14, fontWeight: '600' },
  statusEliminated: { color: colors.error },
  bootOrder: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8 },
  noEvents: { color: colors.textMuted, paddingHorizontal: 16, fontStyle: 'italic' },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 2, borderRadius: 8, gap: 10 },
  eventEpisode: { color: colors.textMuted, fontSize: 12, fontWeight: '600', width: 40 },
  eventLabel: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  eventPoints: { fontSize: 14, fontWeight: '700' },
  positive: { color: colors.scorePositive },
  negative: { color: colors.scoreNegative },
});
