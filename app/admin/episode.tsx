import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useCastawaysByTribe } from '@/hooks/useCastaways';
import { EVENT_LABELS } from '@/lib/constants';
import { colors, tribeColors } from '@/theme/colors';
import type { Castaway, EventType, Tribe } from '@/types';

// Finale-only milestones
const FINALE_MILESTONES: EventType[] = [
  'fire_making_win',
  'final_immunity_win',
  'placed_3rd',
  'placed_runner_up',
  'sole_survivor',
];

type IdolPlayResult = 'correct' | 'incorrect';
type ShotResult = 'success' | 'fail';

export default function EpisodeScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { byTribe, castaways, isLoading: castawaysLoading } = useCastawaysByTribe();
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [episodeId, setEpisodeId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Episode flags
  const [isMerge, setIsMerge] = useState(false);
  const [isFinale, setIsFinale] = useState(false);

  // Category state
  const [votedOff, setVotedOff] = useState<Set<number>>(new Set());
  const [votedOffDetails, setVotedOffDetails] = useState<Record<number, Set<string>>>({});
  const [immunityWinners, setImmunityWinners] = useState<Set<number>>(new Set());
  const [rewardWinners, setRewardWinners] = useState<Set<number>>(new Set());
  const [idolsFound, setIdolsFound] = useState<Set<number>>(new Set());
  const [advantagesFound, setAdvantagesFound] = useState<Set<number>>(new Set());
  const [idolPlays, setIdolPlays] = useState<Record<number, IdolPlayResult>>({});
  const [shotInDark, setShotInDark] = useState<Record<number, ShotResult>>({});
  const [milestones, setMilestones] = useState<Record<string, Set<number>>>({});

  // Expanded card state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(['votedOff']));
  const [showEpisodeOptions, setShowEpisodeOptions] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Fetch previously logged episodes
  const { data: pastEpisodes } = useQuery({
    queryKey: ['episodes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('episodes')
        .select('id, episode_number, is_finalized, is_merge, is_finale, created_at')
        .order('episode_number', { ascending: true });
      return data ?? [];
    },
  });

  const activeCastaways = useMemo(
    () => (castaways ?? []).filter((c: Castaway) => c.is_active),
    [castaways],
  );

  // For all cards except "Voted Off & Quit", exclude anyone selected as departed this episode
  const remainingCastaways = useMemo(
    () => activeCastaways.filter((c) => !votedOff.has(c.id)),
    [activeCastaways, votedOff],
  );

  const castawayMap = useMemo(() => {
    const map: Record<number, Castaway> = {};
    (castaways ?? []).forEach((c: Castaway) => { map[c.id] = c; });
    return map;
  }, [castaways]);

  const episodeNum = parseInt(episodeNumber, 10) || 0;

  const toggleCard = useCallback((card: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(card)) next.delete(card);
      else next.add(card);
      return next;
    });
  }, []);

  // --- Helpers for Set-based state ---

  function toggleInSet(setter: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVotedOffDetail(castawayId: number, detail: string) {
    setVotedOffDetails((prev) => {
      const current = new Set(prev[castawayId] ?? []);
      if (current.has(detail)) current.delete(detail);
      else current.add(detail);
      return { ...prev, [castawayId]: current };
    });
  }

  function toggleIdolPlay(castawayId: number) {
    setIdolPlays((prev) => {
      const next = { ...prev };
      if (next[castawayId]) {
        delete next[castawayId];
      } else {
        next[castawayId] = 'correct';
      }
      return next;
    });
  }

  function cycleIdolResult(castawayId: number) {
    setIdolPlays((prev) => ({
      ...prev,
      [castawayId]: prev[castawayId] === 'correct' ? 'incorrect' : 'correct',
    }));
  }

  function toggleShotInDark(castawayId: number) {
    setShotInDark((prev) => {
      const next = { ...prev };
      if (next[castawayId]) {
        delete next[castawayId];
      } else {
        next[castawayId] = 'success';
      }
      return next;
    });
  }

  function cycleShotResult(castawayId: number) {
    setShotInDark((prev) => ({
      ...prev,
      [castawayId]: prev[castawayId] === 'success' ? 'fail' : 'success',
    }));
  }

  function toggleMilestone(event: string, castawayId: number) {
    setMilestones((prev) => {
      const current = new Set(prev[event] ?? []);
      if (current.has(castawayId)) current.delete(castawayId);
      else current.add(castawayId);
      return { ...prev, [event]: current };
    });
  }

  // --- Build flat events array ---

  function buildEvents(): { episode_id: number; castaway_id: number; event_type: EventType }[] {
    if (!episodeId) return [];
    const result: { episode_id: number; castaway_id: number; event_type: EventType }[] = [];

    const add = (castawayId: number, event: EventType) =>
      result.push({ episode_id: episodeId, castaway_id: castawayId, event_type: event });

    // Survived: everyone active who wasn't voted off / quit
    activeCastaways.forEach((c: Castaway) => {
      if (!votedOff.has(c.id)) {
        add(c.id, 'survived_episode');
      }
    });

    // Departure details (voted off + quit are both in votedOff set now)
    votedOff.forEach((id) => {
      const details = votedOffDetails[id];
      if (details?.has('quit')) add(id, 'quit');
      if (details?.has('unanimous')) add(id, 'voted_out_unanimously');
      if (details?.has('idol')) add(id, 'voted_out_with_idol');
      if (details?.has('advantage')) add(id, 'voted_out_with_advantage');
      if (details?.has('first_boot')) add(id, 'first_boot');
    });

    // Immunity & Reward
    immunityWinners.forEach((id) => add(id, 'individual_immunity_win'));
    rewardWinners.forEach((id) => add(id, 'individual_reward_win'));

    // Idols & Advantages found
    idolsFound.forEach((id) => add(id, 'idol_found'));
    advantagesFound.forEach((id) => add(id, 'advantage_found'));

    // Idol plays
    Object.entries(idolPlays).forEach(([id, result]) => {
      add(Number(id), result === 'correct' ? 'idol_played_correct' : 'idol_played_incorrect');
    });

    // Shot in the dark
    Object.entries(shotInDark).forEach(([id, result]) => {
      add(Number(id), result === 'success' ? 'shot_in_dark_success' : 'shot_in_dark_fail');
    });

    // Milestones
    Object.entries(milestones).forEach(([event, ids]) => {
      ids.forEach((id) => add(id, event as EventType));
    });

    return result;
  }

  // --- Episode creation / resume ---

  async function startEpisode(num: number) {
    setIsCreating(true);
    const { data, error } = await supabase
      .from('episodes')
      .upsert({ episode_number: num }, { onConflict: 'episode_number' })
      .select()
      .single();

    setIsCreating(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setEpisodeNumber(String(num));
      setEpisodeId(data.id);
      setIsMerge(data.is_merge ?? false);
      setIsFinale(data.is_finale ?? false);
    }
  }

  function resumeEpisode(ep: { id: number; episode_number: number; is_merge?: boolean; is_finale?: boolean }) {
    setEpisodeNumber(String(ep.episode_number));
    setEpisodeId(ep.id);
    setIsMerge(ep.is_merge ?? false);
    setIsFinale(ep.is_finale ?? false);
  }

  async function openEpisode(ep: { id: number; episode_number: number; is_merge?: boolean; is_finale?: boolean }) {
    setIsLoadingEvents(true);
    setEpisodeNumber(String(ep.episode_number));
    setEpisodeId(ep.id);
    setIsMerge(ep.is_merge ?? false);
    setIsFinale(ep.is_finale ?? false);

    // Load saved events and hydrate category state
    const { data: events } = await supabase
      .from('castaway_events')
      .select('castaway_id, event_type')
      .eq('episode_id', ep.id);

    if (events) {
      const off = new Set<number>();
      const offDetails: Record<number, Set<string>> = {};
      const immunity = new Set<number>();
      const reward = new Set<number>();
      const idolF = new Set<number>();
      const advF = new Set<number>();
      const idolP: Record<number, IdolPlayResult> = {};
      const sitd: Record<number, ShotResult> = {};
      const mile: Record<string, Set<number>> = {};

      for (const { castaway_id, event_type } of events) {
        switch (event_type) {
          case 'survived_episode': break; // inferred, skip
          case 'quit':
          case 'voted_out_unanimously':
          case 'voted_out_with_idol':
          case 'voted_out_with_advantage':
          case 'first_boot': {
            off.add(castaway_id);
            if (!offDetails[castaway_id]) offDetails[castaway_id] = new Set();
            const detailKey =
              event_type === 'quit' ? 'quit' :
              event_type === 'voted_out_unanimously' ? 'unanimous' :
              event_type === 'voted_out_with_idol' ? 'idol' :
              event_type === 'voted_out_with_advantage' ? 'advantage' :
              'first_boot';
            offDetails[castaway_id].add(detailKey);
            break;
          }
          case 'individual_immunity_win': immunity.add(castaway_id); break;
          case 'individual_reward_win': reward.add(castaway_id); break;
          case 'idol_found': idolF.add(castaway_id); break;
          case 'advantage_found': advF.add(castaway_id); break;
          case 'idol_played_correct': idolP[castaway_id] = 'correct'; break;
          case 'idol_played_incorrect': idolP[castaway_id] = 'incorrect'; break;
          case 'shot_in_dark_success': sitd[castaway_id] = 'success'; break;
          case 'shot_in_dark_fail': sitd[castaway_id] = 'fail'; break;
          default: {
            // Milestones (made_jury, fire_making_win, etc.)
            if (!mile[event_type]) mile[event_type] = new Set();
            mile[event_type].add(castaway_id);
            break;
          }
        }
      }

      // Also add castaways who survived=false (not in survived_episode) to votedOff
      // if they don't already have a departure detail
      const survivedIds = new Set(
        events.filter((e) => e.event_type === 'survived_episode').map((e) => e.castaway_id),
      );
      const allActive = (castaways ?? []).filter((c: Castaway) => c.is_active || off.has(c.id));
      for (const c of allActive) {
        if (!survivedIds.has(c.id) && !off.has(c.id)) {
          off.add(c.id);
        }
      }

      setVotedOff(off);
      setVotedOffDetails(offDetails);
      setImmunityWinners(immunity);
      setRewardWinners(reward);
      setIdolsFound(idolF);
      setAdvantagesFound(advF);
      setIdolPlays(idolP);
      setShotInDark(sitd);
      setMilestones(mile);
    }

    setIsLoadingEvents(false);
  }

  // --- Finalization (unchanged logic) ---

  async function handleFinalize() {
    if (!episodeId) return;

    const eventsToInsert = buildEvents();

    Alert.alert(
      'Finalize Episode',
      `This will save ${eventsToInsert.length} events and recalculate all player scores. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          style: 'destructive',
          onPress: async () => {
            setIsFinalizing(true);
            try {
              if (eventsToInsert.length > 0) {
                const { error } = await supabase
                  .from('castaway_events')
                  .upsert(eventsToInsert, { onConflict: 'episode_id,castaway_id,event_type' });
                if (error) throw error;
              }

              await supabase
                .from('episodes')
                .update({ is_finalized: true, is_merge: isMerge, is_finale: isFinale })
                .eq('id', episodeId);

              // Mark departed castaways as inactive with placement data
              if (votedOff.size > 0) {
                const mergeHappened = isMerge || (pastEpisodes ?? []).some((ep) => ep.is_merge && ep.is_finalized);
                const alreadyEliminated = (castaways ?? []).filter((c: Castaway) => !c.is_active).length;
                const epNum = parseInt(episodeNumber, 10);

                let bootIdx = 0;
                for (const id of votedOff) {
                  const details = votedOffDetails[id];
                  const isFirstBoot = details?.has('first_boot') || (epNum === 1 && alreadyEliminated === 0 && votedOff.size === 1);

                  // Finale placements come from milestones (placed_3rd, placed_runner_up, sole_survivor)
                  const hasPlaced3rd = milestones['placed_3rd']?.has(id);
                  const hasRunnerUp = milestones['placed_runner_up']?.has(id);
                  const hasWinner = milestones['sole_survivor']?.has(id);

                  let finalPlacement: string | null = null;
                  if (hasWinner) finalPlacement = 'winner';
                  else if (hasRunnerUp) finalPlacement = 'runner_up';
                  else if (hasPlaced3rd) finalPlacement = '3rd';
                  else if (isFirstBoot) finalPlacement = 'first_boot';
                  else if (!mergeHappened) finalPlacement = 'pre_merge';
                  else finalPlacement = 'jury';

                  await supabase
                    .from('castaways')
                    .update({
                      is_active: false,
                      boot_order: alreadyEliminated + bootIdx + 1,
                      final_placement: finalPlacement,
                    })
                    .eq('id', id);
                  bootIdx++;
                }
              }

              await supabase
                .from('season_config')
                .update({ current_episode: parseInt(episodeNumber, 10) })
                .eq('id', 1);

              // Refresh session then call Edge Function with raw fetch for full error details
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              if (refreshError) throw new Error(`Session expired — please sign in again.`);

              const accessToken = refreshData.session?.access_token;
              const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/calculate-scores`;
              const fnRes = await fetch(fnUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                  'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                },
                body: JSON.stringify({ episode_id: episodeId }),
              });
              if (!fnRes.ok) {
                const body = await fnRes.text();
                throw new Error(`Score calc failed (${fnRes.status}): ${body}`);
              }

              queryClient.invalidateQueries();
              Alert.alert('Episode Finalized', 'Scores have been updated for all players.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Failed to finalize episode.');
            } finally {
              setIsFinalizing(false);
            }
          },
        },
      ],
    );
  }

  // --- Loading ---

  if (castawaysLoading || !byTribe || isLoadingEvents) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  // --- Episode list / entry ---

  // Determine next episode number: highest finalized + 1 (or 1 if none)
  const highestFinalized = (pastEpisodes ?? [])
    .filter((ep) => ep.is_finalized)
    .reduce((max, ep) => Math.max(max, ep.episode_number), 0);
  const draftEpisode = (pastEpisodes ?? []).find((ep) => !ep.is_finalized);
  const finaleFinalized = (pastEpisodes ?? []).some((ep) => ep.is_finale && ep.is_finalized);
  const nextEpisodeNumber = highestFinalized + 1;
  // Show "new episode" button only if there's no existing draft and season isn't over
  const canStartNew = !draftEpisode && !finaleFinalized;

  if (!episodeId) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.episodeSetup}>
          {/* Past finalized episodes */}
          {pastEpisodes && pastEpisodes.some((ep) => ep.is_finalized) && (
            <View style={styles.pastEpisodesSection}>
              <Text style={styles.pastEpisodesTitle}>Logged Episodes</Text>
              {pastEpisodes.filter((ep) => ep.is_finalized).map((ep) => (
                <TouchableOpacity key={ep.id} style={styles.pastEpisodeRow} onPress={() => openEpisode(ep)}>
                  <View style={styles.pastEpisodeInfo}>
                    <Text style={styles.pastEpisodeNumber}>
                      Episode {ep.episode_number}
                      {ep.is_merge ? '  ·  Merge' : ''}
                      {ep.is_finale ? '  ·  Finale' : ''}
                    </Text>
                    <Text style={styles.pastEpisodeStatus}>Finalized — tap to view</Text>
                  </View>
                  <Text style={styles.chevron}>{'▸'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Draft episode — tappable to resume */}
          {draftEpisode && (
            <TouchableOpacity
              style={styles.draftCard}
              onPress={() => resumeEpisode(draftEpisode)}
            >
              <View style={styles.pastEpisodeInfo}>
                <Text style={styles.pastEpisodeNumber}>Episode {draftEpisode.episode_number}</Text>
                <Text style={styles.draftLabel}>Draft — tap to continue</Text>
              </View>
              <View style={[styles.statusDot, styles.statusDraft]} />
            </TouchableOpacity>
          )}

          {/* Start next episode button */}
          {canStartNew && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => startEpisode(nextEpisodeNumber)}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.startButtonText}>Log Episode {nextEpisodeNumber}</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // --- Main logging UI ---

  const allEvents = buildEvents();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Episode header with type flags */}
        <View style={styles.episodeHeader}>
          <TouchableOpacity
            style={styles.episodeTitleRow}
            onPress={() => setShowEpisodeOptions((v) => !v)}
          >
            <Text style={styles.pageTitle}>
              Episode {episodeNumber}
              {isMerge ? '  ·  Merge' : ''}
              {isFinale ? '  ·  Finale' : ''}
            </Text>
            <Text style={styles.chevron}>{showEpisodeOptions ? '▾' : '▸'}</Text>
          </TouchableOpacity>
          {showEpisodeOptions && (
            <View style={styles.episodeFlags}>
              <TouchableOpacity
                style={[styles.flagChip, isMerge && styles.flagChipActive]}
                onPress={() => setIsMerge((v) => !v)}
              >
                <Text style={[styles.flagChipText, isMerge && styles.flagChipTextActive]}>Merge</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.flagChip, isFinale && styles.flagChipActive]}
                onPress={() => setIsFinale((v) => !v)}
              >
                <Text style={[styles.flagChipText, isFinale && styles.flagChipTextActive]}>Finale</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 1. Voted Off & Quit */}
        <CategoryCard
          title="Voted Off & Quit"
          question="Who left the game this episode?"
          count={votedOff.size}
          expanded={expandedCards.has('votedOff')}
          onToggle={() => toggleCard('votedOff')}
        >
          <CastawayChipGrid
            castaways={activeCastaways}
            byTribe={byTribe}
            selected={votedOff}
            onToggle={(id) => toggleInSet(setVotedOff, id)}
          />
          {votedOff.size > 0 && (
            <View style={styles.subDetails}>
              {Array.from(votedOff).map((id) => (
                <View key={id} style={styles.detailRow}>
                  <Text style={styles.detailName}>{castawayMap[id]?.name}</Text>
                  <View style={styles.detailChips}>
                    {[
                      { key: 'quit', label: 'Quit' },
                      { key: 'unanimous', label: 'Unanimous' },
                      { key: 'idol', label: 'Had Idol' },
                      { key: 'advantage', label: 'Had Advantage' },
                      ...(episodeNum === 1 ? [{ key: 'first_boot', label: 'First Boot' }] : []),
                    ].map(({ key, label }) => {
                      const active = votedOffDetails[id]?.has(key);
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.detailChip, active && styles.detailChipActive]}
                          onPress={() => toggleVotedOffDetail(id, key)}
                        >
                          <Text style={[styles.detailChipText, active && styles.detailChipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </CategoryCard>

        {/* 4. Individual Immunity */}
        <CategoryCard
          title="Individual Immunity"
          question="Who won individual immunity?"
          count={immunityWinners.size}
          expanded={expandedCards.has('immunity')}
          onToggle={() => toggleCard('immunity')}
        >
          <CastawayChipGrid
            castaways={remainingCastaways}
            byTribe={byTribe}
            selected={immunityWinners}
            onToggle={(id) => toggleInSet(setImmunityWinners, id)}
          />
        </CategoryCard>

        {/* 5. Individual Reward */}
        <CategoryCard
          title="Individual Reward"
          question="Who won individual reward?"
          count={rewardWinners.size}
          expanded={expandedCards.has('reward')}
          onToggle={() => toggleCard('reward')}
        >
          <CastawayChipGrid
            castaways={remainingCastaways}
            byTribe={byTribe}
            selected={rewardWinners}
            onToggle={(id) => toggleInSet(setRewardWinners, id)}
          />
        </CategoryCard>

        {/* 6. Idols Found */}
        <CategoryCard
          title="Idols Found"
          question="Who found an idol?"
          count={idolsFound.size}
          expanded={expandedCards.has('idolFound')}
          onToggle={() => toggleCard('idolFound')}
        >
          <CastawayChipGrid
            castaways={remainingCastaways}
            byTribe={byTribe}
            selected={idolsFound}
            onToggle={(id) => toggleInSet(setIdolsFound, id)}
          />
        </CategoryCard>

        {/* 7. Advantages Found */}
        <CategoryCard
          title="Advantages Found"
          question="Who found an advantage?"
          count={advantagesFound.size}
          expanded={expandedCards.has('advantageFound')}
          onToggle={() => toggleCard('advantageFound')}
        >
          <CastawayChipGrid
            castaways={remainingCastaways}
            byTribe={byTribe}
            selected={advantagesFound}
            onToggle={(id) => toggleInSet(setAdvantagesFound, id)}
          />
        </CategoryCard>

        {/* 8. Idol Plays */}
        <CategoryCard
          title="Idol Plays"
          question="Who played an idol?"
          count={Object.keys(idolPlays).length}
          expanded={expandedCards.has('idolPlay')}
          onToggle={() => toggleCard('idolPlay')}
        >
          <CastawayChipGrid
            castaways={remainingCastaways}
            byTribe={byTribe}
            selected={new Set(Object.keys(idolPlays).map(Number))}
            onToggle={toggleIdolPlay}
          />
          {Object.keys(idolPlays).length > 0 && (
            <View style={styles.subDetails}>
              {Object.entries(idolPlays).map(([id, result]) => (
                <View key={id} style={styles.detailRow}>
                  <Text style={styles.detailName}>{castawayMap[Number(id)]?.name}</Text>
                  <TouchableOpacity
                    style={[styles.resultToggle, result === 'correct' ? styles.resultCorrect : styles.resultIncorrect]}
                    onPress={() => cycleIdolResult(Number(id))}
                  >
                    <Text style={styles.resultToggleText}>
                      {result === 'correct' ? 'Correct' : 'Incorrect'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </CategoryCard>

        {/* 9. Shot in the Dark */}
        <CategoryCard
          title="Shot in the Dark"
          question="Who played Shot in the Dark?"
          count={Object.keys(shotInDark).length}
          expanded={expandedCards.has('shotInDark')}
          onToggle={() => toggleCard('shotInDark')}
        >
          <CastawayChipGrid
            castaways={remainingCastaways}
            byTribe={byTribe}
            selected={new Set(Object.keys(shotInDark).map(Number))}
            onToggle={toggleShotInDark}
          />
          {Object.keys(shotInDark).length > 0 && (
            <View style={styles.subDetails}>
              {Object.entries(shotInDark).map(([id, result]) => (
                <View key={id} style={styles.detailRow}>
                  <Text style={styles.detailName}>{castawayMap[Number(id)]?.name}</Text>
                  <TouchableOpacity
                    style={[styles.resultToggle, result === 'success' ? styles.resultCorrect : styles.resultIncorrect]}
                    onPress={() => cycleShotResult(Number(id))}
                  >
                    <Text style={styles.resultToggleText}>
                      {result === 'success' ? 'Safe' : 'Not Safe'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </CategoryCard>

        {/* 10. Made Jury — merge episode only */}
        {isMerge && (
          <CategoryCard
            title="Made Jury"
            question="Who made the jury?"
            count={(milestones['made_jury'] ?? new Set()).size}
            expanded={expandedCards.has('madeJury')}
            onToggle={() => toggleCard('madeJury')}
          >
            <CastawayChipGrid
              castaways={remainingCastaways}
              byTribe={byTribe}
              selected={milestones['made_jury'] ?? new Set<number>()}
              onToggle={(id) => toggleMilestone('made_jury', id)}
            />
          </CategoryCard>
        )}

        {/* 11. Finale Milestones — finale episode only */}
        {isFinale && (
          <CategoryCard
            title="Finale Milestones"
            question="Finale results"
            count={FINALE_MILESTONES.reduce((sum, e) => sum + (milestones[e]?.size ?? 0), 0)}
            expanded={expandedCards.has('milestones')}
            onToggle={() => toggleCard('milestones')}
          >
            {FINALE_MILESTONES.map((event) => {
              const selectedIds = milestones[event] ?? new Set<number>();
              return (
                <View key={event} style={styles.milestoneBlock}>
                  <Text style={styles.milestoneLabel}>{EVENT_LABELS[event] ?? event}</Text>
                  <CastawayChipGrid
                    castaways={remainingCastaways}
                    byTribe={byTribe}
                    selected={selectedIds}
                    onToggle={(id) => toggleMilestone(event, id)}
                  />
                </View>
              );
            })}
          </CategoryCard>
        )}

        {/* Review Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Review</Text>
          <Text style={styles.summarySubtitle}>{allEvents.length} events will be logged</Text>
          {allEvents.length > 0 && (
            <View style={styles.summaryList}>
              {summarizeEvents(allEvents, castawayMap).map(({ name, events }, i) => (
                <View key={i} style={styles.summaryRow}>
                  <Text style={styles.summaryName}>{name}</Text>
                  <Text style={styles.summaryEvents}>{events}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.finalizeButton, isFinalizing && styles.disabled]}
          onPress={handleFinalize}
          disabled={isFinalizing}
        >
          {isFinalizing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.finalizeText}>Finalize Episode & Update Scores</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- Helper: summarize events for review ---

function summarizeEvents(
  events: { castaway_id: number; event_type: EventType }[],
  castawayMap: Record<number, Castaway>,
) {
  const grouped: Record<number, EventType[]> = {};
  events.forEach(({ castaway_id, event_type }) => {
    if (!grouped[castaway_id]) grouped[castaway_id] = [];
    grouped[castaway_id].push(event_type);
  });

  return Object.entries(grouped)
    .map(([id, eventList]) => ({
      name: castawayMap[Number(id)]?.name ?? `#${id}`,
      events: eventList
        .filter((e) => e !== 'survived_episode')
        .map((e) => EVENT_LABELS[e] ?? e)
        .join(', ') || 'Survived',
    }))
    .sort((a, b) => {
      // Show non-survived first
      if (a.events === 'Survived' && b.events !== 'Survived') return 1;
      if (a.events !== 'Survived' && b.events === 'Survived') return -1;
      return a.name.localeCompare(b.name);
    });
}

// --- Reusable Components ---

function CategoryCard({
  title, question, count, expanded, onToggle, children,
}: {
  title: string;
  question: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTitle}>{title}</Text>
          {count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          )}
        </View>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.cardBody}>
          <Text style={styles.cardQuestion}>{question}</Text>
          {children}
        </View>
      )}
    </View>
  );
}

function CastawayChipGrid({
  castaways, byTribe, selected, onToggle,
}: {
  castaways: Castaway[];
  byTribe: Record<Tribe, Castaway[]>;
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  const tribes: Tribe[] = ['VATU', 'CILA', 'KALO'];
  const activeIds = new Set(castaways.map((c) => c.id));

  return (
    <View style={styles.chipGrid}>
      {tribes.map((tribe) => {
        const tribeCastaways = (byTribe[tribe] ?? []).filter((c) => activeIds.has(c.id));
        if (tribeCastaways.length === 0) return null;
        return (
          <View key={tribe} style={styles.chipTribeSection}>
            <Text style={[styles.chipTribeLabel, { color: tribeColors[tribe] }]}>{tribe}</Text>
            <View style={styles.chipRow}>
              {tribeCastaways.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => onToggle(c.id)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  // Episode setup
  episodeSetup: { padding: 24, gap: 20 },

  // Past episodes list
  pastEpisodesSection: { gap: 8 },
  pastEpisodesTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  pastEpisodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12,
  },
  pastEpisodeInfo: { gap: 2 },
  pastEpisodeNumber: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  pastEpisodeStatus: { color: colors.textMuted, fontSize: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusFinalized: { backgroundColor: colors.success },
  statusDraft: { backgroundColor: colors.warning },
  draftCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.warning,
  },
  draftLabel: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  startButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Main content
  content: { padding: 16, gap: 12, paddingBottom: 100 },
  episodeHeader: { gap: 8, marginBottom: 4 },
  episodeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', flex: 1 },
  episodeFlags: { flexDirection: 'row', gap: 8 },
  flagChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  flagChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  flagChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  flagChipTextActive: { color: '#fff' },

  // Category cards
  card: { backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  badge: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chevron: { color: colors.textMuted, fontSize: 14 },
  cardBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: 12, gap: 10 },
  cardQuestion: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },

  // Chip grid
  chipGrid: { gap: 8 },
  chipTribeSection: { gap: 4 },
  chipTribeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // Detail sections (vote details)
  detailName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  detailChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subDetails: { gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border + '60', paddingTop: 8 },
  detailRow: { gap: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
  detailChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  detailChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  detailChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  detailChipTextActive: { color: '#fff', fontWeight: '600' },

  // Result toggles (idol correct/incorrect, shot safe/not safe)
  resultToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  resultCorrect: { backgroundColor: colors.success + '20' },
  resultIncorrect: { backgroundColor: colors.error + '20' },
  resultToggleText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },

  // Milestones
  milestoneBlock: { gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
  milestoneLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },

  // Review summary
  summaryCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 16, gap: 8 },
  summaryTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  summarySubtitle: { color: colors.textSecondary, fontSize: 12 },
  summaryList: { gap: 4, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  summaryName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', width: 90 },
  summaryEvents: { color: colors.textSecondary, fontSize: 13, flex: 1 },

  // Footer
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  finalizeButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  finalizeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
