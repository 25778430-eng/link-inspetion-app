import { Redirect } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { listUsers } from '../db/local';
import { useSession } from '../state/session';
import { isDemoMode } from '../sync/supabase';
import { Button, Card, type IconName } from '../ui/components';
import { colors, s } from '../ui/theme';

const ROLE_ICON: Record<string, IconName> = {
  operator: 'construct-outline',
  supervisor: 'eye-outline',
  manager: 'shield-checkmark-outline',
  maintenance: 'build-outline',
  admin: 'settings-outline',
  auditor: 'document-text-outline',
};

export default function SignIn() {
  const { user, ready, signIn, signInDemo } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (user) return <Redirect href="/home" />;

  if (isDemoMode) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.pad}>
        <Text style={s.h1}>Demo mode</Text>
        <Text style={s.muted}>No backend is connected, so data stays on this device. Pick a demo user to try each role.</Text>
        {listUsers().map((u) => (
          <Card key={u.id}>
            <View style={s.row}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={ROLE_ICON[u.role] ?? 'person-outline'} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.h2}>{u.name}</Text>
                <Text style={s.muted}>Role: {u.role}</Text>
              </View>
            </View>
            <Button title={`Sign in as ${u.role}`} onPress={() => signInDemo(u.id)} />
          </Card>
        ))}
      </ScrollView>
    );
  }

  async function submit() {
    setBusy(true);
    setError(await signIn(email.trim(), password));
    setBusy(false);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', gap: 10, marginVertical: 16 }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="clipboard-outline" size={36} color={colors.onPrimary} />
        </View>
        <Text style={s.h1}>Sign in</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>Sign in once while connected. After that the app works offline.</Text>
      </View>
      <TextInput style={s.input} placeholder="Work email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {error && <Text style={s.error}>{error}</Text>}
      <Button icon="log-in-outline" title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy || !email || !password} />
    </ScrollView>
  );
}
