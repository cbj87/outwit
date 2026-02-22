import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { EVENT_LABELS, EVENT_SCORES, ICKY_PICK_SCORES, getSurvivalPoints } from '@/lib/constants';
import { useTribeColors } from '@/hooks/useTribeColors';
import { colors } from '@/theme/colors';
import { useAllPicks } from '@/hooks/useAllPicks';
import type { PlayerPick } from '@/hooks/useAllPicks';
import type { Castaway, CastawayEvent } from '@/types';

const PLACEMENT_LABELS: Record<string, string> = {
  first_boot: 'First Boot',
  pre_merge: 'Pre-Merge',
  jury: 'Jury Member',
  '3rd': '3rd Place',
  runner_up: 'Runner-Up',
  winner: 'Sole Survivor',
};

const PICKER_AVATAR_SIZE = 32;
const PICKER_BORDER = 2;

function PickerRow({ player, type }: { player: PlayerPick; type: 'trio' | 'icky' }) {
  const ringColor = type === 'trio' ? colors.success : colors.error;
  const label = type === 'trio' ? 'Trusted Trio' : 'Icky Pick';
  const initials = player.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.pickerRow}>
      <View style={[styles.pickerAvatarOuter, { borderColor: ringColor }]}>
        {player.avatar_url ? (
          <Image source={{ uri: player.avatar_url }} style={styles.pickerAvatarImage} contentFit="cover" />
        ) : (
          <View style={[styles.pickerAvatarImage, styles.pickerAvatarPlaceholder]}>
            <Text style={styles.pickerInitials}>{initials}</Text>
          </View>
        )}
      </View>
      <Text style={styles.pickerName}>{player.display_name}</Text>
      <View style={[styles.pickTypeBadge, { backgroundColor: type === 'trio' ? '#E8F5E9' : '#FFEBEE' }]}>
        <Text style={[styles.pickTypeText, { color: ringColor }]}>{label}</Text>
      </View>
    </View>
  );
}

export default function CastawayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tribeColors = useTribeColors();

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

  const { castawayPickMap, revealed } = useAllPicks();

  if (isLoading || !data) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const { castaway, events } = data;
  const tribeColor = tribeColors[castaway.original_tribe] ?? colors.textMuted;
  const pickData = castawayPickMap?.get(Number(id));

  // Compute Trusted Trio total (events + survival)
  const trioTotal = events.reduce((sum, event) => {
    if (event.event_type === 'survived_episode') {
      return sum + getSurvivalPoints(event.episodes?.episode_number ?? 0);
    }
    return sum + (EVENT_SCORES[event.event_type] ?? 0);
  }, 0);

  // Compute Icky Pick total (placement only)
  const ickyTotal = castaway.final_placement
    ? (ICKY_PICK_SCORES[castaway.final_placement] ?? 0)
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tribeColor }]}>
        <View style={[styles.tribeBadge, { backgroundColor: tribeColors[castaway.current_tribe] ?? tribeColor }]}>
          <Text style={styles.tribeBadgeText}>{castaway.current_tribe}</Text>
        </View>
        <Text style={styles.name}>{castaway.name}</Text>
        <Text style={[styles.status, !castaway.is_active && styles.statusEliminated]}>
          {castaway.is_active ? 'Active' : castaway.final_placement ? castaway.final_placement.replace('_', ' ').toUpperCase() : 'Eliminated'}
        </Text>
        {castaway.boot_order && (
          <Text style={styles.bootOrder}>Eliminated: Episode {castaway.boot_order}</Text>
        )}
      </View>

      {/* Picked By */}
      {revealed && pickData && (pickData.trio.length > 0 || pickData.icky.length > 0) && (
        <>
          <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginBottom: 8 }]}>Picked By</Text>
          <View style={styles.pickedByContainer}>
            {pickData.trio.map((player) => (
              <PickerRow key={`trio-${player.player_id}`} player={player} type="trio" />
            ))}
            {pickData.icky.map((player) => (
              <PickerRow key={`icky-${player.player_id}`} player={player} type="icky" />
            ))}
          </View>
        </>
      )}

      {/* Trusted Trio Score */}
      <View style={styles.scoringSectionHeader}>
        <Text style={styles.sectionTitle}>Trusted Trio Score</Text>
        <Text style={[styles.scoringSectionTotal, trioTotal > 0 && styles.positive, trioTotal < 0 && styles.negative]}>
          {trioTotal > 0 ? `+${trioTotal}` : trioTotal} pts
        </Text>
      </View>
      <View style={styles.scoringCard}>
        <Text style={styles.scoringCardSubtitle}>
          Points earned from events + survival if this castaway is in your Trusted Trio.
        </Text>
        {events.length === 0 ? (
          <Text style={styles.noEventsInline}>No events logged yet.</Text>
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
      </View>

      {/* Icky Pick Score */}
      <View style={styles.scoringSectionHeader}>
        <Text style={styles.sectionTitle}>Icky Pick Score</Text>
        <Text style={[styles.scoringSectionTotal, ickyTotal > 0 && styles.positive, ickyTotal < 0 && styles.negative]}>
          {ickyTotal > 0 ? `+${ickyTotal}` : ickyTotal} pts
        </Text>
      </View>
      <View style={styles.scoringCard}>
        <Text style={styles.scoringCardSubtitle}>
          Points based on final placement only — no event or survival points apply.
        </Text>
        {castaway.final_placement ? (
          <View style={styles.ickyResultRow}>
            <Text style={styles.ickyPlacementLabel}>
              {PLACEMENT_LABELS[castaway.final_placement] ?? castaway.final_placement}
            </Text>
            <Text style={[
              styles.ickyPlacementPoints,
              ickyTotal > 0 && styles.positive,
              ickyTotal < 0 && styles.negative,
            ]}>
              {ickyTotal > 0 ? `+${ickyTotal}` : ickyTotal}
            </Text>
          </View>
        ) : (
          <Text style={styles.noEventsInline}>
            {castaway.is_active ? 'Still active — no Icky points awarded yet.' : 'Placement not set.'}
          </Text>
        )}
      </View>
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
  sectionTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  scoringSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  scoringSectionTotal: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  scoringCard: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 4, gap: 2 },
  scoringCardSubtitle: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  noEventsInline: { color: colors.textMuted, fontStyle: 'italic', paddingVertical: 4 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  eventEpisode: { color: colors.textMuted, fontSize: 12, fontWeight: '600', width: 40 },
  eventLabel: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  eventPoints: { fontSize: 14, fontWeight: '700' },
  positive: { color: colors.scorePositive },
  negative: { color: colors.scoreNegative },
  ickyResultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  ickyPlacementLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  ickyPlacementPoints: { fontSize: 18, fontWeight: '800' },
  pickedByContainer: { marginHorizontal: 16, marginBottom: 16, gap: 2 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 10,
  },
  pickerAvatarOuter: {
    width: PICKER_AVATAR_SIZE + PICKER_BORDER * 2,
    height: PICKER_AVATAR_SIZE + PICKER_BORDER * 2,
    borderRadius: (PICKER_AVATAR_SIZE + PICKER_BORDER * 2) / 2,
    borderWidth: PICKER_BORDER,
    backgroundColor: colors.surface,
  },
  pickerAvatarImage: {
    width: PICKER_AVATAR_SIZE,
    height: PICKER_AVATAR_SIZE,
    borderRadius: PICKER_AVATAR_SIZE / 2,
  },
  pickerAvatarPlaceholder: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerInitials: { color: '#fff', fontSize: 12, fontWeight: '800' },
  pickerName: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  pickTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  pickTypeText: { fontSize: 11, fontWeight: '700' },
});
