import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { PROPHECY_QUESTIONS } from '@/lib/constants';
import { colors } from '@/theme/colors';
import type { ProphecyOutcome } from '@/types';

type OutcomeState = boolean | null;

export default function ProphecyScreen() {
  const [outcomes, setOutcomes] = useState<Record<number, OutcomeState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('prophecy_outcomes')
      .select('*')
      .then(({ data }) => {
        const map: Record<number, OutcomeState> = {};
        (data as ProphecyOutcome[] ?? []).forEach((o) => {
          map[o.question_id] = o.outcome;
        });
        setOutcomes(map);
        setIsLoading(false);
      });
  }, []);

  function cycleOutcome(questionId: number) {
    setOutcomes((prev) => {
      const current = prev[questionId];
      // Cycle: null → true → false → null
      const next = current === null ? true : current === true ? false : null;
      return { ...prev, [questionId]: next };
    });
  }

  async function handleSave() {
    setIsSaving(true);
    const updates = Object.entries(outcomes).map(([qId, outcome]) => ({
      question_id: parseInt(qId, 10),
      outcome,
      resolved_at: outcome !== null ? new Date().toISOString() : null,
    }));

    const { error } = await supabase
      .from('prophecy_outcomes')
      .upsert(updates, { onConflict: 'question_id' });

    setIsSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Saved', 'Prophecy outcomes updated.');
    }
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Prophecy Outcomes</Text>
        <Text style={styles.pageSubtitle}>Tap each question to toggle: Pending → Yes → No → Pending</Text>

        {PROPHECY_QUESTIONS.map((q) => {
          const outcome = outcomes[q.id];
          return (
            <TouchableOpacity
              key={q.id}
              style={styles.questionRow}
              onPress={() => cycleOutcome(q.id)}
              activeOpacity={0.7}
            >
              <View style={styles.questionLeft}>
                <Text style={styles.questionText}>{q.text}</Text>
                <Text style={styles.questionPoints}>{q.points} {q.points === 1 ? 'pt' : 'pts'}</Text>
              </View>
              <OutcomeBadge outcome={outcome} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.disabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Save Outcomes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OutcomeBadge({ outcome }: { outcome: OutcomeState }) {
  if (outcome === null) {
    return <View style={[styles.badge, styles.badgePending]}><Text style={styles.badgeText}>Pending</Text></View>;
  }
  if (outcome === true) {
    return <View style={[styles.badge, styles.badgeYes]}><Text style={[styles.badgeText, { color: colors.success }]}>YES ✓</Text></View>;
  }
  return <View style={[styles.badge, styles.badgeNo]}><Text style={[styles.badgeText, { color: colors.error }]}>NO ✗</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 16, gap: 8, paddingBottom: 100 },
  pageTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  questionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: 14, gap: 12 },
  questionLeft: { flex: 1, gap: 4 },
  questionText: { color: colors.textPrimary, fontSize: 13 },
  questionPoints: { color: colors.textMuted, fontSize: 11 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  badgePending: { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  badgeYes: { borderColor: colors.success + '60', backgroundColor: colors.success + '20' },
  badgeNo: { borderColor: colors.error + '60', backgroundColor: colors.error + '20' },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  saveButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  saveButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
