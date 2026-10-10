import { Lato_300Light, Lato_400Regular, Lato_700Bold, useFonts } from '@expo-google-fonts/lato';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { getMeta, initDb, seedDemoData, setMeta } from '../db/local';
import { SessionProvider } from '../state/session';
import { isDemoMode } from '../sync/supabase';
import { startAutoSync } from '../sync/sync';
import { useTheme } from '../ui/theme';

initDb();
if (isDemoMode && getMeta('demoSeeded') !== '1') {
  seedDemoData();
  setMeta('demoSeeded', '1');
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { c } = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Lato_300Light, Lato_400Regular, Lato_700Bold });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => startAutoSync(), []);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <SessionProvider>
      {/* Every screen opens with the navy header, so the status bar is always light. */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="inspect/[assetId]" />
      </Stack>
    </SessionProvider>
  );
}
