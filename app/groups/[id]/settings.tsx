import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useLeaveGroup } from '@/hooks/useLeaveGroup';
import { colors } from '@/theme/colors';
import type { Group } from '@/types';

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  const leaveGroup = useLeaveGroup();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<{ user_id: string; display_name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isCreator = group?.created_by === userId;

  useEffect(() => {
    async function load() {
      const [groupResult, membersResult] = await Promise.all([
        supabase.from('groups').select('*').eq('id', id).single(),
        supabase
          .from('group_members')
          .select('user_id, profiles(display_name)')
          .eq('group_id', id),
      ]);

      if (groupResult.data) {
        setGroup(groupResult.data as Group);
        setGroupName(groupResult.data.name);
      }

      if (membersResult.data) {
        setMembers(
          (membersResult.data as any[]).map((m) => ({
            user_id: m.user_id,
            display_name: (m.profiles as any)?.display_name ?? 'Unknown',
          })),
        );
      }

      setIsLoading(false);
    }
    load();
  }, [id]);

  async function handleSaveName() {
    if (!group || !groupName.trim()) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('groups')
      .update({ name: groupName.trim() })
      .eq('id', group.id);
    setIsSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setGroup({ ...group, name: groupName.trim() });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
    }
  }

  function handleLeave() {
    if (!group) return;
    Alert.alert(
      'Leave Group?',
      `Are you sure you want to leave ${group.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup.mutateAsync(group.id);
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Failed to leave group.');
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Group not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Invite Code */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INVITE CODE</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText}>{group.invite_code}</Text>
          <Text style={styles.codeHint}>Share this code with friends to join</Text>
        </View>
      </View>

      {/* Group Name */}
      {isCreator && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GROUP NAME</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={styles.nameInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            {groupName.trim() !== group.name && (
              <TouchableOpacity style={styles.saveNameButton} onPress={handleSaveName} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveNameText}>Save</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Members */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MEMBERS ({members.length})</Text>
        {members.map((m) => (
          <View key={m.user_id} style={styles.memberRow}>
            <Text style={styles.memberName}>{m.display_name}</Text>
            {m.user_id === group.created_by && (
              <Text style={styles.memberBadge}>Admin</Text>
            )}
          </View>
        ))}
      </View>

      {/* Leave Group */}
      <TouchableOpacity style={styles.leaveButton} onPress={handleLeave} activeOpacity={0.7}>
        <Text style={styles.leaveButtonText}>Leave Group</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { color: colors.textSecondary, fontSize: 16 },
  section: { gap: 8 },
  sectionTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  codeRow: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, alignItems: 'center', gap: 6 },
  codeText: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: 6 },
  codeHint: { color: colors.textMuted, fontSize: 13 },
  nameRow: { flexDirection: 'row', gap: 8 },
  nameInput: {
    flex: 1,
    fontSize: 17,
    color: colors.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveNameButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  saveNameText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  memberName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  memberBadge: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  leaveButton: {
    borderWidth: 1,
    borderColor: colors.error + '40',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  leaveButtonText: { color: colors.error, fontSize: 15, fontWeight: '600' },
});
