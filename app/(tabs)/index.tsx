import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
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

function ScoreCell({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.scoreCell}>
      <Text style={styles.scoreCellValue}>{value}</Text>
      <Text style={styles.scoreCellLabel}>{label}</Text>
    </View>
  );
}

function LeaderboardRow({ entry, onPress }: { entry: PlayerScore & { rank: number; is_tied: boolean }; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rankContainer}>
        <Text style={[styles.rank, entry.rank === 1 && styles.rankFirst]}>
          {entry.rank}{entry.is_tied ? 'T' : ''}
        </Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{entry.display_name}</Text>
      </View>
      <ScoreCell value={entry.trio_points} label="Trio" />
      <ScoreCell value={entry.icky_points} label="Icky" />
      <ScoreCell value={entry.prophecy_points} label="Proph" />
      <View style={styles.totalContainer}>
        <Text style={styles.totalScore}>{entry.total_points}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function LeaderboardScreen() {
  const { config, isLoading: configLoading } = useSeasonConfig();
  const { entries, isLoading } = useLeaderboard(config?.picks_revealed ?? false);
  const insets = useSafeAreaInsets();

  if (isLoading || configLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Glass style={styles.headerInfo} tintColor={colors.primary + '18'}>
        <Text style={styles.episodeLabel}>
          {config?.current_episode ? `Episode ${config.current_episode}` : 'Pre-Season'}
        </Text>
        {!config?.picks_revealed && (
          <Text style={styles.hiddenNote}>Picks hidden until reveal</Text>
        )}
      </Glass>

      <Glass style={styles.columnHeaders}>
        <Text style={[styles.colHeader, { width: 36 }]}>#</Text>
        <Text style={[styles.colHeader, { flex: 1 }]}>Player</Text>
        <Text style={[styles.colHeader, styles.colRight]}>Trio</Text>
        <Text style={[styles.colHeader, styles.colRight]}>Icky</Text>
        <Text style={[styles.colHeader, styles.colRight]}>Proph</Text>
        <Text style={[styles.colHeader, styles.colRight, { width: 52 }]}>Total</Text>
      </Glass>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.player_id}
        renderItem={({ item }) => (
          <LeaderboardRow
            entry={item}
            onPress={() => {
              // TODO: open score breakdown modal
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderGlass,
    overflow: 'hidden',
  },
  episodeLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  hiddenNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderGlass,
    overflow: 'hidden',
  },
  colHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'right',
    width: 42,
  },
  colRight: { textAlign: 'right' },
  list: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  rankContainer: { width: 36 },
  rank: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  rankFirst: { color: colors.primary, fontSize: 16 },
  playerInfo: { flex: 1 },
  playerName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  scoreCell: { width: 42, alignItems: 'center' },
  scoreCellValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  scoreCellLabel: { color: colors.textMuted, fontSize: 9, letterSpacing: 0.3 },
  totalContainer: { width: 52, alignItems: 'center' },
  totalScore: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlass, marginHorizontal: 16 },
});
