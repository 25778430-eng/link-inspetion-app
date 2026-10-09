import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Text, TextInput, View } from 'react-native';
import { getAsset, listAssets, listDefects, listUsers, updateDefect } from '../db/local';
import { can, canClearDefect } from '../domain/lockout';
import { defectsToTraxCsv } from '../domain/traxExport';
import type { Defect } from '../domain/types';
import { useSession } from '../state/session';
import { syncNow } from '../sync/sync';
import { isDemoMode, supabase } from '../sync/supabase';
import { Badge, Button, Card } from '../ui/components';
import { colors, s } from '../ui/theme';

export default function Defects() {
  const { user } = useSession();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reload = useCallback(() => setDefects(listDefects({ openOnly: true })), []);
  useFocusEffect(reload);
  if (!user) return null;

  async function clear(d: Defect) {
    const note = notes[d.id]?.trim();
    if (!note) return Alert.alert('Clearance note required', 'Record what was done, for example the TRAX work order number.');
    // Recorded on the device first so it works offline; the server re-checks the manager's permission on upload.
    updateDefect({ ...d, status: 'closed', clearedBy: user!.id, clearedAt: new Date().toISOString(), clearanceNote: note }, false);
    reload();
    const r = await syncNow();
    if (r.failed > 0) Alert.alert('Saved on this device', 'The clearance will upload when the connection returns.');
  }

  async function exportTrax() {
    const all = listDefects();
    const assets = (['maintenance', 'towing', 'ramp'] as const).flatMap((d) => listAssets(d));
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
      {can(user.role, 'exportTrax') && (
        <View style={s.pad}>
          <Button title="Export defects for TRAX (CSV)" onPress={exportTrax} />
        </View>
      )}
      <FlatList
        data={defects}
        keyExtractor={(d) => d.id}
        contentContainerStyle={s.pad}
        ListEmptyComponent={<Text style={s.muted}>No open defects.</Text>}
        renderItem={({ item: d }) => {
          const asset = getAsset(d.assetId);
          const allowed = canClearDefect(user.role, d);
          return (
            <Card style={d.critical ? { borderColor: colors.fail, borderWidth: 2 } : undefined}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.h2}>{asset?.fleetNumber ?? d.assetId}</Text>
                <Badge label={d.critical ? 'LOCKED OUT' : 'Defect'} color={d.critical ? colors.fail : colors.warn} />
              </View>
              <Text style={s.body}>{d.itemText}</Text>
              <Text style={s.muted}>{d.description}</Text>
              <Text style={s.muted}>Raised {new Date(d.raisedAt).toLocaleString()} · {asset?.station}</Text>
              {allowed ? (
                <>
                  <TextInput style={s.input} placeholder="Clearance note / TRAX work order" value={notes[d.id] ?? ''} onChangeText={(t) => setNotes((n) => ({ ...n, [d.id]: t }))} />
                  <Button title={d.critical ? 'Clear lock-out and return to service' : 'Close defect'} color={colors.pass} onPress={() => clear(d)} />
                </>
              ) : (
                d.critical && <Text style={s.muted}>Only a manager can clear this lock-out.</Text>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}
