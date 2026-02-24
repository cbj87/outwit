import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

function AuthGate() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="picks/submit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="player/[id]" options={{ presentation: 'card', headerShown: true, title: '', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="castaways/[id]" options={{ presentation: 'card', headerShown: true, title: '', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="admin/panel" options={{ presentation: 'card', headerShown: true, title: 'Commissioner Panel', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary }} />
      <Stack.Screen name="admin/episode" options={{ presentation: 'card', headerShown: true, title: 'Log Episode', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }} />
      <Stack.Screen name="admin/prophecy" options={{ presentation: 'card', headerShown: true, title: 'Prophecy Outcomes', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }} />
      <Stack.Screen name="admin/tribes" options={{ presentation: 'card', headerShown: true, title: 'Manage Tribes', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }} />
      <Stack.Screen name="prophecy/status" options={{ presentation: 'card', headerShown: true, title: 'Prophecy Status', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="episodes/index" options={{ presentation: 'card', headerShown: true, title: 'Episode Recaps', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="episodes/[id]" options={{ presentation: 'card', headerShown: true, title: '', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="scoring-rules" options={{ presentation: 'card', headerShown: true, title: 'Scoring Rules', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="groups/create" options={{ presentation: 'modal', headerShown: true, title: 'Create Group', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="groups/join" options={{ presentation: 'modal', headerShown: true, title: 'Join Group', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="groups/[id]/settings" options={{ presentation: 'card', headerShown: true, title: 'Group Settings', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  // Keep Supabase tokens fresh — required for React Native where
  // setInterval-based auto-refresh can stall when the app is backgrounded.
  useEffect(() => {
    supabase.auth.startAutoRefresh();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AuthGate />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
