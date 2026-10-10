import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { listAssets, listDefects, listInspections, listUsers, pendingCount, type AssetWithType, type InspectionSummary } from '../../db/local';
import { isDueToday, sastDay } from '../../domain/daily';
import { can } from '../../domain/lockout';
import { DIVISION_LABELS, type Defect, type Division, type StationCode } from '../../domain/types';
import { useSession } from '../../state/session';
import { Badge, Button, Card, Logo, ScreenHeader, Segmented, Stat } from '../../ui/components';
import { fonts, statusStyle, useTheme } from '../../ui/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { user } = useSession();
  if (!user) return null;
  return can(user.role, 'viewDashboard') ? <SupervisorHome /> : <OperatorHome />;
}

function AssetRow({ item }: { item: AssetWithType }) {
  const { c, s } = useTheme();
  const locked = item.status === 'locked_out';
  const doneToday = !isDueToday(item.lastInspectedAt);
  const pill = locked
    ? statusStyle(c, 'locked_out')
    : doneToday
      ? item.status === 'serviceable_with_defects'
        ? { label: 'With defects', color: c.warnText, soft: c.warnSoft }
        : { label: 'Done', color: c.passText, soft: c.passSoft }
      : { label: 'Due today', color: c.link, soft: c.primarySoft };
  const initials = item.fleetNumber.split('-')[0].slice(0, 3).toUpperCase();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/inspect/${item.id}`)}
      style={({ pressed }) => [s.card, s.row, { gap: 14, paddingVertical: 14, opacity: pressed ? 0.85 : 1 }, locked && { borderColor: c.failBorder, borderWidth: 1.5 }]}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: locked ? c.failSoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        {locked ? <Ionicons name="lock-closed-outline" size={22} color={c.failText} /> : <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: c.link }}>{initials}</Text>}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.h3}>{item.fleetNumber}</Text>
        <Text style={s.caption}>{item.typeName} · {item.station}</Text>
      </View>
      <Badge {...pill} />
    </Pressable>
  );
}

function OperatorHome() {
  const { c, s } = useTheme();
  const { user, division, setDivision } = useSession();
  const [assets, setAssets] = useState<AssetWithType[]>([]);
  const [pending, setPending] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (division) setAssets(listAssets(division));
      setPending(pendingCount());
    }, [division]),
  );
  if (!user) return null;

  const locked = assets.filter((a) => a.status === 'locked_out').length;
  const done = assets.filter((a) => !isDueToday(a.lastInspectedAt)).length;
  const due = assets.filter((a) => isDueToday(a.lastInspectedAt) && a.status !== 'locked_out').length;

  return (
    <FlatList
      style={s.screen}
      data={assets}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ paddingBottom: 24 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 14 }}>
          <ScreenHeader>
            <View style={[s.row, { gap: 12 }]}>
              <Logo />
              <View style={{ flex: 1 }}>
                <Text style={s.headerSub}>{greeting()}</Text>
                <Text style={s.headerTitle}>{user.name}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, color: c.onPrimaryMuted }}>
              {(division ? DIVISION_LABELS[division as Division] : 'EQUIPMENT').toUpperCase()} · TODAY
            </Text>
            <View style={[s.row, { gap: 10 }]}>
              <Stat value={due} label="Due today" />
              <Stat value={done} label="Done" />
              <Stat value={locked} label="Locked out" color={locked ? '#FF9B9B' : undefined} />
            </View>
            {pending > 0 && (
              <View style={[s.row, { gap: 6 }]}>
                <Ionicons name="cloud-offline-outline" size={16} color={c.onPrimaryMuted} />
                <Text style={s.headerSub}>{pending} waiting to upload</Text>
              </View>
            )}
          </ScreenHeader>
          <View style={{ paddingHorizontal: 20, gap: 14 }}>
            {user.divisions.length > 1 && division && (
              <Segmented options={user.divisions.map((d) => ({ value: d, label: DIVISION_LABELS[d] }))} value={division as Division} onChange={setDivision} />
            )}
            <Button title="Scan asset to inspect" icon="scan-outline" onPress={() => router.push('/scan')} />
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 4 }]}>
              <Text style={s.label}>{division ? `${DIVISION_LABELS[division as Division]} equipment` : 'Equipment'}</Text>
              <Text style={s.caption}>{assets.length} assets</Text>
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={[s.soft, { paddingHorizontal: 20 }]}>No equipment in this division yet.</Text>}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 20 }}>
          <AssetRow item={item} />
        </View>
      )}
    />
  );
}

const DIVISIONS: Division[] = ['maintenance', 'towing', 'ramp'];

function SupervisorHome() {
  const { c, s } = useTheme();
  const { user } = useSession();
  const [station, setStation] = useState<StationCode>('JNB');
  const [assets, setAssets] = useState<AssetWithType[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [today, setToday] = useState<InspectionSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      setAssets(listAssets());
      setDefects(listDefects({ openOnly: true }));
      const day = sastDay(new Date());
      setToday(listInspections({ sinceIso: new Date(Date.now() - 86400000).toISOString() }).filter((x) => x.inspection.submittedAt && sastDay(x.inspection.submittedAt) === day));
    }, []),
  );
  if (!user) return null;

  const here = assets.filter((a) => a.station === station);
  const ids = new Set(here.map((a) => a.id));
  const openHere = defects.filter((d) => ids.has(d.assetId));
  const inspected = here.filter((a) => !isDueToday(a.lastInspectedAt)).length;
  const lockedAssets = here.filter((a) => a.status === 'locked_out');
  const notInspected = here.filter((a) => isDueToday(a.lastInspectedAt) && a.status !== 'locked_out');
  const names = new Map(listUsers().map((u) => [u.id, u.name]));
  const activity = today.filter((x) => ids.has(x.inspection.assetId)).slice(0, 8);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 24, gap: 14 }}>
      <ScreenHeader>
        <View style={[s.row, { gap: 12 }]}>
          <Logo />
          <View style={{ flex: 1 }}>
            <Text style={s.headerSub}>{user.role[0].toUpperCase() + user.role.slice(1)} · {user.name}</Text>
            <Text style={s.headerTitle}>{station} station today</Text>
          </View>
        </View>
        <View style={[s.row, { gap: 10 }]}>
          <Stat value={inspected} suffix={`/${here.length}`} label="Inspected" />
          <Stat value={openHere.length} label="Open defects" color={openHere.length ? '#FFD08A' : undefined} />
          <Stat value={lockedAssets.length} label="Locked out" color={lockedAssets.length ? '#FF9B9B' : undefined} />
        </View>
        <Segmented onNavy options={[{ value: 'JNB', label: 'JNB' }, { value: 'CPT', label: 'CPT' }]} value={station} onChange={setStation} />
      </ScreenHeader>

      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <Text style={s.label}>All divisions</Text>
        {DIVISIONS.map((d) => {
          const list = here.filter((a) => a.division === d);
          const done = list.filter((a) => !isDueToday(a.lastInspectedAt)).length;
          const lockedN = list.filter((a) => a.status === 'locked_out').length;
          const defectN = openHere.filter((x) => list.some((a) => a.id === x.assetId)).length;
          const pct = list.length ? done / list.length : 0;
          return (
            <Card key={d}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.h3}>{DIVISION_LABELS[d]}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.link }}>{done} of {list.length}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: c.primarySoft }}>
                <View style={{ width: `${Math.round(pct * 100)}%`, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
              </View>
              <View style={[s.row, { gap: 14, flexWrap: 'wrap' }]}>
                <Text style={s.caption}>{list.length - done} not yet inspected</Text>
                <Text style={[s.caption, defectN > 0 && { color: c.warnText }]}>{defectN} open defects</Text>
                <Text style={[s.caption, lockedN > 0 && { color: c.failText, fontFamily: fonts.bold }]}>{lockedN} locked out</Text>
              </View>
            </Card>
          );
        })}

        {(lockedAssets.length > 0 || notInspected.length > 0) && <Text style={[s.label, { marginTop: 6 }]}>Needs attention</Text>}
        {lockedAssets.map((a) => (
          <AssetRow key={a.id} item={a} />
        ))}
        {notInspected.slice(0, 5).map((a) => (
          <AssetRow key={a.id} item={a} />
        ))}

        <Text style={[s.label, { marginTop: 6 }]}>Who inspected what</Text>
        <Card style={{ paddingVertical: 4 }}>
          {activity.length === 0 && <Text style={[s.caption, { paddingVertical: 12 }]}>No inspections at {station} yet today.</Text>}
          {activity.map((x, i) => {
            const st = statusStyle(c, x.inspection.outcome ?? 'serviceable');
            const time = x.inspection.submittedAt ? new Date(x.inspection.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <View key={x.inspection.id} style={[s.row, { paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: c.border }]}>
                <Text style={[s.caption, { width: 44 }]}>{time}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.h3}>{x.fleetNumber}</Text>
                  <Text style={s.caption}>{names.get(x.inspection.userId) ?? 'Unknown'} · {DIVISION_LABELS[x.division as Division] ?? ''}</Text>
                </View>
                <Badge label={x.inspection.outcome === 'serviceable' ? 'Pass' : x.inspection.outcome === 'unserviceable' ? 'Locked' : 'Defect'} color={st.color} soft={st.soft} />
              </View>
            );
          })}
        </Card>
      </View>
    </ScrollView>
  );
}
