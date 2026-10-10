import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import type { ColorValue } from 'react-native';
import Tabs from 'expo-router/tabs';
import { can } from '../../domain/lockout';
import { useSession } from '../../state/session';
import type { IconName } from '../../ui/components';
import { fonts, useTheme } from '../../ui/theme';

const icon = (name: IconName) => ({ color, focused }: { color: ColorValue; focused: boolean }) => (
  <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={24} color={color as string} />
);

export default function TabsLayout() {
  const { c } = useTheme();
  const { user } = useSession();
  if (!user) return <Redirect href="/" />;
  // Operators see their own defects through the asset; the Defects tab is for people who act on them.
  const showDefects = can(user.role, 'viewDashboard') || can(user.role, 'closeNonCriticalDefect') || can(user.role, 'exportTrax');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
        tabBarActiveTintColor: c.link,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: icon('scan') }} />
      <Tabs.Screen name="defects" options={{ title: 'Defects', tabBarIcon: icon('warning'), href: showDefects ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
