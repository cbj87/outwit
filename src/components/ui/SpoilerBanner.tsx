import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '@/theme/colors';

interface SpoilerBannerProps {
  currentEpisode: number;
  maxSeenEpisode: number;
  onMarkSeen: () => void;
  isMarking: boolean;
}

export function SpoilerBanner({
  currentEpisode,
  maxSeenEpisode,
  onMarkSeen,
  isMarking,
}: SpoilerBannerProps) {
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

const styles = StyleSheet.create({
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
});
