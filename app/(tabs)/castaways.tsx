import { View, Text, StyleSheet, SectionList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useCastawaysByTribe } from '@/hooks/useCastaways';
import { colors, tribeColors } from '@/theme/colors';
import type { Tribe } from '@/types';

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

const TRIBE_LABELS: Record<Tribe, string> = { VATU: 'VATU', CILA: 'CILA', KALO: 'KALO' };
const TRIBES: Tribe[] = ['VATU', 'CILA', 'KALO'];

export default function CastawaysScreen() {
  const router = useRouter();
  const { byTribe, isLoading } = useCastawaysByTribe();
  const insets = useSafeAreaInsets();

  if (isLoading || !byTribe) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const sections = TRIBES.map((tribe) => ({
    tribe,
    data: byTribe[tribe] ?? [],
  }));

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.background }}>
        <Text style={styles.screenTitle}>Castaways</Text>
      </View>
      <SectionList
        style={styles.listContainer}
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => {
          const isFirst = section.tribe === 'VATU';
          return (
          <View style={[!isFirst && styles.tribeHeaderSpacing, styles.tribeHeaderWrapper]}>
          <Glass
            style={[styles.tribeHeader, { borderLeftColor: tribeColors[section.tribe] }]}
            tintColor={tribeColors[section.tribe] + '28'}
          >
            <Text style={[styles.tribeName, { color: tribeColors[section.tribe] }]}>
              {TRIBE_LABELS[section.tribe]}
            </Text>
            <Text style={styles.tribeCount}>
              {section.data.filter((c) => c.is_active).length} active
            </Text>
          </Glass>
          </View>
          );
        }}
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
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  screenTitle: { color: colors.textPrimary, fontSize: 34, fontWeight: '800' },
  listContainer: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: { paddingBottom: 32 },
  tribeHeaderWrapper: { backgroundColor: colors.background },
  tribeHeaderSpacing: { paddingTop: 16 },
  tribeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderLeftWidth: 3, overflow: 'hidden' },
  tribeName: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  tribeCount: { color: colors.textMuted, fontSize: 12 },
  castawayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface, gap: 12 },
  tribeDot: { width: 8, height: 8, borderRadius: 4 },
  castawayName: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500' },
  eliminated: { color: colors.textMuted, textDecorationLine: 'line-through' },
  eliminatedBadge: { backgroundColor: colors.surfaceGlass, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  eliminatedText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontSize: 20 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderGlass, marginLeft: 16 + 8 + 12 },
});
