import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { listUsers } from '../db/local';
import { useSession } from '../state/session';
import { isDemoMode } from '../sync/supabase';
import { Button, Card, Logo, type IconName } from '../ui/components';
import { fonts, useTheme } from '../ui/theme';

const ROLE_ICON: Record<string, IconName> = {
  operator: 'construct-outline',
  supervisor: 'eye-outline',
  manager: 'shield-checkmark-outline',
  maintenance: 'build-outline',
  admin: 'settings-outline',
  auditor: 'document-text-outline',
};

function MicrosoftMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 21 21">
      <Rect x={0} y={0} width={10} height={10} fill="#F25022" />
      <Rect x={11} y={0} width={10} height={10} fill="#7FBA00" />
      <Rect x={0} y={11} width={10} height={10} fill="#00A4EF" />
      <Rect x={11} y={11} width={10} height={10} fill="#FFB900" />
    </Svg>
  );
}

export default function SignIn() {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, ready, signIn, signInDemo } = useSession();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (user) return <Redirect href="/home" />;

  async function submit() {
    setBusy(true);
    setError(await signIn(email.trim(), password));
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: c.brand, paddingTop: insets.top + 48, paddingBottom: 72, paddingHorizontal: 24, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, alignItems: 'center', gap: 16 }}>
          <Logo size={124} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: '#FFFFFF' }}>LinkSpec</Text>
          <Text style={{ fontFamily: fonts.light, fontSize: 15, color: c.onPrimaryMuted, textAlign: 'center' }}>Pre-use inspections for ramp, towing and maintenance equipment</Text>
        </View>

        <Card style={{ marginHorizontal: 20, marginTop: -40, padding: 20, gap: 14 }}>
          {isDemoMode ? (
            <>
              <Text style={s.h2}>Demo mode</Text>
              <Text style={s.soft}>No server is connected, so data stays on this phone. Pick a demo user to try each role.</Text>
              {listUsers().map((u) => (
                <Pressable
                  key={u.id}
                  accessibilityRole="button"
                  onPress={() => signInDemo(u.id)}
                  style={({ pressed }) => [s.row, { borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={ROLE_ICON[u.role] ?? 'person-outline'} size={22} color={c.link} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.h3}>{u.name}</Text>
                    <Text style={s.caption}>{u.role[0].toUpperCase() + u.role.slice(1)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={c.muted} />
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Text style={s.h2}>Sign in</Text>
              <Text style={s.soft}>Use your Airlink Microsoft account. Your role and division come from your profile.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => Alert.alert('Microsoft sign-in', 'Microsoft sign-in is being set up with Airlink IT. Use email sign-in for now.')}
                style={({ pressed }) => [s.button, { backgroundColor: c.primary, gap: 12, opacity: pressed ? 0.85 : 1 }]}
              >
                <MicrosoftMark />
                <Text style={[s.buttonText, { color: c.onPrimary }]}>Sign in with Microsoft</Text>
              </Pressable>
              {!showEmail ? (
                <Button variant="ghost" color={c.link} title="Contractor? Sign in with email" onPress={() => setShowEmail(true)} />
              ) : (
                <View style={{ gap: 12 }}>
                  <Text style={s.fieldLabel}>Work email</Text>
                  <TextInput style={s.input} placeholderTextColor={c.faint} placeholder="Work email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
                  <Text style={s.fieldLabel}>Password</Text>
                  <TextInput style={s.input} placeholderTextColor={c.faint} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
                  {error && <Text style={s.error}>{error}</Text>}
                  <Button variant="outline" title={busy ? 'Signing in…' : 'Sign in with email'} onPress={submit} disabled={busy || !email || !password} />
                </View>
              )}
            </>
          )}
        </Card>

        <View style={[s.row, { justifyContent: 'center', marginTop: 'auto', paddingTop: 24, gap: 8 }]}>
          <Ionicons name="wifi-outline" size={16} color={c.muted} />
          <Text style={s.caption}>Sign in once online. Works offline after that.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
