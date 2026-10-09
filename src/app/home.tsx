import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { getMeta, listAssets, pendingCount, type AssetWithType } from '../db/local';
import { isDueToday } from '../domain/daily';
import { can } from '../domain/lockout';
import { DIVISION_LABELS, type Division } from '../domain/types';
import { useSession } from '../state/session';
import { syncNow } from '../sync/sync';
import { Badge, Button } from '../ui/components';
import { colors, s, STATUS_LABEL } from '../ui/theme';

export default function Home() {
  const { user, division, setDivision, signOut } = useSession();
  const [assets, setAssets] = useState<AssetWithType[]>([]);
  const [pending, setPending] = useState(0);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (division) setAssets(listAssets(division));
    setPending(pendingCount());
  }, [division]);

  useFocusEffect(reload);

  if (!user) return <Redirect href="/" />;

  async function sync() {
    setSyncMsg('Syncing…');
    const r = await syncNow();
    setSyncMsg(r.error ? `Sync failed: ${r.error}` : `Synced ${r.uploaded} item(s)`);
    reload();
  }

  const due = assets.filter((a) => isDueToday(a.lastInspectedAt) && a.status !== 'locked_out').length;
  const locked = assets.filter((a) => a.status === 'locked_out').length;
  const lastSync = getMeta('lastSyncAt');

  return (
    <View style={s.screen}>
      <View style={[s.pad, { paddingBottom: 0 }]}>
        <Text style={s.muted}>{user.name} · {user.role}</Text>
        <View style={s.row}>
          {user.divisions.map((d: Division) => (
            <Pressable key={d} onPress={() => setDivision(d)} style={[s.badge, { backgroundColor: d === division ? colors.primary : colors.border, paddingVertical: 8, paddingHorizontal: 12 }]}>
              <Text style={{ color: d === division ? '#fff' : colors.text, fontWeight: '700' }}>{DIVISION_LABELS[d]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.body}>{due} due today · {locked} locked out</Text>
        <Text style={s.muted}>
          {pending > 0 ? `${pending} record(s) waiting to upload` : 'All records uploaded'}
          {lastSync ? ` · last sync ${new Date(lastSync).toLocaleTimeString()}` : ''}
        </Text>
        {syncMsg && <Text style={s.muted}>{syncMsg}</Text>}
        <View style={s.row}>
          <Button title="Scan asset" onPress={() => router.push('/scan')} style={{ flex: 1 }} />
          <Button title="Sync" color={colors.na} onPress={sync} style={{ flex: 1 }} />
        </View>
        {(can(user.role, 'viewDashboard') || can(user.role, 'exportTrax')) && (
          <Button title="Defects and lock-outs" color={colors.warn} onPress={() => router.push('/defects')} />
        )}
      </View>
      <FlatList
        data={assets}
        keyExtractor={(a) => a.id}
        contentContainerStyle={s.pad}
        renderItem={({ item }) => {
          const st = STATUS_LABEL[item.status];
          const done = !isDueToday(item.lastInspectedAt);
          return (
            <Pressable onPress={() => router.push(`/inspect/${item.id}`)} style={s.card}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.h2}>{item.fleetNumber}</Text>
                <Text style={s.muted}>{item.station}</Text>
              </View>
              <Text style={s.muted}>{item.typeName}</Text>
              <View style={s.row}>
                <Badge label={st.label} color={st.color} />
                {item.status !== 'locked_out' && <Badge label={done ? 'Done today' : 'Due today'} color={done ? colors.pass : colors.primary} />}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={<Button title="Sign out" color={colors.na} onPress={signOut} />}
      />
    </View>
  );
}
