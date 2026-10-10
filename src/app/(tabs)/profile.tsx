import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { getMeta, listDefects, listInspections, pendingCount, type InspectionSummary } from '../../db/local';
import { sastDay } from '../../domain/daily';
import { DIVISION_LABELS } from '../../domain/types';
import { useSession } from '../../state/session';
import { isDemoMode } from '../../sync/supabase';
import { syncNow } from '../../sync/sync';
import { Badge, Button, Card, ScreenHeader, Stat } from '../../ui/components';
import { fonts, statusStyle, useTheme } from '../../ui/theme';

function dayLabel(iso: string) {
  const day = sastDay(iso);
  if (day === sastDay(new Date())) return 'Today';
  if (day === sastDay(new Date(Date.now() - 86400000))) return 'Yesterday';
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function Profile() {
  const { c, s } = useTheme();
  const { user, signOut } = useSession();
  const [history, setHistory] = useState<InspectionSummary[]>([]);
  const [defectsRaised, setDefectsRaised] = useState(0);
  const [pending, setPending] = useState(0);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);

  const reload = useCallback(() => {
    if (!user) return;
    setHistory(listInspections({ userId: user.id }));
    const monthStart = new Date(Date.now() - 30 * 86400000).toISOString();
    setDefectsRaised(listDefects().filter((d) => d.raisedBy === user.id && d.raisedAt >= monthStart).length);
    setPending(pendingCount());
  }, [user]);
  useFocusEffect(reload);
  if (!user) return null;

  const monthCount = history.filter((h) => (h.inspection.submittedAt ?? '') >= new Date(Date.now() - 30 * 86400000).toISOString()).length;
  const lastSync = getMeta('lastSyncAt');
  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  async function sync() {
    setSyncMsg('Syncing…');
    const r = await syncNow();
    setSyncMsg(r.error ? `Sync failed: ${r.error}` : null);
    reload();
  }

  const shown = history.slice(0, limit);

  return (
    <FlatList
      style={s.screen}
      data={shown}
      keyExtractor={(x) => x.inspection.id}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 10 }}>
          <ScreenHeader>
            <View style={[s.row, { gap: 14 }]}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#0C0048' }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.headerTitle}>{user.name}</Text>
                <Text style={s.headerSub}>{user.role[0].toUpperCase() + user.role.slice(1)} · Staff no. {user.staffNumber}</Text>
              </View>
            </View>
            <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
              {user.divisions.map((d) => (
                <View key={d} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' }}>{DIVISION_LABELS[d]}</Text>
                </View>
              ))}
            </View>
            <View style={[s.row, { gap: 10 }]}>
              <Stat value={monthCount} label="Last 30 days" />
              <Stat value={defectsRaised} label="Defects raised" />
              <Stat value={pending} label="To upload" />
            </View>
          </ScreenHeader>
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={s.label}>My inspection history</Text>
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={[s.soft, { paddingHorizontal: 20 }]}>Your inspections will appear here.</Text>}
      renderItem={({ item, index }) => {
        const iso = item.inspection.submittedAt ?? item.inspection.startedAt;
        const showDay = index === 0 || dayLabel(shown[index - 1].inspection.submittedAt ?? '') !== dayLabel(iso);
        const st = statusStyle(c, item.inspection.outcome ?? 'serviceable');
        return (
          <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 10 }}>
            {showDay && <Text style={[s.fieldLabel, { marginTop: 4 }]}>{dayLabel(iso)}</Text>}
            <Card style={[s.row, { paddingVertical: 12 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.h3}>{item.fleetNumber}</Text>
                <Text style={s.caption}>
                  {item.typeName} · {new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {item.inspection.station ? ` · ${item.inspection.station}` : ''}
                </Text>
              </View>
              <Badge label={item.inspection.outcome === 'unserviceable' ? 'Locked out' : st.label} color={st.color} soft={st.soft} />
            </Card>
          </View>
        );
      }}
      ListFooterComponent={
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {history.length > limit && <Button variant="ghost" color={c.link} title="Show older inspections" onPress={() => setLimit((n) => n + 20)} />}
          <Card style={[s.row, { gap: 12 }]}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pending ? c.warn : c.pass }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.h3}>{isDemoMode ? 'Demo mode' : pending ? `${pending} waiting to upload` : 'All synced'}</Text>
              <Text style={s.caption}>
                {syncMsg ?? (isDemoMode ? 'Data stays on this phone' : `Last upload ${lastSync ? new Date(lastSync).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never'}`)}
              </Text>
            </View>
            {!isDemoMode && <Button variant="ghost" color={c.link} title="Sync now" onPress={sync} />}
          </Card>
          <Button
            title="Sign out"
            icon="log-out-outline"
            color={c.failText}
            variant="outline"
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
          />
          <Text style={[s.caption, { textAlign: 'center' }]}>LinkSpec v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      }
    />
  );
}
