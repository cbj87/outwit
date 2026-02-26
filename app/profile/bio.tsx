import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useBioQuestions } from '@/hooks/useBioQuestions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

const glassAvailable = isLiquidGlassAvailable();

function Glass({ style, children }: { style?: any; children: React.ReactNode }) {
  if (glassAvailable) {
    return (
      <GlassView style={style} colorScheme="light">
        {children}
      </GlassView>
    );
  }
  return <View style={style}>{children}</View>;
}

export default function BioEditScreen() {
  const { profile, refreshProfile } = useAuth();
  const { questions } = useBioQuestions();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from profile
  useEffect(() => {
    if (profile?.survivor_bio) {
      setAnswers({ ...(profile.survivor_bio as Record<string, string>) });
    }
  }, [profile?.survivor_bio]);

  function updateAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  const hasChanges = (() => {
    const existing = (profile?.survivor_bio as Record<string, string>) ?? {};
    for (const q of questions) {
      const current = (answers[q.key] ?? '').trim();
      const original = (existing[q.key] ?? '').trim();
      if (current !== original) return true;
    }
    return false;
  })();

  async function handleSave() {
    if (!profile || !hasChanges) return;

    setIsSaving(true);

    // Strip empty answers so we only store filled ones
    const cleaned: Record<string, string> = {};
    for (const q of questions) {
      const val = (answers[q.key] ?? '').trim();
      if (val) cleaned[q.key] = val;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ survivor_bio: cleaned, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    setIsSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    await refreshProfile();
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Fill out your Survivor bio so your league-mates can get to know your game.
        </Text>

        {questions.map((q) => (
          <Glass key={q.key} style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>{q.label}</Text>
            <TextInput
              style={[styles.input, q.key === 'bio' && styles.inputMultiline]}
              value={answers[q.key] ?? ''}
              onChangeText={(text) => updateAnswer(q.key, text)}
              placeholder={q.key === 'bio' ? 'Write your Survivor bio...' : 'Your answer...'}
              placeholderTextColor={colors.textMuted}
              multiline={q.key === 'bio'}
              numberOfLines={q.key === 'bio' ? 4 : 1}
              textAlignVertical={q.key === 'bio' ? 'top' : 'center'}
              autoCorrect
              autoCapitalize="sentences"
              returnKeyType={q.key === 'bio' ? 'default' : 'done'}
            />
          </Glass>
        ))}
      </ScrollView>

      {/* Sticky save button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },

  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },

  fieldCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: 10,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
