import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useCastawayMap } from '@/hooks/useCastaways';
import { PROPHECY_QUESTIONS, EVENT_LABELS, EVENT_SCORES, getSurvivalPoints } from '@/lib/constants';
import { useTribeColors } from '@/hooks/useTribeColors';
import { colors } from '@/theme/colors';
import type { Picks, ProphecyAnswer, ProphecyOutcome, ScoreCache, ScoreCacheTrioDetail, ScoreSnapshot, Profile, Tribe, EventType, CastawayEvent } from '@/types';

const ICKY_PLACEMENT_LABELS: Record<string, string> = {
  first_boot: 'First Boot',
  pre_merge: 'Pre-Merge Boot',
  jury: 'Jury Member',
  '3rd': '3rd Place',
  runner_up: 'Runner-Up',
  winner: 'Winner',
};

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const castawayMap = useCastawayMap();
  const tribeColors = useTribeColors();
  const activeGroup = useAuthStore((state) => state.activeGroup);
  const groupId = activeGroup?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['player-picks', id, groupId],
    queryFn: async () => {
      const [profileResult, picksResult, answersResult, outcomesResult, cacheResult, trioDetailResult, snapshotResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('picks').select('*').eq('player_id', id).maybeSingle(),
        supabase.from('prophecy_answers').select('*').eq('player_id', id),
        supabase.from('prophecy_outcomes').select('*'),
        groupId
          ? supabase.from('score_cache').select('*').eq('player_id', id).eq('group_id', groupId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        groupId
          ? supabase.from('score_cache_trio_detail').select('*').eq('player_id', id).eq('group_id', groupId)
          : Promise.resolve({ data: [], error: null }),
        groupId
          ? supabase.from('score_snapshots').select('*').eq('player_id', id).eq('group_id', groupId).order('episode_number', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      const picks = picksResult.data as Picks | null;

      // Fetch trio castaway events for episode breakdown
      let trioEvents: (CastawayEvent & { episodes: { episode_number: number } })[] = [];
      if (picks) {
        const trioIds = [picks.trio_castaway_1, picks.trio_castaway_2, picks.trio_castaway_3];
        const { data } = await supabase
          .from('castaway_events')
          .select('*, episodes(episode_number)')
          .in('castaway_id', trioIds)
          .order('episodes(episode_number)', { ascending: true });
        trioEvents = (data ?? []) as (CastawayEvent & { episodes: { episode_number: number } })[];
      }

      return {
        profile: profileResult.data as Profile,
        picks,
        prophecyAnswers: (answersResult.data ?? []) as ProphecyAnswer[],
        prophecyOutcomes: (outcomesResult.data ?? []) as ProphecyOutcome[],
        scores: cacheResult.data as ScoreCache | null,
        trioDetail: (trioDetailResult.data ?? []) as ScoreCacheTrioDetail[],
        trioEvents,
        snapshots: (snapshotResult.data ?? []) as ScoreSnapshot[],
      };
    },
    enabled: !!id,
  });

  // Build per-episode breakdown using score_snapshots for deltas (must be before early returns)
  const episodeBreakdown = useMemo(() => {
    const snapshots = data?.snapshots ?? [];
    const trioEvts = data?.trioEvents ?? [];
    const prophecyOuts = data?.prophecyOutcomes ?? [];
    const prophecyAns = data?.prophecyAnswers ?? [];
    const picks = data?.picks;

    if (snapshots.length === 0 && trioEvts.length === 0) return [];

    // Compute per-episode deltas from cumulative snapshots
    const deltas = snapshots.map((snap, i) => {
      const prev = i > 0 ? snapshots[i - 1] : { trio_points: 0, icky_points: 0, prophecy_points: 0, total_points: 0 };
      return {
        episodeNumber: snap.episode_number,
        trioDelta: snap.trio_points - prev.trio_points,
        ickyDelta: snap.icky_points - prev.icky_points,
        prophecyDelta: snap.prophecy_points - prev.prophecy_points,
        totalDelta: snap.total_points - prev.total_points,
      };
    });

    // Group trio events by episode
    type TrioEvent = (typeof trioEvts)[number];
    const trioByEpisode = new Map<number, TrioEvent[]>();
    for (const event of trioEvts) {
      const epNum = event.episodes?.episode_number ?? 0;
      if (epNum === 0) continue;
      if (!trioByEpisode.has(epNum)) trioByEpisode.set(epNum, []);
      trioByEpisode.get(epNum)!.push(event);
    }

    // Group prophecy outcomes by episode_number
    const pAnswerMap = new Map(prophecyAns.map((a) => [a.question_id, a.answer]));
    const prophecyByEp = new Map<number, { correctCount: number; totalResolved: number }>();
    for (const o of prophecyOuts) {
      if (o.outcome !== null && o.episode_number) {
        if (!prophecyByEp.has(o.episode_number)) {
          prophecyByEp.set(o.episode_number, { correctCount: 0, totalResolved: 0 });
        }
        const entry = prophecyByEp.get(o.episode_number)!;
        entry.totalResolved++;
        if (pAnswerMap.get(o.question_id) === o.outcome) entry.correctCount++;
      }
    }

    // Icky castaway info
    const ickyCW = picks ? castawayMap.get(picks.icky_castaway) : null;
    const ickyName = ickyCW?.name ?? '?';
    const ickyPlace = ickyCW?.final_placement ?? null;

    // Collect all episode numbers that have data
    const allEpisodes = new Set<number>();
    deltas.forEach((d) => allEpisodes.add(d.episodeNumber));
    trioByEpisode.forEach((_, ep) => allEpisodes.add(ep));

    const deltaMap = new Map(deltas.map((d) => [d.episodeNumber, d]));

    return Array.from(allEpisodes)
      .sort((a, b) => a - b)
      .map((episodeNumber) => {
        const delta = deltaMap.get(episodeNumber);
        const trioEventsForEp = trioByEpisode.get(episodeNumber) ?? [];

        // Build trio castaway breakdown (existing logic)
        const byCastaway = new Map<number, TrioEvent[]>();
        for (const event of trioEventsForEp) {
          if (!byCastaway.has(event.castaway_id)) byCastaway.set(event.castaway_id, []);
          byCastaway.get(event.castaway_id)!.push(event);
        }
        const trioBreakdowns = Array.from(byCastaway.entries()).map(([castawayId, evts]) => {
          let pts = 0;
          const details: { label: string; points: number }[] = [];
          for (const e of evts) {
            if (e.event_type === 'survived_episode') {
              const sp = getSurvivalPoints(episodeNumber);
              pts += sp;
              details.push({ label: 'Survived', points: sp });
            } else {
              const ep = EVENT_SCORES[e.event_type] ?? 0;
              pts += ep;
              details.push({ label: EVENT_LABELS[e.event_type] ?? e.event_type, points: ep });
            }
          }
          return { castawayId, points: pts, details };
        });

        const trioDelta = delta?.trioDelta ?? trioBreakdowns.reduce((sum, c) => sum + c.points, 0);
        const ickyDelta = delta?.ickyDelta ?? 0;
        const prophecyDelta = delta?.prophecyDelta ?? 0;
        const totalDelta = delta?.totalDelta ?? (trioDelta + ickyDelta + prophecyDelta);
        const pInfo = prophecyByEp.get(episodeNumber) ?? null;

        return {
          episodeNumber,
          totalDelta,
          trioDelta,
          ickyDelta,
          prophecyDelta,
          trioBreakdowns,
          ickyInfo: ickyDelta !== 0 ? { name: ickyName, placement: ickyPlace } : null,
          prophecyInfo: prophecyDelta !== 0 ? (pInfo ?? { correctCount: 0, totalResolved: 0 }) : null,
        };
      })
      .filter((ep) => ep.totalDelta !== 0 || ep.trioBreakdowns.length > 0);
  }, [data, castawayMap]);

  if (isLoading || !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const { profile, picks, prophecyAnswers, prophecyOutcomes, scores, trioDetail } = data;

  if (!picks) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No picks submitted yet.</Text>
      </View>
    );
  }

  const trio = [picks.trio_castaway_1, picks.trio_castaway_2, picks.trio_castaway_3] as const;

  const answersMap = new Map(prophecyAnswers.map((a) => [a.question_id, a.answer]));
  const outcomesMap = new Map(prophecyOutcomes.map((o) => [o.question_id, o.outcome]));
  const trioDetailMap = new Map(trioDetail.map((d) => [d.castaway_id, d.points_earned]));
  const trioPoints = scores?.trio_points ?? 0;
  const ickyPoints = scores?.icky_points ?? 0;
  const prophecyPoints = scores?.prophecy_points ?? 0;
  const totalPoints = scores?.total_points ?? 0;

  const ickyCastaway = castawayMap.get(picks.icky_castaway);
  const ickyPlacement = ickyCastaway?.final_placement ?? null;

  let prophecyCorrectCount = 0;
  let prophecyTotalResolved = 0;
  for (const q of PROPHECY_QUESTIONS) {
    const outcome = outcomesMap.get(q.id);
    if (outcome !== null && outcome !== undefined) {
      prophecyTotalResolved++;
      if (answersMap.get(q.id) === outcome) prophecyCorrectCount++;
    }
  }

  const initials = (profile.display_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Player header */}
      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
            <Text style={styles.headerInitials}>{initials}</Text>
          </View>
        )}
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

      {/* Score Breakdown (collapsible) */}
      {episodeBreakdown.length > 0 && (
        <EpisodeBreakdownSection
          episodes={episodeBreakdown}
          totalPoints={totalPoints}
          castawayMap={castawayMap}
          tribeColors={tribeColors}
        />
      )}

      {/* Trusted Trio */}
      <SectionHeader title="Trusted Trio" points={trioPoints} />
      {trio.map((castawayId) => {
        const castaway = castawayMap.get(castawayId);
        const points = trioDetailMap.get(castawayId) ?? 0;
        return (
          <CastawayRow
            key={castawayId}
            name={castaway?.name ?? '?'}
            tribe={castaway?.original_tribe}
            points={points}
            isActive={castaway?.is_active ?? true}
            tribeColors={tribeColors}
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
            tribe={castaway?.original_tribe}
            points={ickyPoints}
            isActive={castaway?.is_active ?? true}
            isIcky
            tribeColors={tribeColors}
            onPress={() => router.push(`/castaways/${picks.icky_castaway}?context=icky`)}
          />
        );
      })()}

      {/* Prophecy Picks */}
      <SectionHeader title="Prophecy Picks" points={prophecyPoints} />
      {PROPHECY_QUESTIONS.map((q) => {
        const answer = answersMap.get(q.id);
        const outcome = outcomesMap.get(q.id);
        const isResolved = outcome !== null && outcome !== undefined;
        const isCorrect = isResolved && answer === outcome;
        return (
          <View key={q.id} style={[styles.prophecyRow, isResolved && (isCorrect ? styles.prophecyRowCorrect : styles.prophecyRowWrong)]}>
            <View style={styles.prophecyLeft}>
              <Text style={[styles.prophecyText, isResolved && !isCorrect && styles.prophecyTextWrong]}>{q.text}</Text>
              {isResolved && (
                <Text style={[styles.prophecyResult, isCorrect ? styles.prophecyResultCorrect : styles.prophecyResultWrong]}>
                  {isCorrect ? `+${q.points}pt` : '+0pt'}
                </Text>
              )}
            </View>
            <View style={styles.prophecyRight}>
              {answer !== undefined ? (
                <Text style={[styles.prophecyAnswer, answer ? styles.answerYes : styles.answerNo]}>
                  {answer ? 'YES' : 'NO'}
                </Text>
              ) : (
                <Text style={styles.prophecySkipped}>—</Text>
              )}
              {isResolved ? (
                <Text style={isCorrect ? styles.prophecyCorrectIcon : styles.prophecyWrongIcon}>
                  {isCorrect ? '\u2713' : '\u2717'}
                </Text>
              ) : (
                <Text style={styles.prophecyPts}>{q.points}pt</Text>
              )}
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

function CastawayRow({ name, tribe, points, isActive, isIcky, onPress, tribeColors }: { name: string; tribe?: Tribe; points: number; isActive: boolean; isIcky?: boolean; onPress?: () => void; tribeColors: Record<string, string> }) {
  const tribeColor = tribe ? (tribeColors[tribe] ?? colors.textMuted) : colors.textMuted;
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

interface EpisodeBD {
  episodeNumber: number;
  totalDelta: number;
  trioDelta: number;
  ickyDelta: number;
  prophecyDelta: number;
  trioBreakdowns: {
    castawayId: number;
    points: number;
    details: { label: string; points: number }[];
  }[];
  ickyInfo: { name: string; placement: string | null } | null;
  prophecyInfo: { correctCount: number; totalResolved: number } | null;
}

function EpisodeBreakdownSection({
  episodes,
  totalPoints,
  castawayMap,
  tribeColors,
}: {
  episodes: EpisodeBD[];
  totalPoints: number;
  castawayMap: Map<number, import('@/types').Castaway>;
  tribeColors: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.sectionHeaderTappable} onPress={() => setOpen(!open)} activeOpacity={0.6}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          <Text style={styles.chevron}>{open ? '\u25B2' : '\u25BC'}</Text>
        </View>
        <Text style={[styles.sectionPoints, totalPoints < 0 && styles.negative]}>{totalPoints} pts</Text>
      </TouchableOpacity>
      {open && episodes.map((ep) => (
        <EpisodeRow key={ep.episodeNumber} episode={ep} castawayMap={castawayMap} tribeColors={tribeColors} />
      ))}
    </>
  );
}

function EpisodeRow({ episode, castawayMap, tribeColors }: { episode: EpisodeBD; castawayMap: Map<number, import('@/types').Castaway>; tribeColors: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.episodeCard}>
      <TouchableOpacity style={styles.episodeHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.6}>
        <Text style={styles.episodeLabel}>Episode {episode.episodeNumber}</Text>
        <View style={styles.episodeRight}>
          <Text style={[
            styles.episodePoints,
            episode.totalDelta > 0 && styles.positive,
            episode.totalDelta < 0 && styles.negative,
          ]}>
            {episode.totalDelta > 0 ? `+${episode.totalDelta}` : episode.totalDelta} pts
          </Text>
          <Text style={styles.chevron}>{expanded ? '\u25B2' : '\u25BC'}</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.episodeDetail}>
          {/* Trio breakdown */}
          {episode.trioBreakdowns.length > 0 && (
            <View style={styles.epCategoryBlock}>
              <View style={styles.epCategoryHeader}>
                <Text style={styles.epCategoryLabel}>Trusted Trio</Text>
                <Text style={[styles.epCategoryPts, episode.trioDelta > 0 && styles.positive, episode.trioDelta < 0 && styles.negative]}>
                  {episode.trioDelta > 0 ? `+${episode.trioDelta}` : episode.trioDelta}
                </Text>
              </View>
              {episode.trioBreakdowns.map(({ castawayId, points, details }) => {
                const castaway = castawayMap.get(castawayId);
                const tribeColor = castaway?.original_tribe ? (tribeColors[castaway.original_tribe] ?? colors.textMuted) : colors.textMuted;
                return (
                  <View key={castawayId} style={styles.epCastawayBlock}>
                    <View style={styles.epCastawayHeader}>
                      <View style={[styles.tribeDot, { backgroundColor: tribeColor }]} />
                      <Text style={styles.epCastawayName}>{castaway?.name ?? '?'}</Text>
                      <Text style={[styles.epCastawayPts, points > 0 && styles.positive, points < 0 && styles.negative]}>
                        {points > 0 ? `+${points}` : points}
                      </Text>
                    </View>
                    {details.map((d, i) => (
                      <View key={i} style={styles.epEventRow}>
                        <Text style={styles.epEventLabel}>{d.label}</Text>
                        <Text style={[styles.epEventPts, d.points > 0 && styles.positive, d.points < 0 && styles.negative]}>
                          {d.points > 0 ? `+${d.points}` : d.points}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
          {/* Icky pick */}
          {episode.ickyInfo && (
            <View style={styles.epCategoryBlock}>
              <View style={styles.epCategoryHeader}>
                <Text style={styles.epCategoryLabel}>Icky Pick</Text>
                <Text style={[styles.epCategoryPts, episode.ickyDelta > 0 && styles.positive, episode.ickyDelta < 0 && styles.negative]}>
                  {episode.ickyDelta > 0 ? `+${episode.ickyDelta}` : episode.ickyDelta}
                </Text>
              </View>
              <View style={styles.epEventRow}>
                <Text style={styles.epEventLabel}>
                  {episode.ickyInfo.name}{episode.ickyInfo.placement ? ` — ${ICKY_PLACEMENT_LABELS[episode.ickyInfo.placement] ?? episode.ickyInfo.placement}` : ''}
                </Text>
                <Text style={[styles.epEventPts, episode.ickyDelta > 0 && styles.positive, episode.ickyDelta < 0 && styles.negative]}>
                  {episode.ickyDelta > 0 ? `+${episode.ickyDelta}` : episode.ickyDelta}
                </Text>
              </View>
            </View>
          )}
          {/* Prophecy */}
          {episode.prophecyInfo && (
            <View style={styles.epCategoryBlock}>
              <View style={styles.epCategoryHeader}>
                <Text style={styles.epCategoryLabel}>Prophecy</Text>
                <Text style={[styles.epCategoryPts, episode.prophecyDelta > 0 && styles.positive]}>
                  {episode.prophecyDelta > 0 ? `+${episode.prophecyDelta}` : episode.prophecyDelta}
                </Text>
              </View>
              {episode.prophecyInfo.totalResolved > 0 && (
                <View style={styles.epEventRow}>
                  <Text style={styles.epEventLabel}>
                    {episode.prophecyInfo.correctCount} of {episode.prophecyInfo.totalResolved} resolved correct
                  </Text>
                  <Text style={[styles.epEventPts, episode.prophecyDelta > 0 && styles.positive]}>
                    {episode.prophecyDelta > 0 ? `+${episode.prophecyDelta}` : episode.prophecyDelta}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  header: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  headerAvatar: { width: 64, height: 64, borderRadius: 32 },
  headerAvatarPlaceholder: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerInitials: { color: '#fff', fontSize: 22, fontWeight: '800' },
  playerName: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', marginTop: 4 },
  totalScore: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  scoreSummary: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  scorePill: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, alignItems: 'center' },
  pillValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  pillLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionHeaderTappable: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  prophecySkipped: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  prophecyPts: { color: colors.textMuted, fontSize: 10 },
  episodeCard: { backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 2, borderRadius: 10, overflow: 'hidden' },
  episodeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  episodeLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  episodeRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  episodePoints: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  chevron: { color: colors.textMuted, fontSize: 10 },
  episodeDetail: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, gap: 12 },
  epCategoryBlock: { gap: 4 },
  epCategoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 },
  epCategoryLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  epCategoryPts: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  epCastawayBlock: { gap: 2 },
  epCastawayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  epCastawayName: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  epCastawayPts: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  epEventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, paddingVertical: 1 },
  epEventLabel: { color: colors.textMuted, fontSize: 12 },
  epEventPts: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});
