import Ionicons from '@expo/vector-icons/Ionicons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { getAsset, listAssets, listDefects, listUsers, updateDefect } from '../../db/local';
import { can, canClearDefect } from '../../domain/lockout';
import { defectsToTraxCsv } from '../../domain/traxExport';
import type { Defect } from '../../domain/types';
import { useSession } from '../../state/session';
import { syncNow } from '../../sync/sync';
import { isDemoMode, supabase } from '../../sync/supabase';
import { Badge, Button, Card, ScreenHeader, Segmented, Thumb } from '../../ui/components';
import { fonts, useTheme } from '../../ui/theme';

type Filter = 'locked' | 'open' | 'cleared';

const when = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Defects() {
  const { c, s } = useTheme();
  const { user } = useSession();
  const [all, setAll] = useState<Defect[]>([]);
  const [filter, setFilter] = useState<Filter>('locked');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reload = useCallback(() => setAll(listDefects()), []);
  useFocusEffect(reload);
  if (!user) return null;

  const names = new Map(listUsers().map((u) => [u.id, u.name]));
  const locked = all.filter((d) => d.status !== 'closed' && d.critical);
  const open = all.filter((d) => d.status !== 'closed' && !d.critical);
  const cleared = all.filter((d) => d.status === 'closed');
  const shown = filter === 'locked' ? locked : filter === 'open' ? open : cleared;

  async function clear(d: Defect) {
    const note = notes[d.id]?.trim();
    if (!note) return Alert.alert('Clearance note required', 'Record what was done, for example the TRAX work order number.');
    // Recorded on the device first so it works offline; the server re-checks the manager's permission on upload.
    updateDefect({ ...d, status: 'closed', clearedBy: user!.id, clearedAt: new Date().toISOString(), clearanceNote: note }, false);
    reload();
    const r = await syncNow();
    if (r.failed > 0) Alert.alert('Saved on this phone', 'The clearance will upload when the connection returns.');
  }

  async function exportTrax() {
    const assets = listAssets();
    const csv = defectsToTraxCsv(all, assets, listUsers());
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const file = new File(Paths.cache, `trax-defects-${stamp}.csv`);
    file.create({ overwrite: true });
    file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export defects for TRAX' });
    if (!isDemoMode && supabase) {
      await supabase.from('defects').update({ trax_exported_at: new Date().toISOString() }).in('id', all.map((d) => d.id));
    }
  }

  return (
    <View style={s.screen}>
      <ScreenHeader>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={s.headerTitle}>Defects</Text>
          {can(user.role, 'exportTrax') && (
            <Pressable
              accessibilityRole="button"
              onPress={exportTrax}
              style={({ pressed }) => [s.row, { gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }]}
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' }}>TRAX export</Text>
            </Pressable>
          )}
        </View>
        <Segmented
          onNavy
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'locked', label: `Locked out · ${locked.length}` },
            { value: 'open', label: `Open · ${open.length}` },
            { value: 'cleared', label: 'Cleared' },
          ]}
        />
      </ScreenHeader>
      <FlatList
        data={shown}
        keyExtractor={(d) => d.id}
        contentContainerStyle={s.pad}
        ListEmptyComponent={<Text style={s.soft}>{filter === 'locked' ? 'No assets are locked out.' : filter === 'open' ? 'No open defects.' : 'Nothing cleared in the last 30 days.'}</Text>}
        renderItem={({ item: d }) => {
          const asset = getAsset(d.assetId);
          const allowed = d.status !== 'closed' && canClearDefect(user.role, d);
          const pill = d.status === 'closed'
            ? { label: 'Cleared', color: c.passText, soft: c.passSoft }
            : d.critical
              ? { label: 'Locked out', color: c.failText, soft: c.failSoft }
              : { label: 'Defect', color: c.warnText, soft: c.warnSoft };
          return (
            <Card>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.h2}>{asset?.fleetNumber ?? 'Unknown asset'}</Text>
                <Badge {...pill} />
              </View>
              <View style={[s.row, { alignItems: 'flex-start', gap: 12 }]}>
                <Thumb uri={d.photoUris[0]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.h3}>{d.itemText}</Text>
                  <Text style={s.soft}>{d.description}</Text>
                  <Text style={s.caption}>{names.get(d.raisedBy) ?? 'Inspector'} · {when(d.raisedAt)} · {asset?.station ?? ''}</Text>
                </View>
              </View>
              {d.status === 'closed' && (
                <Text style={s.caption}>
                  Cleared by {names.get(d.clearedBy ?? '') ?? 'manager'}{d.clearedAt ? ` · ${when(d.clearedAt)}` : ''}: {d.clearanceNote}
                </Text>
              )}
              {allowed && (
                <>
                  <Text style={s.fieldLabel}>Clearance note or TRAX work order</Text>
                  <TextInput style={s.input} placeholderTextColor={c.faint} placeholder="e.g. WO-24871: part replaced and tested" value={notes[d.id] ?? ''} onChangeText={(t) => setNotes((n) => ({ ...n, [d.id]: t }))} />
                  <Button icon="lock-open-outline" title={d.critical ? 'Clear lock-out, return to service' : 'Close defect'} color={c.pass} onPress={() => clear(d)} />
                </>
              )}
              {!allowed && d.status !== 'closed' && d.critical && <Text style={s.caption}>Only a manager can clear this lock-out.</Text>}
            </Card>
          );
        }}
      />
    </View>
  );
}
