import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useSeasonConfig } from '@/hooks/useSeasonConfig';
import { colors } from '@/theme/colors';
import type { PlayerScore } from '@/types';

const glassAvailable = isLiquidGlassAvailable();

function Glass({ style, children, tintColor }: { style?: any; children: React.ReactNode; tintColor?: string }) {
  if (glassAvailable) {
    return (
      <GlassView style={style} tintColor={tintColor} colorScheme="light">
        {children}
      </GlassView>
    );
  }
  return <View style={style}>{children}</View>;
}

const RANK_COLORS: Record<number, string> = {
  1: '#D4A017',
  2: '#8A8A8A',
  3: '#B87333',
};

type RankedEntry = PlayerScore & { rank: number; is_tied: boolean };

function LeaderboardRow({ entry, onPress }: { entry: RankedEntry; onPress?: () => void }) {
  const isTop3 = entry.rank <= 3;
  const rankColor = RANK_COLORS[entry.rank];

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.rankContainer, isTop3 && { backgroundColor: rankColor + '18' }]}>
        <Text style={[styles.rank, isTop3 && { color: rankColor }]}>
          {entry.rank}{entry.is_tied ? 'T' : ''}
        </Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, entry.rank === 1 && styles.playerNameFirst]}>
          {entry.display_name}
        </Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownText}>
            {entry.trio_points}<Text style={styles.breakdownLabel}> Trio</Text>
            {'   '}{entry.icky_points}<Text style={styles.breakdownLabel}> Icky</Text>
            {'   '}{entry.prophecy_points}<Text style={styles.breakdownLabel}> Proph</Text>
          </Text>
        </View>
      </View>
      <Text style={[styles.totalScore, isTop3 && { color: rankColor }]}>
        {entry.total_points}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function ListHeader({ config, insets }: { config: any; insets: any }) {
  return (
    <View style={{ paddingTop: insets.top + 8, backgroundColor: colors.background }}>
      <Text style={styles.screenTitle}>Leaderboard</Text>
      <Glass style={styles.episodeBanner} tintColor={colors.primary + '18'}>
        <Text style={styles.episodeLabel}>
          {config?.current_episode ? `Episode ${config.current_episode}` : 'Pre-Season'}
        </Text>
        {!config?.picks_revealed && (
          <Text style={styles.hiddenNote}>Picks hidden until reveal</Text>
        )}
      </Glass>
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { config, isLoading: configLoading } = useSeasonConfig();
  const { entries, isLoading } = useLeaderboard(config?.picks_revealed ?? false);
  const insets = useSafeAreaInsets();
  const picksRevealed = config?.picks_revealed ?? false;

  if (isLoading || configLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.player_id}
        ListHeaderComponent={<ListHeader config={config} insets={insets} />}
        renderItem={({ item }) => (
          <LeaderboardRow
            entry={item}
            onPress={picksRevealed ? () => router.push(`/player/${item.player_id}`) : undefined}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  screenTitle: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  episodeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  episodeLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  hiddenNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },
  list: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    gap: 12,
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rank: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  playerInfo: { flex: 1, gap: 2 },
  playerName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  playerNameFirst: { fontWeight: '800' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center' },
  breakdownText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  breakdownLabel: { color: colors.textMuted, fontWeight: '400' },
  totalScore: { color: colors.primary, fontSize: 20, fontWeight: '800', minWidth: 40, textAlign: 'right' },
  chevron: { color: colors.textMuted, fontSize: 20 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlass, marginLeft: 60 },
});
