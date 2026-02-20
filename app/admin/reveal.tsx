import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSeasonConfig } from '@/hooks/useSeasonConfig';
import { colors } from '@/theme/colors';

export default function RevealScreen() {
  const { config, isLoading } = useSeasonConfig();
  const [isSaving, setIsSaving] = useState(false);

  async function handleReveal() {
    Alert.alert(
      'Reveal Picks?',
      'This will show everyone\'s picks (Trusted Trio, Icky Pick, and Prophecy answers) to all players. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reveal Now',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            const { error } = await supabase
              .from('season_config')
              .update({ picks_revealed: true })
              .eq('id', 1);
            setIsSaving(false);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('Picks Revealed', 'All players can now see everyone\'s picks.');
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const isRevealed = config?.picks_revealed ?? false;

  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Current Status</Text>
        <View style={[styles.statusBadge, isRevealed ? styles.statusRevealed : styles.statusHidden]}>
          <Text style={styles.statusText}>{isRevealed ? '🎭 Picks Revealed' : '🔒 Picks Hidden'}</Text>
        </View>
        <Text style={styles.statusDescription}>
          {isRevealed
            ? 'All players can see everyone\'s Trusted Trio, Icky Pick, and Prophecy answers.'
            : 'Picks are currently hidden. Players can only see their own picks.'}
        </Text>
      </View>

      {!isRevealed && (
        <View style={styles.revealSection}>
          <Text style={styles.warningTitle}>Ready to reveal?</Text>
          <Text style={styles.warningText}>
            Make sure all 12 players have submitted their picks before revealing.
            Once revealed, picks cannot be hidden again.
          </Text>
          <TouchableOpacity
            style={[styles.revealButton, isSaving && styles.disabled]}
            onPress={handleReveal}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.revealButtonText}>Reveal All Picks</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  statusCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, gap: 12, alignItems: 'center' },
  statusLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  statusBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  statusRevealed: { backgroundColor: colors.success + '22' },
  statusHidden: { backgroundColor: colors.surfaceElevated },
  statusText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  statusDescription: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  revealSection: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.primary + '40' },
  warningTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  warningText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  revealButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  revealButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
