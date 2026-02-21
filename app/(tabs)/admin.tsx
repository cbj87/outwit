import { Redirect } from 'expo-router';

// Hidden tab — kept for Expo Router file-based routing.
// Commissioner panel is accessed from Profile > Commissioner Panel.
export default function AdminRedirect() {
  return <Redirect href="/(tabs)/profile" />;
}
