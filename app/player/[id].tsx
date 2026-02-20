import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCastawayMap } from '@/hooks/useCastaways';
import { PROPHECY_QUESTIONS } from '@/lib/constants';
import { colors, tribeColors } from '@/theme/colors';
import type { Picks, ProphecyAnswer, ScoreCache, ScoreCacheTrioDetail, Profile, Tribe } from '@/types';

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const castawayMap = useCastawayMap();

  const { data, isLoading } = useQuery({
    queryKey: ['player-picks', id],
    queryFn: async () => {
      const [profileResult, picksResult, answersResult, cacheResult, trioDetailResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('picks').select('*').eq('player_id', id).maybeSingle(),
        supabase.from('prophecy_answers').select('*').eq('player_id', id),
        supabase.from('score_cache').select('*').eq('player_id', id).maybeSingle(),
        supabase.from('score_cache_trio_detail').select('*').eq('player_id', id),
      ]);

      return {
        profile: profileResult.data as Profile,
        picks: picksResult.data as Picks | null,
        prophecyAnswers: (answersResult.data ?? []) as ProphecyAnswer[],
        scores: cacheResult.data as ScoreCache | null,
        trioDetail: (trioDetailResult.data ?? []) as ScoreCacheTrioDetail[],
      };
    },
    enabled: !!id,
  });

  if (isLoading || !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const { profile, picks, prophecyAnswers, scores, trioDetail } = data;

  if (!picks) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No picks submitted yet.</Text>
      </View>
    );
  }

  const trio = [picks.trio_castaway_1, picks.trio_castaway_2, picks.trio_castaway_3];
  const answersMap = new Map(prophecyAnswers.map((a) => [a.question_id, a.answer]));
  const trioDetailMap = new Map(trioDetail.map((d) => [d.castaway_id, d.points_earned]));
  const trioPoints = scores?.trio_points ?? 0;
  const ickyPoints = scores?.icky_points ?? 0;
  const prophecyPoints = scores?.prophecy_points ?? 0;
  const totalPoints = scores?.total_points ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Player header */}
      <View style={styles.header}>
        <Text style={styles.playerName}>{profile.display_name}</Text>
        <Text style={styles.totalScore}>{totalPoints} pts</Text>
      </View>

      {/* Score breakdown */}
      <View style={styles.scoreSummary}>
        <View style={styles.scorePill}>
          <Text style={styles.pillValue}>{trioPoints}</Text>
          <Text style={styles.pillLabel}>Trio</Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={[styles.pillValue, ickyPoints < 0 && styles.negative]}>{ickyPoints}</Text>
          <Text style={styles.pillLabel}>Icky</Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={styles.pillValue}>{prophecyPoints}</Text>
          <Text style={styles.pillLabel}>Prophecy</Text>
        </View>
      </View>

      {/* Trusted Trio */}
      <SectionHeader title="Trusted Trio" points={trioPoints} />
      {trio.map((castawayId) => {
        const castaway = castawayMap.get(castawayId);
        const points = trioDetailMap.get(castawayId) ?? 0;
        return (
          <CastawayRow
            key={castawayId}
            name={castaway?.name ?? '?'}
            tribe={castaway?.tribe}
            points={points}
            isActive={castaway?.is_active ?? true}
            onPress={() => router.push(`/castaways/${castawayId}`)}
          />
        );
      })}

      {/* Icky Pick */}
      <SectionHeader title="Icky Pick" points={ickyPoints} />
      {(() => {
        const castaway = castawayMap.get(picks.icky_castaway);
        return (
          <CastawayRow
            name={castaway?.name ?? '?'}
            tribe={castaway?.tribe}
            points={ickyPoints}
            isActive={castaway?.is_active ?? true}
            isIcky
            onPress={() => router.push(`/castaways/${picks.icky_castaway}`)}
          />
        );
      })()}

      {/* Prophecy Picks */}
      <SectionHeader title="Prophecy Picks" points={prophecyPoints} />
      {PROPHECY_QUESTIONS.map((q) => {
        const answer = answersMap.get(q.id);
        return (
          <View key={q.id} style={styles.prophecyRow}>
            <Text style={styles.prophecyText}>{q.text}</Text>
            <View style={styles.prophecyRight}>
              {answer !== undefined ? (
                <Text style={[styles.prophecyAnswer, answer ? styles.answerYes : styles.answerNo]}>
                  {answer ? 'YES' : 'NO'}
                </Text>
              ) : (
                <Text style={styles.prophecySkipped}>—</Text>
              )}
              <Text style={styles.prophecyPts}>{q.points}pt</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function SectionHeader({ title, points }: { title: string; points: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={[styles.sectionPoints, points < 0 && styles.negative]}>{points} pts</Text>
    </View>
  );
}

function CastawayRow({ name, tribe, points, isActive, isIcky, onPress }: { name: string; tribe?: Tribe; points: number; isActive: boolean; isIcky?: boolean; onPress?: () => void }) {
  const tribeColor = tribe ? tribeColors[tribe] : colors.textMuted;
  return (
    <TouchableOpacity style={[styles.castawayRow, { borderLeftColor: tribeColor }]} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.tribeDot, { backgroundColor: tribeColor }]} />
      <Text style={[styles.castawayName, !isActive && styles.eliminated]}>{name}</Text>
      {!isActive && <Text style={styles.eliminatedBadge}>OUT</Text>}
      <Text style={[styles.castawayPoints, points < 0 && styles.negative, points > 0 && styles.positive]}>
        {points > 0 ? `+${points}` : points}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  header: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  playerName: { color: colors.textPrimary, fontSize: 28, fontWeight: '800' },
  totalScore: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  scoreSummary: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  scorePill: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center' },
  pillValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  pillLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  sectionPoints: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  castawayRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderLeftWidth: 3, gap: 10 },
  tribeDot: { width: 8, height: 8, borderRadius: 4 },
  castawayName: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  eliminated: { color: colors.textMuted, textDecorationLine: 'line-through' },
  eliminatedBadge: { color: colors.error, fontSize: 10, fontWeight: '800' },
  castawayPoints: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  positive: { color: colors.scorePositive },
  negative: { color: colors.scoreNegative },
  prophecyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  prophecyText: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  prophecyRight: { alignItems: 'flex-end', gap: 2 },
  prophecyAnswer: { fontSize: 12, fontWeight: '800' },
  answerYes: { color: colors.success },
  answerNo: { color: colors.error },
  prophecySkipped: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  prophecyPts: { color: colors.textMuted, fontSize: 10 },
});
