import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { getMeta, initDb, seedDemoData, setMeta } from '../db/local';
import { SessionProvider } from '../state/session';
import { isDemoMode } from '../sync/supabase';
import { startAutoSync } from '../sync/sync';
import { HeaderIcon } from '../ui/components';
import { colors } from '../ui/theme';

initDb();
if (isDemoMode && getMeta('demoSeeded') !== '1') {
  seedDemoData();
  setMeta('demoSeeded', '1');
}

const settingsButton = () => <HeaderIcon name="settings-sharp" label="Settings" onPress={() => router.push('/settings')} />;

export default function RootLayout() {
  useEffect(() => startAutoSync(), []);
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          headerTitleAlign: 'center',
          headerTitleStyle: { fontWeight: '700', fontSize: 19 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Link Inspection', headerRight: settingsButton }} />
        <Stack.Screen name="home" options={{ title: 'Link Inspection', headerBackVisible: false, headerRight: settingsButton }} />
        <Stack.Screen name="scan" options={{ title: 'Scan asset' }} />
        <Stack.Screen name="inspect/[assetId]" options={{ title: 'Inspection' }} />
        <Stack.Screen name="defects" options={{ title: 'Defects and lock-outs' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
      </Stack>
    </SessionProvider>
  );
}
