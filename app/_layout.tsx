import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
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
      <Stack.Screen name="castaways/[id]" options={{ presentation: 'card', headerShown: true, title: '', headerBackTitle: 'Back', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.textPrimary, headerShadowVisible: false }} />
      <Stack.Screen name="admin/episode" options={{ presentation: 'card', headerShown: true, title: 'Log Episode', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }} />
      <Stack.Screen name="admin/prophecy" options={{ presentation: 'card', headerShown: true, title: 'Prophecy Outcomes', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }} />
      <Stack.Screen name="admin/reveal" options={{ presentation: 'card', headerShown: true, title: 'Reveal Picks', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AuthGate />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
