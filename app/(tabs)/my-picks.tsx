import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMyPicks } from '@/hooks/useMyPicks';
import { useSeasonConfig } from '@/hooks/useSeasonConfig';
import { useAuth } from '@/hooks/useAuth';
import { useCastawayMap } from '@/hooks/useCastaways';
import { PROPHECY_QUESTIONS } from '@/lib/constants';
import { colors, tribeColors } from '@/theme/colors';

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

export default function MyPicksScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data, isLoading } = useMyPicks();
  const { config, isPicksLocked } = useSeasonConfig();
  const castawayMap = useCastawayMap();
  const insets = useSafeAreaInsets();

  const initials = (profile?.display_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!data?.picks) {
    const deadline = config?.picks_deadline ? new Date(config.picks_deadline) : null;
    const deadlinePassed = deadline ? new Date() > deadline : false;

    return (
      <View style={styles.centered}>
        {deadlinePassed ? (
          <>
            <Text style={styles.emptyTitle}>Picks are locked</Text>
            <Text style={styles.emptySubtitle}>The submission deadline has passed.</Text>
          </>
        ) : (
          <>
            <Text style={styles.emptyTitle}>Submit Your Picks</Text>
            {deadline && (
              <Text style={styles.emptySubtitle}>
                Deadline: {deadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
            <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/picks/submit')}>
              <Text style={styles.ctaButtonText}>Make My Picks</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  const { picks, prophecyAnswers, prophecyOutcomes, trioDetail, trioPoints, ickyPoints, prophecyPoints, totalPoints } = data;
  const trio = [picks.trio_castaway_1, picks.trio_castaway_2, picks.trio_castaway_3];
  const answersMap = new Map(prophecyAnswers.map((a) => [a.question_id, a.answer]));
  const outcomesMap = new Map(prophecyOutcomes.map((o) => [o.question_id, o.outcome]));
  const trioDetailMap = new Map(trioDetail.map((d) => [d.castaway_id, d.points_earned]));

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}>
      {/* Player header */}
      <View style={styles.header}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
            <Text style={styles.headerInitials}>{initials}</Text>
          </View>
        )}
        <Text style={styles.headerName}>{profile?.display_name ?? ''}</Text>
        <Text style={styles.headerScore}>{totalPoints} pts</Text>
      </View>

      {/* Score summary */}
      <View style={styles.scoreSummary}>
        <Glass style={styles.scorePill}>
          <Text style={styles.pillValue}>{trioPoints}</Text>
          <Text style={styles.pillLabel}>Trio</Text>
        </Glass>
        <Glass style={styles.scorePill}>
          <Text style={[styles.pillValue, ickyPoints < 0 && styles.negative]}>{ickyPoints}</Text>
          <Text style={styles.pillLabel}>Icky</Text>
        </Glass>
        <Glass style={styles.scorePill}>
          <Text style={styles.pillValue}>{prophecyPoints}</Text>
          <Text style={styles.pillLabel}>Prophecy</Text>
        </Glass>
      </View>

      {!isPicksLocked && (
        <TouchableOpacity style={styles.editButton} onPress={() => router.push('/picks/submit')}>
          <Text style={styles.editButtonText}>Edit Picks</Text>
        </TouchableOpacity>
      )}

      <SectionHeader title="Trusted Trio" points={trioPoints} />
      {trio.map((castawayId) => {
        const castaway = castawayMap.get(castawayId);
        const points = trioDetailMap.get(castawayId) ?? 0;
        return (
          <CastawayRow
            key={castawayId}
            name={castaway?.name ?? '?'}
            tribe={castaway?.original_tribe ?? '?'}
            points={points}
            isActive={castaway?.is_active ?? true}
          />
        );
      })}

      <SectionHeader title="Icky Pick" points={ickyPoints} />
      {(() => {
        const castaway = castawayMap.get(picks.icky_castaway);
        return (
          <CastawayRow
            name={castaway?.name ?? '?'}
            tribe={castaway?.original_tribe ?? '?'}
            points={ickyPoints}
            isActive={castaway?.is_active ?? true}
            isIcky
          />
        );
      })()}

      <SectionHeader title="Prophecy Picks" points={prophecyPoints} />
      {PROPHECY_QUESTIONS.map((q) => {
        const answer = answersMap.get(q.id);
        const outcome = outcomesMap.get(q.id);
        const isResolved = outcome !== null && outcome !== undefined;
        const isCorrect = isResolved && answer === outcome;
        return (
          <Glass key={q.id} style={[styles.prophecyRow, isResolved && (isCorrect ? styles.prophecyRowCorrect : styles.prophecyRowWrong)]}>
            <View style={styles.prophecyLeft}>
              <Text style={[styles.prophecyText, isResolved && !isCorrect && styles.prophecyTextWrong]}>{q.text}</Text>
              {isResolved && (
                <Text style={[styles.prophecyResult, isCorrect ? styles.prophecyResultCorrect : styles.prophecyResultWrong]}>
                  {isCorrect ? `+${q.points}pt` : '+0pt'}
                </Text>
              )}
            </View>
            <View style={styles.prophecyRight}>
              <Text style={[styles.prophecyAnswer, answer ? styles.answerYes : styles.answerNo]}>
                {answer ? 'YES' : 'NO'}
              </Text>
              {isResolved ? (
                <Text style={isCorrect ? styles.prophecyCorrectIcon : styles.prophecyWrongIcon}>
                  {isCorrect ? '\u2713' : '\u2717'}
                </Text>
              ) : (
                <Text style={styles.prophecyPending}>{q.points}pt</Text>
              )}
            </View>
          </Glass>
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

function CastawayRow({ name, tribe, points, isActive, isIcky }: { name: string; tribe: string; points: number; isActive: boolean; isIcky?: boolean }) {
  const tribeColor = tribeColors[tribe] ?? colors.textMuted;
  return (
    <Glass style={styles.castawayRow} tintColor={tribeColor + '18'}>
      <View style={[styles.tribeDot, { backgroundColor: tribeColor }]} />
      <Text style={[styles.castawayName, !isActive && styles.eliminated]}>{name}</Text>
      {!isActive && <Text style={styles.eliminatedBadge}>OUT</Text>}
      <Text style={[styles.castawayPoints, points < 0 && styles.negative]}>
        {points > 0 ? `+${points}` : points} pts
      </Text>
    </Glass>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 },
  emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  emptySubtitle: { color: colors.textSecondary, fontSize: 14 },
  ctaButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  ctaButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  header: { alignItems: 'center', paddingTop: 12, paddingBottom: 4, gap: 4 },
  headerAvatar: { width: 64, height: 64, borderRadius: 32 },
  headerAvatarPlaceholder: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerInitials: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerName: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', marginTop: 4 },
  headerScore: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  scoreSummary: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  scorePill: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', overflow: 'hidden' },
  pillValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  pillLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  editButton: { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.borderGlass, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  editButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  sectionPoints: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  castawayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, marginBottom: 2, borderRadius: 14, gap: 10, overflow: 'hidden' },
  tribeDot: { width: 8, height: 8, borderRadius: 4 },
  castawayName: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  eliminated: { color: colors.textMuted, textDecorationLine: 'line-through' },
  eliminatedBadge: { color: colors.error, fontSize: 10, fontWeight: '800' },
  castawayPoints: { color: colors.scorePositive, fontSize: 14, fontWeight: '700' },
  negative: { color: colors.scoreNegative },
  prophecyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginBottom: 2, borderRadius: 14, gap: 8, overflow: 'hidden' },
  prophecyRowCorrect: { backgroundColor: colors.success + '10' },
  prophecyRowWrong: { backgroundColor: colors.error + '08' },
  prophecyLeft: { flex: 1, gap: 2 },
  prophecyText: { color: colors.textPrimary, fontSize: 13 },
  prophecyTextWrong: { color: colors.textSecondary },
  prophecyResult: { fontSize: 11, fontWeight: '700' },
  prophecyResultCorrect: { color: colors.success },
  prophecyResultWrong: { color: colors.textMuted },
  prophecyRight: { alignItems: 'flex-end', gap: 2 },
  prophecyAnswer: { fontSize: 12, fontWeight: '800' },
  answerYes: { color: colors.success },
  answerNo: { color: colors.error },
  prophecyCorrectIcon: { color: colors.success, fontSize: 14, fontWeight: '900' },
  prophecyWrongIcon: { color: colors.error, fontSize: 14, fontWeight: '900' },
  prophecyPending: { color: colors.textMuted, fontSize: 10 },
});
