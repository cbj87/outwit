import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useIsCommissioner } from '@/hooks/useIsCommissioner';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  const isCommissioner = useIsCommissioner();

  return (
    <NativeTabs tintColor={colors.primary}>
      <NativeTabs.Trigger name="index">
        <Label>Leaderboard</Label>
        <Icon sf={{ default: 'trophy', selected: 'trophy.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-picks">
        <Label>My Picks</Label>
        <Icon sf={{ default: 'clipboard', selected: 'clipboard.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="castaways">
        <Label>Castaways</Label>
        <Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="admin" hidden={!isCommissioner}>
        <Label>Admin</Label>
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
