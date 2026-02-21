import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EVENT_SCORES,
  EVENT_LABELS,
  SURVIVAL_POINTS_BY_PHASE,
  ICKY_PICK_SCORES,
  PROPHECY_POINTS,
} from '@/lib/constants';
import { colors } from '@/theme/colors';

const PHASE_LABELS: Record<string, string> = {
  episodes_1_3: 'Episodes 1–3',
  episodes_4_6: 'Episodes 4–6',
  episodes_7_9: 'Episodes 7–9',
  episodes_10_12: 'Episodes 10–12',
  final_5: 'Final 5',
  final_4: 'Final 4',
};

const ICKY_LABELS: Record<string, string> = {
  first_boot: 'First Boot',
  pre_merge: 'Pre-Merge',
  jury: 'Jury',
  '3rd': '3rd Place',
  winner: 'Sole Survivor',
};

function PointValue({ points }: { points: number }) {
  const isPositive = points > 0;
  const isNegative = points < 0;
  return (
    <Text
      style={[
        styles.pointValue,
        isPositive && { color: colors.scorePositive },
        isNegative && { color: colors.scoreNegative },
      ]}
    >
      {isPositive ? '+' : ''}{points}
    </Text>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function RuleRow({ label, points }: { label: string; points: number }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={styles.ruleLabel}>{label}</Text>
      <PointValue points={points} />
    </View>
  );
}

export default function ScoringRulesScreen() {
  const insets = useSafeAreaInsets();

  // Placement events shown in the Survival & Placement section instead
  const PLACEMENT_BEFORE = ['first_boot'];
  const PLACEMENT_AFTER = ['placed_3rd', 'placed_runner_up', 'sole_survivor'];

  const eventEntries = Object.entries(EVENT_SCORES).filter(
    ([key]) => key !== 'survived_episode' && ![...PLACEMENT_BEFORE, ...PLACEMENT_AFTER].includes(key),
  ) as [string, number][];

  const placementBeforeEntries = PLACEMENT_BEFORE.map(
    (key) => [key, EVENT_SCORES[key as keyof typeof EVENT_SCORES]] as [string, number],
  );
  const placementAfterEntries = PLACEMENT_AFTER.map(
    (key) => [key, EVENT_SCORES[key as keyof typeof EVENT_SCORES]] as [string, number],
  );

  // Group prophecy points into ranges
  const prophecyRanges = [
    { label: 'Questions 1–3', points: 1 },
    { label: 'Questions 4–7', points: 2 },
    { label: 'Questions 8–9', points: 3 },
    { label: 'Questions 10–16', points: 4 },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
    >
      <Text style={styles.intro}>
        Each player's total score is the sum of three components: Trusted Trio, Icky Pick, and Prophecy.
      </Text>

      {/* Tiebreaker */}
      <View style={styles.tiebreakerCard}>
        <Text style={styles.tiebreakerTitle}>Tiebreaker Order</Text>
        <Text style={styles.tiebreakerText}>
          Total &rarr; Trio &rarr; Prophecy &rarr; Icky &rarr; Alphabetical
        </Text>
      </View>

      {/* Trusted Trio Events */}
      <SectionHeader
        title="Trusted Trio — Events"
        subtitle="Pick 3 castaways. Earn points from their in-game events."
      />
      <View style={styles.card}>
        {eventEntries.map(([key, points]) => (
          <RuleRow
            key={key}
            label={EVENT_LABELS[key] ?? key}
            points={points}
          />
        ))}
      </View>

      {/* Survival & Placement Points */}
      <SectionHeader
        title="Trusted Trio — Survival & Placement"
        subtitle="Points per episode survived, plus bonuses for final placement."
      />
      <View style={styles.card}>
        {placementBeforeEntries.map(([key, points]) => (
          <RuleRow
            key={key}
            label={EVENT_LABELS[key] ?? key}
            points={points}
          />
        ))}
        {Object.entries(SURVIVAL_POINTS_BY_PHASE).map(([phase, points]) => (
          <RuleRow
            key={phase}
            label={PHASE_LABELS[phase] ?? phase}
            points={points}
          />
        ))}
        {placementAfterEntries.map(([key, points]) => (
          <RuleRow
            key={key}
            label={EVENT_LABELS[key] ?? key}
            points={points}
          />
        ))}
      </View>

      {/* Icky Pick */}
      <SectionHeader
        title="Icky Pick"
        subtitle="Pick 1 castaway you think will do poorly. Points based on their final placement."
      />
      <View style={styles.card}>
        {Object.entries(ICKY_PICK_SCORES).map(([key, points]) => (
          <RuleRow
            key={key}
            label={ICKY_LABELS[key] ?? key}
            points={points}
          />
        ))}
      </View>

      {/* Prophecy */}
      <SectionHeader
        title="Prophecy"
        subtitle="16 yes/no predictions. Correct = listed points, wrong = 0."
      />
      <View style={styles.card}>
        {prophecyRanges.map((r) => (
          <RuleRow key={r.label} label={r.label} points={r.points} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  intro: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  tiebreakerCard: {
    backgroundColor: colors.primaryLight + '18',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  tiebreakerTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  tiebreakerText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  sectionHeader: { gap: 2, marginTop: 4 },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderGlass,
  },
  ruleLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    flex: 1,
  },
  pointValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    minWidth: 40,
    textAlign: 'right',
  },
});
