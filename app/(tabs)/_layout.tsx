import { Tabs } from 'expo-router';
import { useIsCommissioner } from '@/hooks/useIsCommissioner';
import { colors } from '@/theme/colors';

// Simple icon text placeholders (replace with vector icons when expo-icons added)
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const { Text } = require('react-native');
  return (
    <Text style={{ fontSize: 20, color: focused ? colors.primary : colors.textMuted }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const isCommissioner = useIsCommissioner();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ focused }) => <TabIcon label="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="my-picks"
        options={{
          title: 'My Picks',
          tabBarIcon: ({ focused }) => <TabIcon label="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="castaways"
        options={{
          title: 'Castaways',
          tabBarIcon: ({ focused }) => <TabIcon label="🌴" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={
          isCommissioner
            ? {
                title: 'Admin',
                tabBarIcon: ({ focused }) => <TabIcon label="⚙️" focused={focused} />,
              }
            : {
                href: null, // Hides tab entirely for non-commissioners
              }
        }
      />
    </Tabs>
  );
}
