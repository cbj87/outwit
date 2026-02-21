import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme/colors';
import type { PlayerPick } from '@/hooks/useAllPicks';

const AVATAR_SIZE = 24;
const BORDER_WIDTH = 2;
const OVERLAP = -6;

const TRIO_COLOR = colors.success;   // green ring
const ICKY_COLOR = colors.error;     // red ring

function MiniAvatar({
  player,
  ringColor,
  index,
}: {
  player: PlayerPick;
  ringColor: string;
  index: number;
}) {
  const initials = player.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      style={[
        styles.avatarOuter,
        { borderColor: ringColor, marginLeft: index === 0 ? 0 : OVERLAP },
      ]}
    >
      {player.avatar_url ? (
        <Image source={{ uri: player.avatar_url }} style={styles.avatarImage} contentFit="cover" />
      ) : (
        <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      )}
    </View>
  );
}

export function PickAvatars({
  trio,
  icky,
}: {
  trio: PlayerPick[];
  icky: PlayerPick[];
}) {
  if (trio.length === 0 && icky.length === 0) return null;

  return (
    <View style={styles.container}>
      {trio.length > 0 && (
        <View style={styles.group}>
          {trio.map((p, i) => (
            <MiniAvatar key={p.player_id} player={p} ringColor={TRIO_COLOR} index={i} />
          ))}
        </View>
      )}
      {trio.length > 0 && icky.length > 0 && <View style={styles.divider} />}
      {icky.length > 0 && (
        <View style={styles.group}>
          {icky.map((p, i) => (
            <MiniAvatar key={p.player_id} player={p} ringColor={ICKY_COLOR} index={i} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },
  avatarOuter: {
    width: AVATAR_SIZE + BORDER_WIDTH * 2,
    height: AVATAR_SIZE + BORDER_WIDTH * 2,
    borderRadius: (AVATAR_SIZE + BORDER_WIDTH * 2) / 2,
    borderWidth: BORDER_WIDTH,
    backgroundColor: colors.surface,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
