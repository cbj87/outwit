import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useCastawaysByTribe } from '@/hooks/useCastaways';
import { useSeasonConfig } from '@/hooks/useSeasonConfig';
import { useMyPicks } from '@/hooks/useMyPicks';
import { PROPHECY_QUESTIONS } from '@/lib/constants';
import { picksSubmissionSchema } from '@/lib/validation';
import { colors, tribeColors } from '@/theme/colors';
import type { Tribe } from '@/types';

const STEPS = ['Trusted Trio', 'Icky Pick', 'Prophecy Picks'];

export default function SubmitPicksScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const { byTribe, isLoading: castawaysLoading } = useCastawaysByTribe();
  const { isPicksLocked } = useSeasonConfig();
  const { data: existingPicks } = useMyPicks();

  const [step, setStep] = useState(0);
  const [selectedTrio, setSelectedTrio] = useState<number[]>(
    existingPicks?.picks
      ? [existingPicks.picks.trio_castaway_1, existingPicks.picks.trio_castaway_2, existingPicks.picks.trio_castaway_3]
      : [],
  );
  const [selectedIcky, setSelectedIcky] = useState<number | null>(
    existingPicks?.picks?.icky_castaway ?? null,
  );
  const [prophecyAnswers, setProphecyAnswers] = useState<Record<number, boolean>>(
    Object.fromEntries(
      existingPicks?.prophecyAnswers.map((a) => [a.question_id, a.answer]) ?? [],
    ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isPicksLocked) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedText}>Picks are locked</Text>
        <Text style={styles.lockedSubtext}>The submission deadline has passed.</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (castawaysLoading || !byTribe) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  function toggleTrio(id: number) {
    setSelectedTrio((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function selectIcky(id: number) {
    setSelectedIcky((prev) => (prev === id ? null : id));
  }

  function canProceed(): boolean {
    if (step === 0) return selectedTrio.length === 3;
    if (step === 1) return selectedIcky !== null && !selectedTrio.includes(selectedIcky);
    if (step === 2) return Object.keys(prophecyAnswers).length === 16;
    return false;
  }

  async function handleSubmit() {
    if (!userId) return;

    const submission = {
      trio_castaway_1: selectedTrio[0],
      trio_castaway_2: selectedTrio[1],
      trio_castaway_3: selectedTrio[2],
      icky_castaway: selectedIcky!,
      prophecy_answers: prophecyAnswers,
    };

    const result = picksSubmissionSchema.safeParse(submission);
    if (!result.success) {
      Alert.alert('Invalid Picks', result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      // Upsert picks
      const { error: picksError } = await supabase.from('picks').upsert({
        player_id: userId,
        trio_castaway_1: submission.trio_castaway_1,
        trio_castaway_2: submission.trio_castaway_2,
        trio_castaway_3: submission.trio_castaway_3,
        icky_castaway: submission.icky_castaway,
      }, { onConflict: 'player_id' });

      if (picksError) throw picksError;

      // Upsert prophecy answers (delete+insert to handle edits cleanly)
      const answersToInsert = Object.entries(prophecyAnswers).map(([qId, answer]) => ({
        player_id: userId,
        question_id: parseInt(qId, 10),
        answer,
      }));

      const { error: answersError } = await supabase
        .from('prophecy_answers')
        .upsert(answersToInsert, { onConflict: 'player_id,question_id' });

      if (answersError) throw answersError;

      queryClient.invalidateQueries({ queryKey: ['my-picks'] });
      Alert.alert('Picks Submitted!', 'Your picks have been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to submit picks. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
              <Text style={[styles.stepDotText, i <= step && styles.stepDotTextActive]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Step content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {step === 0 && (
          <StepTrustedTrio
            byTribe={byTribe}
            selectedTrio={selectedTrio}
            selectedIcky={selectedIcky}
            onToggle={toggleTrio}
          />
        )}
        {step === 1 && (
          <StepIckyPick
            byTribe={byTribe}
            selectedTrio={selectedTrio}
            selectedIcky={selectedIcky}
            onSelect={selectIcky}
          />
        )}
        {step === 2 && (
          <StepProphecy
            answers={prophecyAnswers}
            onChange={(qId, val) => setProphecyAnswers((prev) => ({ ...prev, [qId]: val }))}
          />
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.disabled]}
            onPress={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextButton, (!canProceed() || isSubmitting) && styles.disabled]}
            onPress={handleSubmit}
            disabled={!canProceed() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.nextButtonText}>Submit Picks</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StepTrustedTrio({
  byTribe, selectedTrio, selectedIcky, onToggle,
}: {
  byTribe: Record<Tribe, any[]>;
  selectedTrio: number[];
  selectedIcky: number | null;
  onToggle: (id: number) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Pick Your Trusted Trio</Text>
      <Text style={styles.stepSubtitle}>Choose 3 castaways you want to do well. {selectedTrio.length}/3 selected.</Text>
      {(['VATU', 'CILA', 'KALO'] as Tribe[]).map((tribe) => (
        <TribeSection key={tribe} tribe={tribe} castaways={byTribe[tribe] ?? []}
          renderItem={(castaway) => {
            const selected = selectedTrio.includes(castaway.id);
            const maxed = selectedTrio.length >= 3 && !selected;
            return (
              <TouchableOpacity
                key={castaway.id}
                style={[styles.castCard, selected && styles.castCardSelected, maxed && styles.castCardDisabled]}
                onPress={() => !maxed && onToggle(castaway.id)}
                disabled={maxed}
                activeOpacity={0.7}
              >
                <Text style={[styles.castCardName, selected && styles.castCardNameSelected]}>{castaway.name}</Text>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          }}
        />
      ))}
    </View>
  );
}

function StepIckyPick({
  byTribe, selectedTrio, selectedIcky, onSelect,
}: {
  byTribe: Record<Tribe, any[]>;
  selectedTrio: number[];
  selectedIcky: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Pick Your Icky Pick</Text>
      <Text style={styles.stepSubtitle}>Choose 1 castaway you don't want to win.</Text>
      {(['VATU', 'CILA', 'KALO'] as Tribe[]).map((tribe) => (
        <TribeSection key={tribe} tribe={tribe} castaways={byTribe[tribe] ?? []}
          renderItem={(castaway) => {
            const isInTrio = selectedTrio.includes(castaway.id);
            const selected = selectedIcky === castaway.id;
            return (
              <TouchableOpacity
                key={castaway.id}
                style={[styles.castCard, selected && styles.castCardIcky, isInTrio && styles.castCardDisabled]}
                onPress={() => !isInTrio && onSelect(castaway.id)}
                disabled={isInTrio}
                activeOpacity={0.7}
              >
                <Text style={[styles.castCardName, (selected || isInTrio) && { opacity: 0.5 }]}>{castaway.name}</Text>
                {isInTrio && <Text style={styles.inTrioLabel}>Trio</Text>}
                {selected && <Text style={styles.checkmark}>✗</Text>}
              </TouchableOpacity>
            );
          }}
        />
      ))}
    </View>
  );
}

function StepProphecy({ answers, onChange }: { answers: Record<number, boolean>; onChange: (qId: number, val: boolean) => void }) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Prophecy Picks</Text>
      <Text style={styles.stepSubtitle}>Answer all 16 predictions. Correct = points, wrong = 0.</Text>
      {PROPHECY_QUESTIONS.map((q) => (
        <View key={q.id} style={styles.prophecyRow}>
          <View style={styles.prophecyLeft}>
            <Text style={styles.prophecyText}>{q.text}</Text>
            <Text style={styles.prophecyPoints}>{q.points} {q.points === 1 ? 'point' : 'points'}</Text>
          </View>
          <View style={styles.prophecyToggle}>
            <Text style={[styles.toggleLabel, answers[q.id] === false && styles.toggleLabelActive]}>NO</Text>
            <Switch
              value={answers[q.id] === true}
              onValueChange={(val) => onChange(q.id, val)}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
            <Text style={[styles.toggleLabel, answers[q.id] === true && styles.toggleLabelActive]}>YES</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TribeSection({ tribe, castaways, renderItem }: { tribe: Tribe; castaways: any[]; renderItem: (c: any) => React.ReactNode }) {
  return (
    <View style={styles.tribeSection}>
      <Text style={[styles.tribeSectionLabel, { color: tribeColors[tribe] }]}>{tribe}</Text>
      <View style={styles.tribeGrid}>
        {castaways.map((c) => renderItem(c))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
  lockedText: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  lockedSubtext: { color: colors.textSecondary, fontSize: 14 },
  closeButton: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  closeButtonText: { color: colors.textSecondary, fontSize: 15 },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: colors.surface, gap: 24 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { borderColor: colors.primary },
  stepDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDotText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  stepDotTextActive: { color: colors.textPrimary },
  stepLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  stepLabelActive: { color: colors.primary },
  content: { flex: 1 },
  contentInner: { paddingBottom: 16 },
  stepContent: { padding: 16, gap: 16 },
  stepTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  stepSubtitle: { color: colors.textSecondary, fontSize: 14 },
  tribeSection: { gap: 8 },
  tribeSectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  tribeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  castCard: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  castCardSelected: { borderColor: colors.success, backgroundColor: colors.success + '22' },
  castCardIcky: { borderColor: colors.error, backgroundColor: colors.error + '22' },
  castCardDisabled: { opacity: 0.4 },
  castCardName: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  castCardNameSelected: { fontWeight: '700' },
  checkmark: { fontSize: 14, color: colors.success },
  inTrioLabel: { fontSize: 10, color: colors.textMuted },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  backButton: { flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  backButtonText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  nextButton: { flex: 2, paddingVertical: 14, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center' },
  nextButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  prophecyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: 12, gap: 12 },
  prophecyLeft: { flex: 1, gap: 4 },
  prophecyText: { color: colors.textPrimary, fontSize: 13 },
  prophecyPoints: { color: colors.textMuted, fontSize: 11 },
  prophecyToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', width: 24, textAlign: 'center' },
  toggleLabelActive: { color: colors.textPrimary },
});
