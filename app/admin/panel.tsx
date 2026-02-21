import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useIsCommissioner } from '@/hooks/useIsCommissioner';
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
  { title: 'Manage Tribes', description: 'Update tribe assignments after swaps, splits, or merges', route: '/admin/tribes', emoji: '🏝️' },
];

export default function CommissionerPanelScreen() {
  const isCommissioner = useIsCommissioner();
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
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
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
            // Force a fresh token — getSession() returns cached/potentially expired JWTs
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.session) throw new Error('Session expired — please sign in again.');
            const accessToken = refreshData.session.access_token;

            const res = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calculate-scores`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ episode_id: null }),
              },
            );
            const text = await res.text();
            if (!res.ok) throw new Error(`${res.status}: ${text}`);
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
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
});
