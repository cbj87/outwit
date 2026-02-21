import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useIsCommissioner } from '@/hooks/useIsCommissioner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

const glassAvailable = isLiquidGlassAvailable();

function Glass({
  style,
  children,
  tintColor,
  isInteractive,
}: {
  style?: any;
  children: React.ReactNode;
  tintColor?: string;
  isInteractive?: boolean;
}) {
  if (glassAvailable) {
    return (
      <GlassView style={style} tintColor={tintColor} isInteractive={isInteractive} colorScheme="light">
        {children}
      </GlassView>
    );
  }
  return <View style={style}>{children}</View>;
}

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const isCommissioner = useIsCommissioner();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Keep input in sync when profile loads or updates externally
  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile?.display_name]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const hasNameChanged = displayName.trim() !== (profile?.display_name ?? '');

  async function handleSaveDisplayName() {
    const trimmed = displayName.trim();
    if (!trimmed || !profile) return;

    setIsSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    setIsSavingName(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await refreshProfile();
    }
  }

  async function handlePickAvatar() {
    if (!profile) return;

    // Lazy-import to avoid crash when native module isn't built yet
    const ImagePicker = await import('expo-image-picker');

    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library to upload an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setIsUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${profile.id}/avatar.${ext}`;

      // Read the file as an ArrayBuffer (blob uploads send 0 bytes in RN)
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType: asset.mimeType ?? `image/${ext}`,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Bust cache with timestamp
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      // Invalidate cached queries so avatar shows everywhere (leaderboard, castaways, etc.)
      queryClient.invalidateQueries({ queryKey: ['all-picks'] });
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const initials = (profile?.display_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={isUploadingAvatar} activeOpacity={0.7}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            {isUploadingAvatar && (
              <View style={styles.avatarLoading}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>Edit</Text>
            </View>
          </View>
        </TouchableOpacity>
        <Text style={styles.emailText}>{profile?.email}</Text>
      </View>

      {/* Display Name */}
      <Glass style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Display Name</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={hasNameChanged ? handleSaveDisplayName : undefined}
          />
          {hasNameChanged && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveDisplayName}
              disabled={isSavingName}
              activeOpacity={0.7}
            >
              {isSavingName ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </Glass>

      {/* Commissioner Panel Link */}
      {isCommissioner && (
        <TouchableOpacity
          onPress={() => router.push('/admin/panel' as any)}
          activeOpacity={0.75}
        >
          <Glass style={styles.commissionerCard} isInteractive>
            <Text style={styles.commissionerEmoji}>🏛️</Text>
            <View style={styles.commissionerContent}>
              <Text style={styles.commissionerTitle}>Commissioner Panel</Text>
              <Text style={styles.commissionerDescription}>
                Manage episodes, prophecy outcomes, and scores
              </Text>
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </Glass>
        </TouchableOpacity>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={signOut} activeOpacity={0.7}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  header: { paddingVertical: 16 },
  headerTitle: { color: colors.primary, fontSize: 22, fontWeight: '800' },

  // Avatar
  avatarSection: { alignItems: 'center', gap: 8, marginBottom: 8 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 32, fontWeight: '800' },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  avatarBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emailText: { color: colors.textSecondary, fontSize: 14 },

  // Display Name
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1,
    fontSize: 17,
    color: colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Commissioner
  commissionerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    overflow: 'hidden',
  },
  commissionerEmoji: { fontSize: 28 },
  commissionerContent: { flex: 1, gap: 4 },
  commissionerTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  commissionerDescription: { color: colors.textSecondary, fontSize: 13 },
  cardChevron: { color: colors.textMuted, fontSize: 22 },

  // Sign Out
  signOutButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
