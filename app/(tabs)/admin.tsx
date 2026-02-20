import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsCommissioner } from '@/hooks/useIsCommissioner';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

interface AdminCard {
  title: string;
  description: string;
  route: string;
  emoji: string;
}

const ADMIN_CARDS: AdminCard[] = [
  {
    title: 'Log Episode',
    description: 'Record castaway events and finalize episode scores',
    route: '/admin/episode',
    emoji: '📺',
  },
  {
    title: 'Prophecy Outcomes',
    description: 'Set true/false outcomes for the 16 season predictions',
    route: '/admin/prophecy',
    emoji: '🔮',
  },
  {
    title: 'Reveal Picks',
    description: 'Reveal all players\' picks to the group',
    route: '/admin/reveal',
    emoji: '🎭',
  },
];

export default function AdminScreen() {
  const isCommissioner = useIsCommissioner();
  const { signOut } = useAuth();
  const router = useRouter();

  // Safety guard — tab should not be accessible for non-commissioners
  if (!isCommissioner) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commissioner Panel</Text>
        <Text style={styles.headerSubtitle}>Outwit Open — Season 50</Text>
      </View>

      {ADMIN_CARDS.map((card) => (
        <TouchableOpacity
          key={card.route}
          style={styles.card}
          onPress={() => router.push(card.route as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.cardEmoji}>{card.emoji}</Text>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDescription}>{card.description}</Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  header: { paddingVertical: 16, marginBottom: 8 },
  headerTitle: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  headerSubtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 14 },
  cardEmoji: { fontSize: 28 },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  cardDescription: { color: colors.textSecondary, fontSize: 13 },
  cardChevron: { color: colors.textMuted, fontSize: 22 },
  signOutButton: { marginTop: 24, paddingVertical: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center' },
  signOutText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
