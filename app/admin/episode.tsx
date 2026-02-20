import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useCastawaysByTribe } from '@/hooks/useCastaways';
import { EVENT_LABELS } from '@/lib/constants';
import { colors, tribeColors } from '@/theme/colors';
import type { Castaway, EventType, Tribe } from '@/types';

// Milestone events shown as individual toggles in the Milestones card
const MILESTONE_EVENTS: EventType[] = [
  'first_boot',
  'made_jury',
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
  const { byTribe, castaways, isLoading: castawaysLoading } = useCastawaysByTribe();
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [episodeId, setEpisodeId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Category state
  const [votedOff, setVotedOff] = useState<Set<number>>(new Set());
  const [votedOffDetails, setVotedOffDetails] = useState<Record<number, Set<string>>>({});
  const [quitPlayers, setQuitPlayers] = useState<Set<number>>(new Set());
  const [immunityWinners, setImmunityWinners] = useState<Set<number>>(new Set());
  const [rewardWinners, setRewardWinners] = useState<Set<number>>(new Set());
  const [idolsFound, setIdolsFound] = useState<Set<number>>(new Set());
  const [advantagesFound, setAdvantagesFound] = useState<Set<number>>(new Set());
  const [idolPlays, setIdolPlays] = useState<Record<number, IdolPlayResult>>({});
  const [shotInDark, setShotInDark] = useState<Record<number, ShotResult>>({});
  const [milestones, setMilestones] = useState<Record<string, Set<number>>>({});

  // Expanded card state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(['votedOff']));

  // Fetch previously logged episodes
  const { data: pastEpisodes } = useQuery({
    queryKey: ['episodes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('episodes')
        .select('id, episode_number, is_finalized, created_at')
        .order('episode_number', { ascending: true });
      return data ?? [];
    },
  });

  const activeCastaways = useMemo(
    () => (castaways ?? []).filter((c: Castaway) => c.is_active),
    [castaways],
  );

  const castawayMap = useMemo(() => {
    const map: Record<number, Castaway> = {};
    (castaways ?? []).forEach((c: Castaway) => { map[c.id] = c; });
    return map;
  }, [castaways]);

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

    // Survived: everyone active who wasn't voted off or quit
    activeCastaways.forEach((c: Castaway) => {
      if (!votedOff.has(c.id) && !quitPlayers.has(c.id)) {
        add(c.id, 'survived_episode');
      }
    });

    // Voted off details
    votedOff.forEach((id) => {
      const details = votedOffDetails[id];
      if (details?.has('unanimous')) add(id, 'voted_out_unanimously');
      if (details?.has('idol')) add(id, 'voted_out_with_idol');
      if (details?.has('advantage')) add(id, 'voted_out_with_advantage');
    });

    // Quit
    quitPlayers.forEach((id) => add(id, 'quit'));

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

  // --- Episode creation (unchanged) ---

  async function createEpisode() {
    const num = parseInt(episodeNumber, 10);
    if (!num || num < 1) {
      Alert.alert('Error', 'Enter a valid episode number.');
      return;
    }
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
      setEpisodeId(data.id);
    }
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
                .update({ is_finalized: true })
                .eq('id', episodeId);

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

  if (castawaysLoading || !byTribe) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  // --- Episode number entry ---

  if (!episodeId) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.episodeSetup}>
          {/* Past episodes */}
          {pastEpisodes && pastEpisodes.length > 0 && (
            <View style={styles.pastEpisodesSection}>
              <Text style={styles.pastEpisodesTitle}>Logged Episodes</Text>
              {pastEpisodes.map((ep) => (
                <View key={ep.id} style={styles.pastEpisodeRow}>
                  <View style={styles.pastEpisodeInfo}>
                    <Text style={styles.pastEpisodeNumber}>Episode {ep.episode_number}</Text>
                    <Text style={styles.pastEpisodeStatus}>
                      {ep.is_finalized ? 'Finalized' : 'Draft'}
                    </Text>
                  </View>
                  <View style={[styles.statusDot, ep.is_finalized ? styles.statusFinalized : styles.statusDraft]} />
                </View>
              ))}
            </View>
          )}

          {/* New episode entry */}
          <View style={styles.newEpisodeSection}>
            <Text style={styles.setupLabel}>New Episode</Text>
            <TextInput
              style={styles.episodeInput}
              value={episodeNumber}
              onChangeText={setEpisodeNumber}
              keyboardType="number-pad"
              placeholder="Episode number"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={styles.startButton}
              onPress={createEpisode}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.startButtonText}>Start Logging Episode {episodeNumber || '?'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- Main logging UI ---

  const allEvents = buildEvents();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Episode {episodeNumber}</Text>

        {/* 1. Voted Off */}
        <CategoryCard
          title="Voted Off"
          question="Who was voted off this episode?"
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
        </CategoryCard>

        {/* 2. Vote Details — only if someone was voted off */}
        {votedOff.size > 0 && (
          <CategoryCard
            title="Vote Details"
            question="Any special circumstances for the vote?"
            count={Object.values(votedOffDetails).reduce((sum, s) => sum + s.size, 0)}
            expanded={expandedCards.has('voteDetails')}
            onToggle={() => toggleCard('voteDetails')}
          >
            {Array.from(votedOff).map((id) => (
              <View key={id} style={styles.detailSection}>
                <Text style={styles.detailName}>{castawayMap[id]?.name}</Text>
                <View style={styles.detailChips}>
                  {[
                    { key: 'unanimous', label: 'Unanimous' },
                    { key: 'idol', label: 'Had Idol' },
                    { key: 'advantage', label: 'Had Advantage' },
                  ].map(({ key, label }) => {
                    const active = votedOffDetails[id]?.has(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleVotedOffDetail(id, key)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </CategoryCard>
        )}

        {/* 3. Quit */}
        <CategoryCard
          title="Quit"
          question="Did anyone quit this episode?"
          count={quitPlayers.size}
          expanded={expandedCards.has('quit')}
          onToggle={() => toggleCard('quit')}
        >
          <CastawayChipGrid
            castaways={activeCastaways}
            byTribe={byTribe}
            selected={quitPlayers}
            onToggle={(id) => toggleInSet(setQuitPlayers, id)}
          />
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
            castaways={activeCastaways}
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
            castaways={activeCastaways}
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
            castaways={activeCastaways}
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
            castaways={activeCastaways}
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
            castaways={activeCastaways}
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
            castaways={activeCastaways}
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

        {/* 10. Milestones */}
        <CategoryCard
          title="Milestones"
          question="Any milestones this episode?"
          count={Object.values(milestones).reduce((sum, s) => sum + s.size, 0)}
          expanded={expandedCards.has('milestones')}
          onToggle={() => toggleCard('milestones')}
        >
          {MILESTONE_EVENTS.map((event) => {
            const selectedIds = milestones[event] ?? new Set<number>();
            return (
              <View key={event} style={styles.milestoneBlock}>
                <Text style={styles.milestoneLabel}>{EVENT_LABELS[event] ?? event}</Text>
                <CastawayChipGrid
                  castaways={activeCastaways}
                  byTribe={byTribe}
                  selected={selectedIds}
                  onToggle={(id) => toggleMilestone(event, id)}
                />
              </View>
            );
          })}
        </CategoryCard>

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

      <View style={styles.footer}>
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
  setupLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  newEpisodeSection: { gap: 10 },

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
  episodeInput: {
    backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center',
  },
  startButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Main content
  content: { padding: 16, gap: 12, paddingBottom: 100 },
  pageTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 },

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
  detailSection: { gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  detailChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  subDetails: { gap: 4, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border + '60', paddingTop: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },

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
