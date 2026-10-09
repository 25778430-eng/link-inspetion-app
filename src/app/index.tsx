import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import { listUsers } from '../db/local';
import { useSession } from '../state/session';
import { isDemoMode } from '../sync/supabase';
import { Button, Card } from '../ui/components';
import { s } from '../ui/theme';

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
            <Text style={s.h2}>{u.name}</Text>
            <Text style={s.muted}>Role: {u.role}</Text>
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
      <Text style={s.h1}>Sign in</Text>
      <Text style={s.muted}>Sign in once while connected. After that the app works offline.</Text>
      <TextInput style={s.input} placeholder="Work email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {error && <Text style={s.error}>{error}</Text>}
      <Button title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy || !email || !password} />
    </ScrollView>
  );
}
