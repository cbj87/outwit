import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useSeasonConfig } from '@/hooks/useSeasonConfig';
import { useEpisodeSeenStatus } from '@/hooks/useEpisodeSeenStatus';
import { useAuthStore } from '@/store/authStore';
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

const AVATAR_COLORS = [
  '#C4402F', // torch red
  '#2E7D32', // forest green
  '#1565C0', // ocean blue
  '#F57F17', // warm amber
  '#7B1FA2', // purple
  '#00838F', // teal
  '#D84315', // deep orange
  '#4527A0', // deep purple
  '#00695C', // dark teal
  '#AD1457', // pink
  '#1B5E20', // dark green
  '#0D47A1', // dark blue
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type RankedEntry = PlayerScore & { rank: number; is_tied: boolean };

function LeaderboardRow({ entry, onPress }: { entry: RankedEntry; onPress?: () => void }) {
  const isTop3 = entry.rank <= 3;
  const rankColor = RANK_COLORS[entry.rank];
  const initials = (entry.display_name ?? '?')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.rankContainer, isTop3 && { backgroundColor: rankColor + '18' }]}>
        <Text style={[styles.rank, isTop3 && { color: rankColor }]}>
          {entry.rank}{entry.is_tied ? 'T' : ''}
        </Text>
      </View>
      {entry.avatar_url ? (
        <Image source={{ uri: entry.avatar_url }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: getAvatarColor(entry.display_name) }]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
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

function SpoilerBanner({
  currentEpisode,
  maxSeenEpisode,
  onMarkSeen,
  isMarking,
}: {
  currentEpisode: number;
  maxSeenEpisode: number;
  onMarkSeen: () => void;
  isMarking: boolean;
}) {
  const unseenCount = currentEpisode - maxSeenEpisode;

  return (
    <View style={styles.spoilerBanner}>
      <View style={styles.spoilerTextContainer}>
        <Text style={styles.spoilerTitle}>
          {unseenCount === 1
            ? `Episode ${currentEpisode} is available`
            : `${unseenCount} new episodes available`}
        </Text>
        <Text style={styles.spoilerSubtitle}>
          Showing scores thru Episode {maxSeenEpisode || 'Pre-Season'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.spoilerButton}
        onPress={onMarkSeen}
        disabled={isMarking}
        activeOpacity={0.7}
      >
        {isMarking ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.spoilerButtonText}>
            {unseenCount === 1 ? "I've seen it" : 'Catch up'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ListHeader({
  displayedEpisode,
  config,
  insets,
  router,
  groupName,
  spoilerBanner,
}: {
  displayedEpisode: number;
  config: any;
  insets: any;
  router: any;
  groupName?: string;
  spoilerBanner: React.ReactNode | null;
}) {
  const hasEpisodes = displayedEpisode >= 1;

  return (
    <View style={{ paddingTop: insets.top + 8, backgroundColor: colors.background }}>
      <Text style={styles.screenTitle}>Leaderboard</Text>
      {groupName && <Text style={styles.groupName}>{groupName}</Text>}
      {spoilerBanner}
      <Glass style={styles.episodeBanner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.episodeLabel}>
            {displayedEpisode ? `Standings Thru Episode ${displayedEpisode}` : 'Pre-Season'}
          </Text>
          {!config?.picks_revealed && (
            <Text style={styles.hiddenNote}>Picks hidden until reveal</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.bannerRight}
          activeOpacity={0.7}
          onPress={() => router.push('/players/gallery' as any)}
        >
          <Text style={styles.bannerLinkText}>Player Bios</Text>
          <Text style={styles.bannerChevron}>{'›'}</Text>
        </TouchableOpacity>
      </Glass>
      <View style={styles.quickLinks}>
        {hasEpisodes && (
          <TouchableOpacity
            style={styles.quickLinkPill}
            activeOpacity={0.7}
            onPress={() => router.push('/episodes/')}
          >
            <Text style={styles.quickLinkText}>Episode Recaps</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.quickLinkPill}
          activeOpacity={0.7}
          onPress={() => router.push('/prophecy/status')}
        >
          <Text style={styles.quickLinkText}>Prophecy Picks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLinkPill}
          activeOpacity={0.7}
          onPress={() => router.push('/scoring-rules')}
        >
          <Text style={styles.quickLinkText}>Scoring</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const activeGroup = useAuthStore((state) => state.activeGroup);
  const { config, isLoading: configLoading } = useSeasonConfig();
  const {
    maxSeenEpisode,
    isLoading: seenLoading,
    markAllSeenThrough,
  } = useEpisodeSeenStatus();
  const [isMarking, setIsMarking] = useState(false);

  const currentEpisode = config?.current_episode ?? 0;
  const picksRevealed = config?.picks_revealed ?? false;

  const { entries, isLoading, displayedEpisode, refetch } = useLeaderboard({
    picksRevealed,
    groupId: activeGroup?.id ?? null,
    currentEpisode,
    maxSeenEpisode,
    seenLoading,
  });

  const insets = useSafeAreaInsets();

  // Refetch when tab gains focus so profile changes (name, avatar) show immediately
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleMarkSeen = useCallback(async () => {
    setIsMarking(true);
    await markAllSeenThrough(currentEpisode);
    // Refetch will happen automatically via the useEffect dependency on maxSeenEpisode
    setIsMarking(false);
  }, [markAllSeenThrough, currentEpisode]);

  if (isLoading || configLoading || seenLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!activeGroup) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noGroupTitle}>No Group Selected</Text>
        <Text style={styles.noGroupSubtitle}>Join or create a group to see the leaderboard.</Text>
        <TouchableOpacity style={styles.noGroupButton} onPress={() => router.push('/groups/join' as any)}>
          <Text style={styles.noGroupButtonText}>Join a Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.noGroupButton, styles.noGroupButtonSecondary]} onPress={() => router.push('/groups/create' as any)}>
          <Text style={styles.noGroupButtonSecondaryText}>Create a Group</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show spoiler banner when user hasn't seen the latest episode(s)
  // Only show when maxSeenEpisode > 0 (user has engaged with the feature)
  // and they're behind the current episode.
  const hasUnseenEpisodes = maxSeenEpisode > 0 && maxSeenEpisode < currentEpisode;

  const spoilerBanner = hasUnseenEpisodes ? (
    <SpoilerBanner
      currentEpisode={currentEpisode}
      maxSeenEpisode={maxSeenEpisode}
      onMarkSeen={handleMarkSeen}
      isMarking={isMarking}
    />
  ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.player_id}
        ListHeaderComponent={
          <ListHeader
            displayedEpisode={displayedEpisode}
            config={config}
            insets={insets}
            router={router}
            groupName={activeGroup?.name}
            spoilerBanner={spoilerBanner}
          />
        }
        renderItem={({ item }) => (
          <LeaderboardRow
            entry={item}
            onPress={picksRevealed ? () => router.push(`/player/${item.player_id}`) : undefined}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
  noGroupTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  noGroupSubtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  noGroupButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, marginTop: 4 },
  noGroupButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  noGroupButtonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  noGroupButtonSecondaryText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
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
  groupName: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 8 },
  bannerLeft: { flex: 1, gap: 2 },
  bannerRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, flex: 1 },
  bannerLinkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  bannerChevron: { color: colors.primary, fontSize: 18, fontWeight: '600' },
  episodeLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  hiddenNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },
  quickLinks: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  quickLinkPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickLinkText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Spoiler banner
  spoilerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.warning + '18',
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  spoilerTextContainer: { flex: 1, gap: 2, marginRight: 12 },
  spoilerTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  spoilerSubtitle: { color: colors.textSecondary, fontSize: 12 },
  spoilerButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  spoilerButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 13, fontWeight: '700' },
  playerInfo: { flex: 1, gap: 2 },
  playerName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  playerNameFirst: { fontWeight: '800' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center' },
  breakdownText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  breakdownLabel: { color: colors.textMuted, fontWeight: '400' },
  totalScore: { color: colors.primary, fontSize: 20, fontWeight: '800', minWidth: 40, textAlign: 'right' },
  chevron: { color: colors.textMuted, fontSize: 20 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlass, marginLeft: 104 },
});
