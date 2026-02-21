import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { PROPHECY_QUESTIONS } from '@/lib/constants';
import { colors } from '@/theme/colors';
import type { ProphecyOutcome } from '@/types';

type OutcomeState = boolean | null;

function OutcomeBadge({ outcome }: { outcome: OutcomeState }) {
  if (outcome === true) {
    return (
      <View style={[styles.badge, styles.badgeYes]}>
        <Text style={[styles.badgeText, { color: colors.success }]}>YES</Text>
      </View>
    );
  }
  if (outcome === false) {
    return (
      <View style={[styles.badge, styles.badgeNo]}>
        <Text style={[styles.badgeText, { color: colors.error }]}>NO</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgePending]}>
      <Text style={styles.badgeText}>Pending</Text>
    </View>
  );
}

export default function ProphecyStatusScreen() {
  const [outcomes, setOutcomes] = useState<Record<number, OutcomeState>>({});
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {PROPHECY_QUESTIONS.map((q) => {
          const outcome = outcomes[q.id] ?? null;
          return (
            <View key={q.id} style={styles.questionRow}>
              <View style={styles.questionLeft}>
                <Text style={styles.questionText}>{q.text}</Text>
                <Text style={styles.questionPoints}>{q.points} {q.points === 1 ? 'pt' : 'pts'}</Text>
              </View>
              <OutcomeBadge outcome={outcome} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  questionRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 8, padding: 14, gap: 12,
  },
  questionLeft: { flex: 1, gap: 4 },
  questionText: { color: colors.textPrimary, fontSize: 13 },
  questionPoints: { color: colors.textMuted, fontSize: 11 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  badgePending: { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  badgeYes: { borderColor: colors.success + '60', backgroundColor: colors.success + '20' },
  badgeNo: { borderColor: colors.error + '60', backgroundColor: colors.error + '20' },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
});
