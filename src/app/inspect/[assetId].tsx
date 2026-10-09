import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { getAsset, latestTemplate, listDefects, newId, saveSubmittedInspection } from '../../db/local';
import { isDueToday } from '../../domain/daily';
import { computeOutcome, defectsFromInspection, readingOutOfRange, validateInspection } from '../../domain/inspection';
import { can, canInspect } from '../../domain/lockout';
import { stationForPosition } from '../../domain/stations';
import type { ChecklistItem, Inspection, ItemResult, ItemResultValue, StationCode } from '../../domain/types';
import { useSession } from '../../state/session';
import { syncNow } from '../../sync/sync';
import { Badge, Button, Card } from '../../ui/components';
import { PhotoCapture } from '../../ui/PhotoCapture';
import { colors, s, STATUS_LABEL } from '../../ui/theme';

const RESULT_BUTTONS: { value: ItemResultValue; label: string; color: string }[] = [
  { value: 'pass', label: 'Pass', color: colors.pass },
  { value: 'fail', label: 'Fail', color: colors.fail },
  { value: 'na', label: 'N/A', color: colors.na },
];

export default function InspectScreen() {
  const { assetId } = useLocalSearchParams<{ assetId: string }>();
  const { user } = useSession();
  const asset = useMemo(() => getAsset(assetId), [assetId]);
  const template = useMemo(() => (asset ? latestTemplate(asset.assetTypeId) : null), [asset]);
  const [startedAt] = useState(() => new Date().toISOString());
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [meter, setMeter] = useState('');
  const [position, setPosition] = useState<{ lat: number; lon: number; station: StationCode | null } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const [confirmStaff, setConfirmStaff] = useState('');
  const [showIssues, setShowIssues] = useState(false);

  useEffect(() => {
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setLocError('Location permission denied; the inspection will be flagged for review.');
      try {
        // GPS works without a data connection.
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude, station: stationForPosition(p.coords.latitude, p.coords.longitude) });
      } catch {
        setLocError('Could not get a GPS fix; the inspection will be flagged for review.');
      }
    })();
  }, []);

  if (!user || !asset) return <Text style={[s.pad, s.body]}>Asset not found.</Text>;
  if (!template) return <Text style={[s.pad, s.body]}>No checklist is published for {asset.typeName}.</Text>;

  const status = STATUS_LABEL[asset.status];

  if (!canInspect(asset.status)) {
    const open = listDefects({ assetId: asset.id, openOnly: true });
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.pad}>
        <Text style={s.h1}>{asset.fleetNumber}</Text>
        <Badge label={status.label} color={status.color} />
        <Card style={{ borderColor: colors.fail, borderWidth: 2 }}>
          <Text style={[s.h2, { color: colors.fail }]}>Do not use this equipment</Text>
          <Text style={s.body}>A critical defect has locked this asset out. Only a manager can return it to service.</Text>
        </Card>
        {open.map((d) => (
          <Card key={d.id}>
            <Text style={s.h2}>{d.itemText}</Text>
            <Text style={s.body}>{d.description}</Text>
            <Text style={s.muted}>Raised {new Date(d.raisedAt).toLocaleString()}</Text>
          </Card>
        ))}
        {can(user.role, 'clearLockout') && <Button title="Review and clear" onPress={() => router.push('/defects')} />}
      </ScrollView>
    );
  }

  const set = (itemId: string, patch: Partial<ItemResult>) =>
    setResults((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? { itemId, result: null, photoUris: [] }), ...patch } }));

  const list = Object.values(results);
  const issues = validateInspection(template, list);
  const issueFor = (id: string) => issues.filter((i) => i.itemId === id);
  const answered = template.items.filter((i) => results[i.id]?.result).length;
  const outcome = computeOutcome(template, list);
  const staffOk = confirmStaff.trim() === user.staffNumber;

  function submit() {
    if (!template || !asset || !user) return;
    if (issues.length > 0) return setShowIssues(true);
    const now = new Date().toISOString();
    const inspection: Inspection = {
      id: newId(),
      assetId: asset.id,
      templateId: template.id,
      templateVersion: template.version,
      userId: user.id,
      station: position?.station ?? null,
      latitude: position?.lat ?? null,
      longitude: position?.lon ?? null,
      startedAt,
      submittedAt: now,
      meterReading: meter.trim() ? Number(meter) : null,
      outcome,
      results: template.items.map((i) => results[i.id]),
    };
    const defects = defectsFromInspection({ template, results: inspection.results, inspectionId: inspection.id, assetId: asset.id, userId: user.id, now, newId });
    const signature = `${user.name} (${user.staffNumber}) signed ${now}`;
    saveSubmittedInspection(inspection, signature, defects);
    syncNow(); // uploads now if online, otherwise when the connection returns
    const msg =
      outcome === 'unserviceable'
        ? 'A critical item failed. The asset is now LOCKED OUT and your supervisor and manager will be notified.'
        : outcome === 'serviceable_with_defects'
          ? 'Submitted with defects. Check with your supervisor before using the asset.'
          : 'Submitted. The asset is serviceable.';
    Alert.alert('Inspection submitted', msg, [{ text: 'OK', onPress: () => router.back() }]);
  }

  let lastSection = '';
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{asset.fleetNumber}</Text>
      <Text style={s.muted}>{asset.typeName} · checklist v{template.version}</Text>
      <Badge label={status.label} color={status.color} />
      {!isDueToday(asset.lastInspectedAt) && <Text style={s.muted}>Already inspected today. You can inspect again if conditions have changed.</Text>}
      <Text style={s.muted}>
        {position ? (position.station ? `Station: ${position.station} (from GPS)` : 'Outside JNB and CPT: this inspection will be flagged for review') : locError ?? 'Getting location…'}
      </Text>
      <TextInput style={s.input} placeholder="Hour meter / odometer (if fitted)" keyboardType="decimal-pad" value={meter} onChangeText={setMeter} />

      {template.items.map((item) => {
        const header = item.section !== lastSection ? (lastSection = item.section) : null;
        return (
          <View key={item.id} style={{ gap: 8 }}>
            {header && <Text style={[s.h2, { marginTop: 8 }]}>{header}</Text>}
            <ItemCard item={item} r={results[item.id]} issues={showIssues ? issueFor(item.id).map((i) => i.message) : []} set={(p) => set(item.id, p)} onPhoto={() => setPhotoFor(item.id)} />
          </View>
        );
      })}

      <Card>
        <Text style={s.h2}>Summary</Text>
        <Text style={s.body}>{answered} of {template.items.length} items answered</Text>
        <Badge label={`Outcome: ${STATUS_LABEL[outcome].label}`} color={STATUS_LABEL[outcome].color} />
        <Text style={s.body}>Sign by entering your staff number ({user.name}):</Text>
        <TextInput style={s.input} placeholder="Staff number" keyboardType="number-pad" value={confirmStaff} onChangeText={setConfirmStaff} />
        {showIssues && issues.length > 0 && <Text style={s.error}>{issues.length} item(s) need attention above.</Text>}
        <Button title="Sign and submit" onPress={submit} disabled={!staffOk} color={outcome === 'unserviceable' ? colors.fail : colors.primary} />
      </Card>

      <PhotoCapture
        visible={photoFor !== null}
        onClose={() => setPhotoFor(null)}
        onCaptured={(uri) => photoFor && set(photoFor, { photoUris: [...(results[photoFor]?.photoUris ?? []), uri] })}
      />
    </ScrollView>
  );
}

function ItemCard({ item, r, issues, set, onPhoto }: { item: ChecklistItem; r?: ItemResult; issues: string[]; set: (p: Partial<ItemResult>) => void; onPhoto: () => void }) {
  const outOfRange = readingOutOfRange(item, r?.readingValue);
  const failing = r?.result === 'fail' || (r?.result === 'pass' && outOfRange);
  const needsPhoto = failing || (r?.result === 'pass' && item.photoOnPass);
  return (
    <Card style={issues.length ? { borderColor: colors.fail, borderWidth: 2 } : undefined}>
      <Text style={s.body}>{item.text}</Text>
      {item.critical && <Badge label="CRITICAL: a fail locks out the asset" color={colors.fail} />}
      {item.helpText && <Text style={s.muted}>{item.helpText}</Text>}
      {item.reading && (
        <TextInput
          style={s.input}
          placeholder={`Reading (${item.reading.unit}${item.reading.min !== undefined ? `, ${item.reading.min}–${item.reading.max}` : ''})`}
          keyboardType="decimal-pad"
          value={r?.readingValue?.toString() ?? ''}
          onChangeText={(t) => set({ readingValue: t.trim() === '' || isNaN(Number(t)) ? null : Number(t) })}
        />
      )}
      {outOfRange && <Text style={s.error}>Reading is outside limits: this item fails.</Text>}
      <View style={s.row}>
        {RESULT_BUTTONS.filter((b) => b.value !== 'na' || item.naAllowed).map((b) => {
          const on = r?.result === b.value;
          return (
            <Pressable
              key={b.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => set({ result: b.value })}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: b.color, backgroundColor: on ? b.color : '#fff' }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: on ? '#fff' : b.color }}>{b.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {failing && <TextInput style={s.input} placeholder="Describe the fault" multiline value={r?.comment ?? ''} onChangeText={(t) => set({ comment: t })} />}
      {r?.result === 'na' && <TextInput style={s.input} placeholder="Reason for N/A" value={r?.naReason ?? ''} onChangeText={(t) => set({ naReason: t })} />}
      {needsPhoto && (
        <>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            {r?.photoUris.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 6 }} />)}
          </View>
          <Button title={r?.photoUris.length ? 'Add another photo' : 'Take photo (required)'} color={colors.fail} onPress={onPhoto} />
        </>
      )}
      {issues.map((m) => <Text key={m} style={s.error}>{m}</Text>)}
    </Card>
  );
}
