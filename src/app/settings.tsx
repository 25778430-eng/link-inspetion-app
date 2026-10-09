import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { getMeta, pendingCount } from '../db/local';
import { DIVISION_LABELS } from '../domain/types';
import { useSession } from '../state/session';
import { isDemoMode } from '../sync/supabase';
import { syncNow } from '../sync/sync';
import { Button, Card } from '../ui/components';
import { colors, s } from '../ui/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between' }]}>
      <Text style={s.muted}>{label}</Text>
      <Text style={[s.body, { fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

export default function Settings() {
  const { user, signOut } = useSession();
  const [pending, setPending] = useState(pendingCount());
  const [msg, setMsg] = useState<string | null>(null);
  const lastSync = getMeta('lastSyncAt');

  async function sync() {
    setMsg('Syncing…');
    const r = await syncNow();
    setMsg(r.error ? `Sync failed: ${r.error}` : `Uploaded ${r.uploaded} record(s)`);
    setPending(pendingCount());
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      {user && (
        <Card>
          <Text style={s.label}>Signed in</Text>
          <Text style={s.h2}>{user.name}</Text>
          <Row label="Staff number" value={user.staffNumber} />
          <Row label="Role" value={user.role[0].toUpperCase() + user.role.slice(1)} />
          <Row label="Divisions" value={user.divisions.map((d) => DIVISION_LABELS[d]).join(', ')} />
        </Card>
      )}

      <Card>
        <Text style={s.label}>Data</Text>
        <Row label="Mode" value={isDemoMode ? 'Demo (this device only)' : 'Connected'} />
        <Row label="Waiting to upload" value={String(pending)} />
        <Row label="Last sync" value={lastSync ? new Date(lastSync).toLocaleString() : 'Never'} />
        {msg && <Text style={s.muted}>{msg}</Text>}
        {!isDemoMode && <Button title="Sync now" icon="cloud-upload-outline" variant="outline" onPress={sync} />}
      </Card>

      {user && (
        <Button
          title="Sign out"
          icon="log-out-outline"
          color={colors.fail}
          variant="outline"
          onPress={async () => {
            await signOut();
            router.dismissAll();
            router.replace('/');
          }}
        />
      )}
      <Text style={[s.muted, { textAlign: 'center' }]}>Link Inspection v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </ScrollView>
  );
}
