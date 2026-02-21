import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
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
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf={{ default: 'person.circle', selected: 'person.circle.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="admin" hidden>
        <Label>Admin</Label>
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
