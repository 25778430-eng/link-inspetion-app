import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { getMeta, initDb, seedDemoData, setMeta } from '../db/local';
import { SessionProvider } from '../state/session';
import { isDemoMode } from '../sync/supabase';
import { startAutoSync } from '../sync/sync';
import { colors } from '../ui/theme';

initDb();
if (isDemoMode && getMeta('demoSeeded') !== '1') {
  seedDemoData();
  setMeta('demoSeeded', '1');
}

export default function RootLayout() {
  useEffect(() => startAutoSync(), []);
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#fff' }}>
        <Stack.Screen name="index" options={{ title: 'Link Inspection' }} />
        <Stack.Screen name="home" options={{ title: 'Pre-use inspections', headerBackVisible: false }} />
        <Stack.Screen name="scan" options={{ title: 'Scan asset' }} />
        <Stack.Screen name="inspect/[assetId]" options={{ title: 'Inspection' }} />
        <Stack.Screen name="defects" options={{ title: 'Defects and lock-outs' }} />
      </Stack>
    </SessionProvider>
  );
}
