import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateGroup } from '@/hooks/useCreateGroup';
import { colors } from '@/theme/colors';

export default function CreateGroupScreen() {
  const router = useRouter();
  const createGroup = useCreateGroup();
  const [name, setName] = useState('');

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 2 && !createGroup.isPending;

  async function handleCreate() {
    if (!canSubmit) return;

    try {
      const group = await createGroup.mutateAsync(trimmed);
      Alert.alert(
        'Group Created!',
        `Share invite code: ${group.invite_code}`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to create group.');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Survivor Squad"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={canSubmit ? handleCreate : undefined}
        />
        <Text style={styles.hint}>Choose a name for your group. You can change it later.</Text>
      </View>

      <TouchableOpacity
        style={[styles.createButton, !canSubmit && styles.disabled]}
        onPress={handleCreate}
        disabled={!canSubmit}
        activeOpacity={0.7}
      >
        {createGroup.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>Create Group</Text>
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
    fontSize: 17,
    color: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { color: colors.textMuted, fontSize: 13 },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
