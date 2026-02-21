import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

export default function EpisodeListScreen() {
  const router = useRouter();

  const { data: episodes, isLoading } = useQuery({
    queryKey: ['episodes-finalized'],
    queryFn: async () => {
      const { data } = await supabase
        .from('episodes')
        .select('id, episode_number, is_finalized, is_merge, is_finale')
        .eq('is_finalized', true)
        .order('episode_number', { ascending: true });
      return data ?? [];
    },
  });

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (!episodes || episodes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No episodes have been finalized yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {episodes.map((ep) => (
          <TouchableOpacity
            key={ep.id}
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => router.push(`/episodes/${ep.id}`)}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.episodeNumber}>Episode {ep.episode_number}</Text>
              <View style={styles.badges}>
                {ep.is_merge && (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>Merge</Text>
                  </View>
                )}
                {ep.is_finale && (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>Finale</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  episodeNumber: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 6 },
  tagBadge: {
    backgroundColor: colors.primary + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  tagBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontSize: 16 },
});
