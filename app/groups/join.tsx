import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useJoinGroup } from '@/hooks/useJoinGroup';
import { colors } from '@/theme/colors';

export default function JoinGroupScreen() {
  const router = useRouter();
  const joinGroup = useJoinGroup();
  const [code, setCode] = useState('');

  const trimmed = code.trim().toUpperCase();
  const canSubmit = trimmed.length === 6 && !joinGroup.isPending;

  async function handleJoin() {
    if (!canSubmit) return;

    try {
      const group = await joinGroup.mutateAsync(trimmed);
      Alert.alert(
        'Joined!',
        `You are now a member of ${group.name}.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to join group.');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="XXXXXX"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={canSubmit ? handleJoin : undefined}
        />
        <Text style={styles.hint}>Enter the 6-character invite code from the group admin.</Text>
      </View>

      <TouchableOpacity
        style={[styles.joinButton, !canSubmit && styles.disabled]}
        onPress={handleJoin}
        disabled={!canSubmit}
        activeOpacity={0.7}
      >
        {joinGroup.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.joinButtonText}>Join Group</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, justifyContent: 'space-between' },
  form: { gap: 8 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    fontSize: 24,
    color: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    letterSpacing: 6,
    textAlign: 'center',
    fontWeight: '700',
  },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  joinButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
