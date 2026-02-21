import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useIsCommissioner } from '@/hooks/useIsCommissioner';
import { useAuth } from '@/hooks/useAuth';
import { useSeasonConfig } from '@/hooks/useSeasonConfig';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

const glassAvailable = isLiquidGlassAvailable();

function Glass({ style, children, tintColor, isInteractive }: { style?: any; children: React.ReactNode; tintColor?: string; isInteractive?: boolean }) {
  if (glassAvailable) {
    return (
      <GlassView style={style} tintColor={tintColor} isInteractive={isInteractive} colorScheme="light">
        {children}
      </GlassView>
    );
  }
  return <View style={style}>{children}</View>;
}

interface AdminCard {
  title: string;
  description: string;
  route: string;
  emoji: string;
}

const ADMIN_CARDS: AdminCard[] = [
  { title: 'Log Episode', description: 'Record castaway events and finalize episode scores', route: '/admin/episode', emoji: '📺' },
  { title: 'Prophecy Outcomes', description: 'Set true/false outcomes for the 16 season predictions', route: '/admin/prophecy', emoji: '🔮' },
];

export default function AdminScreen() {
  const isCommissioner = useIsCommissioner();
  const { signOut } = useAuth();
  const { config, refetch } = useSeasonConfig();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  if (!isCommissioner) return null;

  const isRevealed = config?.picks_revealed ?? false;

  function handleRevealToggle() {
    const newValue = !isRevealed;
    Alert.alert(
      newValue ? 'Reveal Picks?' : 'Hide Picks?',
      newValue
        ? 'This will show everyone\'s picks to all players.'
        : 'This will hide everyone\'s picks again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newValue ? 'Reveal Now' : 'Hide',
          style: newValue ? 'destructive' : 'default',
          onPress: async () => {
            setIsSaving(true);
            const { error } = await supabase
              .from('season_config')
              .update({ picks_revealed: newValue })
              .eq('id', 1);
            setIsSaving(false);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              refetch();
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commissioner Panel</Text>
        <Text style={styles.headerSubtitle}>Outwit Open — Season 50</Text>
      </View>

      {ADMIN_CARDS.map((card) => (
        <TouchableOpacity key={card.route} onPress={() => router.push(card.route as any)} activeOpacity={0.75}>
          <Glass style={styles.card} isInteractive>
            <Text style={styles.cardEmoji}>{card.emoji}</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDescription}>{card.description}</Text>
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </Glass>
        </TouchableOpacity>
      ))}

      <Glass style={styles.revealRow}>
        <View style={styles.revealInfo}>
          <Text style={styles.revealTitle}>Reveal Picks</Text>
          <Text style={styles.revealDescription}>
            {isRevealed ? 'All players can see everyone\'s picks' : 'Picks are hidden from other players'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.revealButton, isRevealed && styles.revealButtonActive]}
          onPress={handleRevealToggle}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          <Text style={[styles.revealButtonText, isRevealed && styles.revealButtonTextActive]}>
            {isRevealed ? 'Revealed' : 'Hidden'}
          </Text>
        </TouchableOpacity>
      </Glass>

      <TouchableOpacity
        style={[styles.recalcButton, isRecalculating && styles.recalcButtonDisabled]}
        onPress={async () => {
          setIsRecalculating(true);
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.session) throw new Error('Session expired — please sign in again.');
            const accessToken = refreshData.session.access_token;
            const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calculate-scores`;
            const res = await fetch(fnUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              },
              body: JSON.stringify({ episode_id: null }),
            });
            if (!res.ok) {
              const text = await res.text();
              throw new Error(`${res.status}: ${text}`);
            }
            Alert.alert('Done', 'All scores have been recalculated.');
          } catch (e: any) {
            Alert.alert('Error', e.message ?? 'Failed to recalculate scores.');
          } finally {
            setIsRecalculating(false);
          }
        }}
        disabled={isRecalculating}
        activeOpacity={0.7}
      >
        <Text style={styles.recalcButtonText}>
          {isRecalculating ? 'Recalculating…' : 'Recalculate Scores'}
        </Text>
      </TouchableOpacity>

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
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, gap: 14, overflow: 'hidden' },
  cardEmoji: { fontSize: 28 },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  cardDescription: { color: colors.textSecondary, fontSize: 13 },
  cardChevron: { color: colors.textMuted, fontSize: 22 },
  revealRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, gap: 14, overflow: 'hidden' },
  revealInfo: { flex: 1, gap: 4 },
  revealTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  revealDescription: { color: colors.textSecondary, fontSize: 13 },
  revealButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.border },
  revealButtonActive: { backgroundColor: colors.success + '22' },
  revealButtonText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  revealButtonTextActive: { color: colors.success },
  recalcButton: { marginTop: 16, paddingVertical: 14, backgroundColor: colors.primary + '15', borderRadius: 12, alignItems: 'center' },
  recalcButtonDisabled: { opacity: 0.5 },
  recalcButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  signOutButton: { marginTop: 12, paddingVertical: 14, borderWidth: 1, borderColor: colors.borderGlass, borderRadius: 12, alignItems: 'center' },
  signOutText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
