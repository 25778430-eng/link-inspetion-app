import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { listAssets, pendingCount, type AssetWithType } from '../db/local';
import { isDueToday } from '../domain/daily';
import { can } from '../domain/lockout';
import { DIVISION_LABELS, type Division } from '../domain/types';
import { useSession } from '../state/session';
import { Badge, Button, Stat } from '../ui/components';
import { colors, s, STATUS_LABEL } from '../ui/theme';

export default function Home() {
  const { user, division, setDivision } = useSession();
  const [assets, setAssets] = useState<AssetWithType[]>([]);
  const [pending, setPending] = useState(0);

  const reload = useCallback(() => {
    if (division) setAssets(listAssets(division));
    setPending(pendingCount());
  }, [division]);

  useFocusEffect(reload);

  if (!user) return <Redirect href="/" />;

  const locked = assets.filter((a) => a.status === 'locked_out').length;
  const done = assets.filter((a) => !isDueToday(a.lastInspectedAt)).length;
  const due = assets.filter((a) => isDueToday(a.lastInspectedAt) && a.status !== 'locked_out').length;

  const header = (
    <View style={{ gap: 16, marginBottom: 4 }}>
      <View style={{ backgroundColor: colors.primary, borderRadius: 20, padding: 20, gap: 16 }}>
        <View>
          <Text style={{ color: colors.onPrimaryMuted, fontSize: 14 }}>Welcome back</Text>
          <Text style={{ color: colors.onPrimary, fontSize: 22, fontWeight: '800' }}>{user.name}</Text>
        </View>
        <View style={s.row}>
          <Stat value={due} label="Due today" />
          <Stat value={done} label="Done today" />
          <Stat value={locked} label="Locked out" color={locked ? '#FF8A8A' : undefined} />
        </View>
        {pending > 0 && (
          <View style={[s.row, { gap: 6 }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.onPrimaryMuted} />
            <Text style={{ color: colors.onPrimaryMuted, fontSize: 13 }}>{pending} record(s) waiting to upload</Text>
          </View>
        )}
      </View>

      {user.divisions.length > 1 && (
        <View style={{ flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: 14, padding: 4 }}>
          {user.divisions.map((d: Division) => {
            const on = d === division;
            return (
              <Pressable
                key={d}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setDivision(d)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: on ? colors.primary : 'transparent' }}
              >
                <Text style={{ fontWeight: '700', color: on ? colors.onPrimary : colors.primary }}>{DIVISION_LABELS[d]}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Button title="Scan asset" icon="qr-code-outline" onPress={() => router.push('/scan')} />
      {(can(user.role, 'viewDashboard') || can(user.role, 'exportTrax')) && (
        <Button title="Defects and lock-outs" icon="warning-outline" variant="outline" onPress={() => router.push('/defects')} />
      )}
      <Text style={[s.label, { marginTop: 6 }]}>{division ? `${DIVISION_LABELS[division as Division]} equipment` : 'Equipment'}</Text>
    </View>
  );

  return (
    <FlatList
      style={s.screen}
      data={assets}
      keyExtractor={(a) => a.id}
      contentContainerStyle={s.pad}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={s.muted}>No equipment in this division yet.</Text>}
      renderItem={({ item }) => {
        const st = STATUS_LABEL[item.status];
        const doneToday = !isDueToday(item.lastInspectedAt);
        return (
          <Pressable onPress={() => router.push(`/inspect/${item.id}`)} style={({ pressed }) => [s.card, { flexDirection: 'row', padding: 0, overflow: 'hidden', opacity: pressed ? 0.85 : 1 }]}>
            <View style={{ width: 6, backgroundColor: st.color }} />
            <View style={{ flex: 1, padding: 16, gap: 8 }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.h2}>{item.fleetNumber}</Text>
                <View style={[s.row, { gap: 4 }]}>
                  <Ionicons name="location-outline" size={14} color={colors.muted} />
                  <Text style={s.muted}>{item.station}</Text>
                </View>
              </View>
              <Text style={s.muted}>{item.typeName}</Text>
              <View style={s.row}>
                <Badge label={st.label} color={st.color} soft={st.soft} />
                {item.status !== 'locked_out' && (
                  <Badge label={doneToday ? 'Done today' : 'Due today'} color={doneToday ? colors.pass : colors.primary} soft={doneToday ? colors.passSoft : colors.primarySoft} />
                )}
              </View>
            </View>
            <View style={{ justifyContent: 'center', paddingRight: 14 }}>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}
