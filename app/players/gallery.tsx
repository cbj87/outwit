import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useBioQuestions } from '@/hooks/useBioQuestions';
import { colors } from '@/theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 12;
const GRID_PADDING = 16;
const CELL_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const AVATAR_SIZE = CELL_SIZE - 16;

const AVATAR_COLORS = [
  '#C4402F', '#2E7D32', '#1565C0', '#F57F17', '#7B1FA2', '#00838F',
  '#D84315', '#4527A0', '#00695C', '#AD1457', '#1B5E20', '#0D47A1',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface PlayerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  survivor_bio: Record<string, string> | null;
}

export default function PlayerGalleryScreen() {
  const insets = useSafeAreaInsets();
  const activeGroup = useAuthStore((state) => state.activeGroup);
  const { questions: bioQuestions } = useBioQuestions();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { data: players = [] } = useQuery({
    queryKey: ['player-gallery', activeGroup?.id],
    queryFn: async () => {
      if (!activeGroup?.id) return [];

      const [membersResult, profilesResult] = await Promise.all([
        supabase.from('group_members').select('user_id').eq('group_id', activeGroup.id),
        supabase.from('profiles').select('id, display_name, avatar_url, survivor_bio'),
      ]);

      if (membersResult.error || profilesResult.error) return [];

      const memberIds = new Set((membersResult.data ?? []).map((m: any) => m.user_id));
      return (profilesResult.data as PlayerProfile[])
        .filter((p) => memberIds.has(p.id))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
    },
    enabled: !!activeGroup?.id,
  });

  const renderGridItem = useCallback(({ item, index }: { item: PlayerProfile; index: number }) => {
    const initials = item.display_name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <TouchableOpacity
        style={styles.cell}
        activeOpacity={0.7}
        onPress={() => setViewerIndex(index)}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.gridAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.gridAvatar, styles.gridAvatarPlaceholder, { backgroundColor: getAvatarColor(item.display_name) }]}>
            <Text style={styles.gridInitials}>{initials}</Text>
          </View>
        )}
        <Text style={styles.gridName} numberOfLines={1}>{item.display_name}</Text>
      </TouchableOpacity>
    );
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={renderGridItem}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 40 }]}
      />

      {viewerIndex !== null && (
        <FullScreenViewer
          players={players}
          bioQuestions={bioQuestions}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </View>
  );
}

function FullScreenViewer({
  players,
  bioQuestions,
  initialIndex,
  onClose,
}: {
  players: PlayerProfile[];
  bioQuestions: { key: string; label: string }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const renderViewerItem = useCallback(({ item }: { item: PlayerProfile }) => {
    const initials = item.display_name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const viewerAvatarSize = SCREEN_WIDTH * 0.55;
    const bio = item.survivor_bio ?? {};
    const answeredQuestions = bioQuestions.filter((q) => bio[q.key]?.trim());

    return (
      <View style={{ width: SCREEN_WIDTH }}>
        <ScrollView
          contentContainerStyle={styles.viewerPageContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          {item.avatar_url ? (
            <Image
              source={{ uri: item.avatar_url }}
              style={[styles.viewerAvatar, { width: viewerAvatarSize, height: viewerAvatarSize, borderRadius: viewerAvatarSize / 2 }]}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.viewerAvatar,
                styles.viewerAvatarPlaceholder,
                { width: viewerAvatarSize, height: viewerAvatarSize, borderRadius: viewerAvatarSize / 2, backgroundColor: getAvatarColor(item.display_name) },
              ]}
            >
              <Text style={[styles.viewerInitials, { fontSize: viewerAvatarSize * 0.35 }]}>{initials}</Text>
            </View>
          )}

          {/* Name */}
          <Text style={styles.viewerName}>{item.display_name}</Text>

          {/* Bio Q&A */}
          {answeredQuestions.length > 0 && (
            <View style={styles.bioSection}>
              {answeredQuestions.map((q) => (
                <View key={q.key} style={styles.bioItem}>
                  <Text style={styles.bioLabel}>{q.label}</Text>
                  <Text style={styles.bioAnswer}>{bio[q.key]}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }, []);

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <View style={styles.viewerOverlay}>
        {/* Header */}
        <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.viewerCounter}>
            {currentIndex + 1} of {players.length}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.viewerClose} activeOpacity={0.7}>
            <Text style={styles.viewerCloseText}>{'✕'}</Text>
          </TouchableOpacity>
        </View>

        {/* Swipeable pages */}
        <FlatList
          data={players}
          keyExtractor={(item) => item.id}
          renderItem={renderViewerItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Grid
  gridContent: { padding: GRID_PADDING },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  cell: {
    width: CELL_SIZE,
    alignItems: 'center',
    gap: 6,
  },
  gridAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  gridAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridInitials: { color: '#fff', fontSize: AVATAR_SIZE * 0.35, fontWeight: '800' },
  gridName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    width: CELL_SIZE,
  },

  // Full-screen viewer
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  viewerCounter: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  viewerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  viewerPageContent: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
    gap: 12,
  },
  viewerAvatar: {},
  viewerAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerInitials: { color: '#fff', fontWeight: '800' },
  viewerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },

  // Bio Q&A in viewer
  bioSection: {
    width: '100%',
    gap: 16,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 20,
  },
  bioItem: {
    gap: 4,
  },
  bioLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bioAnswer: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
});
