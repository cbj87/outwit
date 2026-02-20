import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCastawaysByTribe } from '@/hooks/useCastaways';
import { EVENT_LABELS } from '@/lib/constants';
import { colors, tribeColors } from '@/theme/colors';
import type { Castaway, EventType, Tribe } from '@/types';

const SCOREABLE_EVENTS: EventType[] = [
  'survived_episode',
  'idol_found',
  'advantage_found',
  'individual_immunity_win',
  'individual_reward_win',
  'idol_played_correct',
  'idol_played_incorrect',
  'shot_in_dark_success',
  'shot_in_dark_fail',
  'fire_making_win',
  'final_immunity_win',
  'voted_out_with_idol',
  'voted_out_with_advantage',
  'voted_out_unanimously',
  'quit',
  'first_boot',
  'made_jury',
  'placed_3rd',
  'placed_runner_up',
  'sole_survivor',
];

export default function EpisodeScreen() {
  const queryClient = useQueryClient();
  const { byTribe, isLoading: castawaysLoading } = useCastawaysByTribe();
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [episodeId, setEpisodeId] = useState<number | null>(null);
  const [events, setEvents] = useState<Record<string, Set<EventType>>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

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

  function toggleEvent(castawayId: number, event: EventType) {
    setEvents((prev) => {
      const key = String(castawayId);
      const current = new Set(prev[key] ?? []);
      if (current.has(event)) {
        current.delete(event);
      } else {
        current.add(event);
      }
      return { ...prev, [key]: current };
    });
  }

  async function handleFinalize() {
    if (!episodeId) return;

    Alert.alert(
      'Finalize Episode',
      'This will save all events and recalculate all player scores. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          style: 'destructive',
          onPress: async () => {
            setIsFinalizing(true);
            try {
              // Save all events
              const eventsToInsert = Object.entries(events).flatMap(([castawayId, eventSet]) =>
                Array.from(eventSet).map((event_type) => ({
                  episode_id: episodeId,
                  castaway_id: parseInt(castawayId, 10),
                  event_type,
                })),
              );

              if (eventsToInsert.length > 0) {
                const { error } = await supabase
                  .from('castaway_events')
                  .upsert(eventsToInsert, { onConflict: 'episode_id,castaway_id,event_type' });
                if (error) throw error;
              }

              // Mark episode finalized
              await supabase
                .from('episodes')
                .update({ is_finalized: true })
                .eq('id', episodeId);

              // Update season config current episode
              await supabase
                .from('season_config')
                .update({ current_episode: parseInt(episodeNumber, 10) })
                .eq('id', 1);

              // Call calculate-scores Edge Function
              const { error: fnError } = await supabase.functions.invoke('calculate-scores', {
                body: { episode_id: episodeId },
              });

              if (fnError) throw fnError;

              queryClient.invalidateQueries();
              Alert.alert('Episode Finalized', 'Scores have been updated for all players.');
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

  if (castawaysLoading || !byTribe) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (!episodeId) {
    return (
      <View style={styles.container}>
        <View style={styles.episodeSetup}>
          <Text style={styles.setupLabel}>Episode Number</Text>
          <TextInput
            style={styles.episodeInput}
            value={episodeNumber}
            onChangeText={setEpisodeNumber}
            keyboardType="number-pad"
            placeholder="e.g. 1"
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={styles.startButton}
            onPress={createEpisode}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.startButtonText}>Start Logging Episode {episodeNumber || '?'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Episode {episodeNumber} Events</Text>
        {(['VATU', 'CILA', 'KALO'] as Tribe[]).map((tribe) => (
          <View key={tribe} style={styles.tribeSection}>
            <Text style={[styles.tribeName, { color: tribeColors[tribe] }]}>{tribe}</Text>
            {(byTribe[tribe] ?? []).map((castaway: Castaway) => (
              <CastawayEventPanel
                key={castaway.id}
                castaway={castaway}
                selectedEvents={events[String(castaway.id)] ?? new Set()}
                onToggle={(event) => toggleEvent(castaway.id, event)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.finalizeButton, isFinalizing && styles.disabled]}
          onPress={handleFinalize}
          disabled={isFinalizing}
        >
          {isFinalizing ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.finalizeText}>Finalize Episode & Update Scores</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CastawayEventPanel({
  castaway, selectedEvents, onToggle,
}: {
  castaway: Castaway;
  selectedEvents: Set<EventType>;
  onToggle: (event: EventType) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.castawayPanel}>
      <TouchableOpacity style={styles.castawayPanelHeader} onPress={() => setExpanded((e) => !e)}>
        <Text style={styles.castawayPanelName}>{castaway.name}</Text>
        <Text style={styles.castawayPanelCount}>
          {selectedEvents.size > 0 ? `${selectedEvents.size} events` : ''}
        </Text>
        <Text style={styles.expandChevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.eventList}>
          {SCOREABLE_EVENTS.map((event) => (
            <View key={event} style={styles.eventToggleRow}>
              <Text style={styles.eventToggleLabel}>{EVENT_LABELS[event] ?? event}</Text>
              <Switch
                value={selectedEvents.has(event)}
                onValueChange={() => onToggle(event)}
                trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                thumbColor={colors.textPrimary}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  episodeSetup: { padding: 24, gap: 12 },
  setupLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  episodeInput: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  startButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  startButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 16, paddingBottom: 100 },
  pageTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  tribeSection: { gap: 8 },
  tribeName: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  castawayPanel: { backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden' },
  castawayPanelHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  castawayPanelName: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  castawayPanelCount: { color: colors.primary, fontSize: 12 },
  expandChevron: { color: colors.textMuted, fontSize: 14 },
  eventList: { borderTopWidth: 1, borderTopColor: colors.border },
  eventToggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '80' },
  eventToggleLabel: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  finalizeButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  finalizeText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
