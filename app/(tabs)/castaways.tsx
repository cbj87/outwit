import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useCastawaysByTribe } from '@/hooks/useCastaways';
import { colors, tribeColors } from '@/theme/colors';
import type { Castaway, Tribe } from '@/types';

const TRIBE_LABELS: Record<Tribe, string> = {
  VATU: 'VATU',
  CILA: 'CILA',
  KALO: 'KALO',
};

export default function CastawaysScreen() {
  const router = useRouter();
  const { byTribe, isLoading } = useCastawaysByTribe();

  if (isLoading || !byTribe) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const sections = (['VATU', 'CILA', 'KALO'] as Tribe[]).map((tribe) => ({
    tribe,
    data: byTribe[tribe] ?? [],
  }));

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      renderSectionHeader={({ section }) => (
        <View style={[styles.tribeHeader, { borderLeftColor: tribeColors[section.tribe] }]}>
          <Text style={[styles.tribeName, { color: tribeColors[section.tribe] }]}>
            {TRIBE_LABELS[section.tribe]}
          </Text>
          <Text style={styles.tribeCount}>
            {section.data.filter((c) => c.is_active).length} active
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.castawayRow}
          onPress={() => router.push(`/castaways/${item.id}`)}
          activeOpacity={0.7}
        >
          <View style={[styles.tribeDot, { backgroundColor: tribeColors[item.tribe] }]} />
          <Text style={[styles.castawayName, !item.is_active && styles.eliminated]}>
            {item.name}
          </Text>
          {!item.is_active && (
            <View style={styles.eliminatedBadge}>
              <Text style={styles.eliminatedText}>
                {item.boot_order ? `Ep ${item.boot_order}` : 'OUT'}
              </Text>
            </View>
          )}
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { paddingBottom: 32 },
  tribeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderLeftWidth: 3, marginTop: 16, backgroundColor: colors.surface },
  tribeName: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  tribeCount: { color: colors.textMuted, fontSize: 12 },
  castawayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.background, gap: 12 },
  tribeDot: { width: 8, height: 8, borderRadius: 4 },
  castawayName: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500' },
  eliminated: { color: colors.textMuted, textDecorationLine: 'line-through' },
  eliminatedBadge: { backgroundColor: colors.surfaceElevated, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  eliminatedText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontSize: 20 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 16 + 8 + 12 },
});
