import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useCastaways } from '@/hooks/useCastaways';
import { useTribeColors, useTribeColorMutation } from '@/hooks/useTribeColors';
import { colors } from '@/theme/colors';
import type { Castaway } from '@/types';

/* ─── Constants ──────────────────────────────────────────────────── */

const CHIP_HEIGHT = 40;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

const COLOR_PRESETS = [
  '#2E7D32', // forest green
  '#1565C0', // ocean blue
  '#F57F17', // warm amber
  '#8E24AA', // purple
  '#D84315', // burnt orange
  '#00838F', // teal
  '#C62828', // deep red
  '#8E8E93', // gray
  '#4E342E', // brown
  '#1B5E20', // dark green
];

/* ─── Types ──────────────────────────────────────────────────────── */

interface TribeLayout {
  tribe: string;
  /** absolute screen Y (from measureInWindow) */
  y: number;
  height: number;
}

/* ─── Draggable Chip ─────────────────────────────────────────────── */

function DraggableChip({
  castaway,
  isChanged,
  tribeColorMap,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTap,
}: {
  castaway: Castaway;
  isChanged: boolean;
  tribeColorMap: Record<string, string>;
  onDragStart: (id: number) => void;
  onDragMove: (y: number) => void;
  onDragEnd: (id: number) => void;
  onTap: (c: Castaway) => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isActive = useSharedValue(false);
  const startY = useSharedValue(0);

  const originalColor = tribeColorMap[castaway.original_tribe] ?? colors.textMuted;

  const gesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((e) => {
      isActive.value = true;
      zIndex.value = 1000;
      scale.value = withSpring(1.08, SPRING_CONFIG);
      opacity.value = 0.9;
      startY.value = e.absoluteY - e.y;
      runOnJS(onDragStart)(castaway.id);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      runOnJS(onDragMove)(e.absoluteY);
    })
    .onEnd(() => {
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      scale.value = withSpring(1, SPRING_CONFIG);
      opacity.value = 1;
      zIndex.value = 0;
      isActive.value = false;
      runOnJS(onDragEnd)(castaway.id);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          style={[styles.chip, isChanged && styles.chipChanged]}
          onPress={() => onTap(castaway)}
          activeOpacity={0.7}
        >
          <View style={[styles.chipDot, { backgroundColor: originalColor }]} />
          <Text style={styles.chipText}>{castaway.name}</Text>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

/* ─── Static Chip (eliminated castaways — not draggable) ─────────── */

function StaticChip({ castaway, tribeColorMap }: { castaway: Castaway; tribeColorMap: Record<string, string> }) {
  const originalColor = tribeColorMap[castaway.original_tribe] ?? colors.textMuted;
  return (
    <View style={[styles.chip, styles.chipEliminated]}>
      <View style={[styles.chipDot, { backgroundColor: originalColor, opacity: 0.4 }]} />
      <Text style={[styles.chipText, styles.chipTextEliminated]}>{castaway.name}</Text>
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────── */

export default function ManageTribesScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: castaways, isLoading } = useCastaways();
  const scrollRef = useRef<ScrollView>(null);
  const tribeColorMap = useTribeColors();
  const colorMutation = useTribeColorMutation();

  // Pending changes: castaway id → new tribe name
  const [changes, setChanges] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Color picker state: which tribe is being edited (null = closed)
  const [colorPickerTribe, setColorPickerTribe] = useState<string | null>(null);

  // Drag state
  const [dragCastawayId, setDragCastawayId] = useState<number | null>(null);
  const [hoveredTribe, setHoveredTribe] = useState<string | null>(null);
  const tribeViewRefs = useRef<Record<string, View | null>>({});
  const measuredLayoutsRef = useRef<TribeLayout[]>([]);

  // All castaways — active first, then eliminated
  const sortedCastaways = useMemo(
    () =>
      [...(castaways ?? [])].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [castaways],
  );

  // Group by current_tribe (with pending changes applied)
  const grouped = useMemo(() => {
    const result: Record<string, Castaway[]> = {};
    for (const c of sortedCastaways) {
      const tribe = changes[c.id] ?? c.current_tribe;
      if (!result[tribe]) result[tribe] = [];
      result[tribe].push(c);
    }
    return result;
  }, [sortedCastaways, changes]);

  const tribes = Object.keys(grouped).sort();

  // All tribe names currently in use (including pending)
  const allTribeNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of sortedCastaways) {
      names.add(changes[c.id] ?? c.current_tribe);
    }
    return Array.from(names).sort();
  }, [sortedCastaways, changes]);

  const hasChanges = Object.keys(changes).length > 0;

  /* ── Assignment ────────────────────────────────────────────── */

  const assignToTribe = useCallback(
    (castawayId: number, tribe: string) => {
      setChanges((prev) => {
        const castaway = sortedCastaways.find((c) => c.id === castawayId);
        if (castaway && castaway.current_tribe === tribe) {
          const next = { ...prev };
          delete next[castawayId];
          return next;
        }
        return { ...prev, [castawayId]: tribe };
      });
    },
    [sortedCastaways],
  );

  /* ── Drag helpers ────────────────────────────────────────────── */

  /** Measure every registered tribe view in screen coordinates */
  const measureAllTribeViews = useCallback(() => {
    const refs = tribeViewRefs.current;
    const entries = Object.entries(refs);
    const results: TribeLayout[] = [];

    for (const [tribe, viewRef] of entries) {
      if (!viewRef) continue;
      viewRef.measureInWindow((x, y, width, height) => {
        results.push({ tribe, y, height });
      });
    }

    // measureInWindow is synchronous on iOS, so results are filled immediately
    measuredLayoutsRef.current = results;
  }, []);

  /* ── Drag handlers ─────────────────────────────────────────── */

  const handleDragStart = useCallback((id: number) => {
    measureAllTribeViews();
    setDragCastawayId(id);
  }, [measureAllTribeViews]);

  const handleDragMove = useCallback(
    (absoluteY: number) => {
      const layouts = measuredLayoutsRef.current;
      let found: string | null = null;

      for (const layout of layouts) {
        if (absoluteY >= layout.y && absoluteY <= layout.y + layout.height) {
          found = layout.tribe;
          break;
        }
      }

      setHoveredTribe(found);
    },
    [],
  );

  const handleDragEnd = useCallback(
    (castawayId: number) => {
      if (hoveredTribe && hoveredTribe !== '__NEW__') {
        // Get the castaway's current tribe (with pending changes)
        const castaway = sortedCastaways.find((c) => c.id === castawayId);
        const currentTribe = castaway ? (changes[castaway.id] ?? castaway.current_tribe) : null;
        if (currentTribe !== hoveredTribe) {
          assignToTribe(castawayId, hoveredTribe);
        }
      } else if (hoveredTribe === '__NEW__') {
        // Prompt for new tribe name
        Alert.prompt(
          'New Tribe Name',
          'Enter the name for the new tribe:',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create & Move',
              onPress: (name?: string) => {
                const trimmed = (name ?? '').trim().toUpperCase();
                if (trimmed) {
                  assignToTribe(castawayId, trimmed);
                }
              },
            },
          ],
          'plain-text',
        );
      }
      setDragCastawayId(null);
      setHoveredTribe(null);
    },
    [hoveredTribe, assignToTribe, sortedCastaways, changes],
  );

  /* ── Tap fallback (Alert-based picker) ─────────────────────── */

  const showTribePicker = useCallback(
    (castaway: Castaway) => {
      const currentTribe = changes[castaway.id] ?? castaway.current_tribe;
      const options = allTribeNames.filter((t) => t !== currentTribe);

      Alert.alert(
        `Move ${castaway.name}`,
        `Currently on ${currentTribe}. Pick a new tribe:`,
        [
          ...options.map((tribe) => ({
            text: tribe,
            onPress: () => assignToTribe(castaway.id, tribe),
          })),
          {
            text: 'New Tribe\u2026',
            onPress: () => {
              Alert.prompt(
                'New Tribe Name',
                `Enter the tribe name for ${castaway.name}:`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Move',
                    onPress: (name?: string) => {
                      const trimmed = (name ?? '').trim().toUpperCase();
                      if (trimmed) assignToTribe(castaway.id, trimmed);
                    },
                  },
                ],
                'plain-text',
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    },
    [allTribeNames, changes, assignToTribe],
  );

  /* ── Save ──────────────────────────────────────────────────── */

  async function handleSave() {
    if (!hasChanges) return;

    Alert.alert(
      'Update Tribes',
      `This will reassign ${Object.keys(changes).length} castaway(s) to new tribes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            setIsSaving(true);
            try {
              for (const [idStr, tribe] of Object.entries(changes)) {
                const { error } = await supabase
                  .from('castaways')
                  .update({ current_tribe: tribe })
                  .eq('id', Number(idStr));
                if (error) throw error;
              }
              queryClient.invalidateQueries({ queryKey: ['castaways'] });
              setChanges({});
              Alert.alert('Done', 'Tribe assignments updated.');
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Failed to update tribes.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  }

  /* ── Ref registration ─────────────────────────────────────── */

  const registerTribeRef = useCallback(
    (tribe: string) => (ref: View | null) => {
      tribeViewRefs.current[tribe] = ref;
    },
    [],
  );

  /* ── Render ────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        scrollEventThrottle={16}
      >
        <Text style={styles.subtitle}>
          Long-press and drag a castaway to move them between tribes. Tap to use the picker.
        </Text>

        {tribes.map((tribe) => {
          const tribeColor = tribeColorMap[tribe] ?? colors.textMuted;
          const members = grouped[tribe] ?? [];
          const isHoverTarget =
            hoveredTribe === tribe && dragCastawayId !== null;
          const isPickingColor = colorPickerTribe === tribe;

          return (
            <View
              key={tribe}
              ref={registerTribeRef(tribe)}
              style={[styles.tribeBlock, isHoverTarget && styles.tribeBlockHovered]}
            >
              <View style={[styles.tribeHeader, { borderLeftColor: tribeColor }]}>
                <View style={styles.tribeNameRow}>
                  <TouchableOpacity
                    onPress={() => setColorPickerTribe(isPickingColor ? null : tribe)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: tribeColor }]} />
                  </TouchableOpacity>
                  <Text style={[styles.tribeName, { color: tribeColor }]}>{tribe}</Text>
                </View>
                <Text style={styles.tribeCount}>{members.filter((m) => m.is_active).length} active</Text>
              </View>
              {isPickingColor && (
                <View style={styles.colorPicker}>
                  {COLOR_PRESETS.map((hex) => (
                    <TouchableOpacity
                      key={hex}
                      onPress={() => {
                        colorMutation.mutate({ tribe, color: hex });
                        setColorPickerTribe(null);
                      }}
                      style={[
                        styles.colorOption,
                        { backgroundColor: hex },
                        hex === tribeColor && styles.colorOptionSelected,
                      ]}
                    />
                  ))}
                </View>
              )}
              <View style={styles.chipRow}>
                {members.map((c) => {
                  if (!c.is_active) {
                    return <StaticChip key={c.id} castaway={c} tribeColorMap={tribeColorMap} />;
                  }
                  const isChanged = changes[c.id] !== undefined;
                  return (
                    <DraggableChip
                      key={c.id}
                      castaway={c}
                      isChanged={isChanged}
                      tribeColorMap={tribeColorMap}
                      onDragStart={handleDragStart}
                      onDragMove={handleDragMove}
                      onDragEnd={handleDragEnd}
                      onTap={showTribePicker}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* New Tribe drop zone */}
        <View
          ref={registerTribeRef('__NEW__')}
          style={[
            styles.newTribeZone,
            hoveredTribe === '__NEW__' && dragCastawayId !== null && styles.newTribeZoneHovered,
          ]}
        >
          <Text style={[
            styles.newTribeZoneText,
            hoveredTribe === '__NEW__' && dragCastawayId !== null && styles.newTribeZoneTextHovered,
          ]}>
            + New Tribe
          </Text>
          <Text style={styles.newTribeZoneHint}>
            Drag a castaway here to create a new tribe
          </Text>
        </View>
      </ScrollView>

      {hasChanges && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.discardButton} onPress={() => setChanges({})}>
            <Text style={styles.discardText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.disabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>
                Save Changes ({Object.keys(changes).length})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: { padding: 16, gap: 20 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },

  /* Tribe sections */
  tribeBlock: {
    gap: 8,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tribeBlockHovered: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  tribeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 4,
  },
  tribeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorSwatch: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
  },
  tribeName: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  tribeCount: { color: colors.textMuted, fontSize: 12 },

  /* Color picker */
  colorPicker: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingVertical: 4, paddingHorizontal: 2,
  },
  colorOption: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: colors.textPrimary,
  },

  /* Chips */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    height: CHIP_HEIGHT,
  },
  chipChanged: { borderColor: colors.warning, backgroundColor: colors.warning + '12' },
  chipEliminated: { opacity: 0.45, borderStyle: 'dashed' as any },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  chipTextEliminated: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },

  /* New Tribe zone */
  newTribeZone: {
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' as any,
    borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center',
    gap: 4,
  },
  newTribeZoneHovered: {
    borderColor: colors.success, backgroundColor: colors.success + '10',
  },
  newTribeZoneText: {
    color: colors.textSecondary, fontSize: 16, fontWeight: '700',
  },
  newTribeZoneTextHovered: { color: colors.success },
  newTribeZoneHint: {
    color: colors.textMuted, fontSize: 11,
  },

  /* Footer */
  footer: {
    flexDirection: 'row', padding: 16, gap: 12,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  discardButton: {
    flex: 1, paddingVertical: 14, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  discardText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  saveButton: {
    flex: 2, paddingVertical: 14, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
