import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAsset, latestTemplate, listDefects, listUsers, newId, saveSubmittedInspection } from '../../db/local';
import { isDueToday } from '../../domain/daily';
import { computeOutcome, defectsFromInspection, effectiveResult, readingOutOfRange, validateInspection } from '../../domain/inspection';
import { can, canInspect } from '../../domain/lockout';
import { stationForPosition } from '../../domain/stations';
import type { ChecklistItem, Inspection, ItemResult, ItemResultValue, StationCode } from '../../domain/types';
import { useSession } from '../../state/session';
import { syncNow } from '../../sync/sync';
import { Badge, Button, Card, HeaderIcon, ScreenHeader, Thumb } from '../../ui/components';
import { PhotoCapture } from '../../ui/PhotoCapture';
import { fonts, useTheme, type Palette } from '../../ui/theme';

const RESULTS: { value: ItemResultValue; label: string; color: (c: Palette) => string }[] = [
  { value: 'pass', label: 'Pass', color: (c) => c.pass },
  { value: 'fail', label: 'Fail', color: (c) => c.fail },
  { value: 'na', label: 'N/A', color: (c) => c.na },
];

export default function InspectScreen() {
  const { c, s } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [step, setStep] = useState<'checklist' | 'review'>('checklist');
  const [showIssues, setShowIssues] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setLocError('Location is off, so this inspection will be flagged for review');
      try {
        // GPS works without a data connection.
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude, station: stationForPosition(p.coords.latitude, p.coords.longitude) });
      } catch {
        setLocError('No GPS fix, so this inspection will be flagged for review');
      }
    })();
  }, []);

  const back = <HeaderIcon name="chevron-back" label="Back" onPress={() => (step === 'review' ? setStep('checklist') : router.back())} />;

  if (!user || !asset || !template) {
    return (
      <View style={s.screen}>
        <ScreenHeader>
          <View style={[s.row, { gap: 12 }]}>
            {back}
            <Text style={s.headerTitle}>{asset?.fleetNumber ?? 'Asset not found'}</Text>
          </View>
        </ScreenHeader>
        <Text style={[s.pad, s.body]}>{asset ? `No checklist is published for ${asset.typeName}.` : 'This asset is not on this phone. Sync and try again.'}</Text>
      </View>
    );
  }

  if (!canInspect(asset.status)) return <LockedOut assetId={asset.id} back={back} />;

  const set = (itemId: string, patch: Partial<ItemResult>) =>
    setResults((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? { itemId, result: null, photoUris: [] }), ...patch } }));

  const list = Object.values(results);
  const issues = validateInspection(template, list);
  const issueFor = (id: string) => issues.filter((i) => i.itemId === id).map((i) => i.message);
  const answered = template.items.filter((i) => results[i.id]?.result).length;
  const total = template.items.length;
  const effective = template.items.map((i) => ({ item: i, r: results[i.id], eff: effectiveResult(i, results[i.id]) }));
  const fails = effective.filter((x) => x.eff === 'fail');
  const passes = effective.filter((x) => x.eff === 'pass').length;
  const nas = effective.filter((x) => x.eff === 'na').length;
  const outcome = computeOutcome(template, list);
  const staffOk = confirmStaff.trim() === user.staffNumber;
  const stationText = position ? (position.station ? `${position.station} (from GPS)` : 'outside JNB and CPT') : locError ? 'no GPS' : 'locating…';

  function review() {
    if (issues.length > 0) {
      setShowIssues(true);
      Alert.alert('Not finished yet', `${issues.length} item(s) still need an answer, a photo or a comment.`);
      return;
    }
    setStep('review');
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function submit() {
    if (!template || !asset || !user) return;
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
        ? 'A critical item failed. The asset is now LOCKED OUT. Do not use it. Your supervisor and manager will see it straight away.'
        : outcome === 'serviceable_with_defects'
          ? 'Submitted with defects. Check with your supervisor before using the asset.'
          : 'Submitted. The asset is serviceable.';
    Alert.alert('Inspection submitted', msg, [{ text: 'OK', onPress: () => router.back() }]);
  }

  const outcomeBox =
    outcome === 'unserviceable'
      ? { title: 'Unserviceable: asset will lock out', sub: 'A critical item failed. Do not use this asset.', color: c.fail, text: c.failText, soft: c.failSoft, border: c.failBorder, icon: 'lock-closed' as const }
      : outcome === 'serviceable_with_defects'
        ? { title: 'Serviceable with defects', sub: 'Check with your supervisor before use', color: c.warn, text: c.warnText, soft: c.warnSoft, border: c.warn, icon: 'warning' as const }
        : { title: 'Serviceable', sub: 'No defects found', color: c.pass, text: c.passText, soft: c.passSoft, border: c.pass, icon: 'checkmark' as const };

  let lastSection = '';
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <ScreenHeader>
          <View style={[s.row, { gap: 12 }]}>
            {back}
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{step === 'review' ? 'Review and sign' : asset.fleetNumber}</Text>
              <Text style={s.headerSub}>
                {step === 'review' ? `${asset.fleetNumber} · ${asset.typeName}` : `${asset.typeName} · ${stationText} · checklist v${template.version}`}
              </Text>
            </View>
          </View>
          {step === 'checklist' && (
            <View style={{ gap: 8 }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.headerSub}>{isDueToday(asset.lastInspectedAt) ? 'Daily inspection' : 'Already inspected today'}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#FFFFFF' }}>{answered} of {total}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <View style={{ width: `${Math.round((answered / Math.max(total, 1)) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: c.highlight }} />
              </View>
            </View>
          )}
        </ScreenHeader>

        {step === 'checklist' ? (
          <View style={s.pad}>
            {(locError || (position && !position.station)) && (
              <View style={[s.row, { backgroundColor: c.warnSoft, borderRadius: 12, padding: 12 }]}>
                <Ionicons name="location-outline" size={18} color={c.warnText} />
                <Text style={[s.soft, { color: c.warnText, flex: 1 }]}>{locError ?? 'You are outside JNB and CPT, so this inspection will be flagged for review'}</Text>
              </View>
            )}
            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>Hour meter or odometer (if fitted)</Text>
              <TextInput style={[s.input, { backgroundColor: c.card }]} placeholderTextColor={c.faint} placeholder="e.g. 4812" keyboardType="decimal-pad" value={meter} onChangeText={setMeter} />
            </View>
            {template.items.map((item) => {
              const header = item.section !== lastSection ? (lastSection = item.section) : null;
              return (
                <View key={item.id} style={{ gap: 10 }}>
                  {header && <Text style={[s.label, { marginTop: 8 }]}>{header}</Text>}
                  <ItemCard item={item} r={results[item.id]} issues={showIssues ? issueFor(item.id) : []} set={(p) => set(item.id, p)} onPhoto={() => setPhotoFor(item.id)} />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={s.pad}>
            <View style={[s.row, { gap: 14, backgroundColor: outcomeBox.soft, borderWidth: 1, borderColor: outcomeBox.border, borderRadius: 16, padding: 16 }]}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: outcomeBox.color, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={outcomeBox.icon} size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.h2, { color: outcomeBox.text }]}>{outcomeBox.title}</Text>
                <Text style={[s.soft, { color: outcomeBox.text }]}>{outcomeBox.sub}</Text>
              </View>
            </View>
            <View style={[s.row, { gap: 10 }]}>
              {[
                { n: passes, label: 'Pass', color: c.passText },
                { n: fails.length, label: 'Fail', color: c.failText },
                { n: nas, label: 'N/A', color: c.muted },
              ].map((x) => (
                <Card key={x.label} style={{ flex: 1, gap: 0, padding: 12 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: x.color }}>{x.n}</Text>
                  <Text style={s.caption}>{x.label}</Text>
                </Card>
              ))}
            </View>
            {fails.length > 0 && <Text style={[s.label, { marginTop: 4 }]}>Defects to be raised</Text>}
            {fails.map(({ item, r }) => (
              <Card key={item.id} style={[s.row, { gap: 12 }]}>
                <Thumb uri={r?.photoUris[0]} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.h3}>{item.text}</Text>
                  <Text style={s.caption}>{r?.comment || 'Reading outside limits'}</Text>
                </View>
                {item.critical && <Badge label="Critical" color={c.failText} soft={c.failSoft} />}
              </Card>
            ))}
            <Card style={{ marginTop: 4 }}>
              <Text style={s.fieldLabel}>Sign with your staff number</Text>
              <TextInput
                style={[s.input, { fontSize: 18, letterSpacing: 2 }]}
                placeholder="Staff number"
                placeholderTextColor={c.faint}
                keyboardType="number-pad"
                value={confirmStaff}
                onChangeText={setConfirmStaff}
              />
              <Text style={s.caption}>
                I, {user.name}, confirm I inspected every item listed.{position?.station ? ` ${position.station}.` : ''}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>

      <View style={[s.row, { gap: 14, backgroundColor: c.card, borderTopWidth: 1, borderColor: c.border, paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 14 }]}>
        {step === 'checklist' ? (
          <>
            <View style={{ flex: 1 }}>
              <Text style={s.caption}>{total - answered === 0 ? 'All items answered' : `${total - answered} items left`}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: fails.length ? c.warnText : c.passText }}>
                {fails.length ? `${fails.length} defect${fails.length > 1 ? 's' : ''} so far` : 'No defects so far'}
              </Text>
            </View>
            <Button title="Review" onPress={review} style={{ paddingHorizontal: 28 }} />
          </>
        ) : (
          <Button
            title="Submit inspection"
            icon="checkmark"
            onPress={submit}
            disabled={!staffOk}
            color={outcome === 'unserviceable' ? c.fail : c.primary}
            style={{ flex: 1 }}
          />
        )}
      </View>

      <PhotoCapture
        visible={photoFor !== null}
        onClose={() => setPhotoFor(null)}
        onCaptured={(uri) => photoFor && set(photoFor, { photoUris: [...(results[photoFor]?.photoUris ?? []), uri] })}
      />
    </KeyboardAvoidingView>
  );
}

function ItemCard({ item, r, issues, set, onPhoto }: { item: ChecklistItem; r?: ItemResult; issues: string[]; set: (p: Partial<ItemResult>) => void; onPhoto: () => void }) {
  const { c, s } = useTheme();
  const outOfRange = readingOutOfRange(item, r?.readingValue);
  const failing = r?.result === 'fail' || (r?.result === 'pass' && outOfRange);
  const needsPhoto = failing || (r?.result === 'pass' && item.photoOnPass);
  return (
    <Card style={[failing && { borderColor: c.failBorder, borderWidth: 2 }, issues.length > 0 && { borderColor: c.fail, borderWidth: 2 }]}>
      <Text style={[s.body, { fontFamily: fonts.bold }]}>{item.text}</Text>
      {item.critical && <Badge label="Critical" color={c.failText} soft={c.failSoft} />}
      {item.helpText && <Text style={s.caption}>{item.helpText}</Text>}
      {item.reading && (
        <TextInput
          style={s.input}
          placeholderTextColor={c.faint}
          placeholder={`Reading (${item.reading.unit}${item.reading.min !== undefined ? `, ${item.reading.min}–${item.reading.max}` : ''})`}
          keyboardType="decimal-pad"
          value={r?.readingValue?.toString() ?? ''}
          onChangeText={(t) => set({ readingValue: t.trim() === '' || isNaN(Number(t)) ? null : Number(t) })}
        />
      )}
      {outOfRange && <Text style={s.error}>Reading is outside limits, so this item fails.</Text>}
      <View style={[s.row, { gap: 8 }]}>
        {RESULTS.filter((b) => b.value !== 'na' || item.naAllowed).map((b) => {
          const on = r?.result === b.value;
          const col = b.color(c);
          return (
            <Pressable
              key={b.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => set({ result: b.value })}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? col : c.border, backgroundColor: on ? col : c.card }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: on ? '#FFFFFF' : c.textSoft }}>{b.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {failing && (
        <>
          <Text style={s.fieldLabel}>Describe the fault</Text>
          <TextInput style={[s.input, { minHeight: 72, textAlignVertical: 'top' }]} multiline value={r?.comment ?? ''} onChangeText={(t) => set({ comment: t })} />
        </>
      )}
      {r?.result === 'na' && (
        <>
          <Text style={s.fieldLabel}>Reason for N/A</Text>
          <TextInput style={s.input} value={r?.naReason ?? ''} onChangeText={(t) => set({ naReason: t })} />
        </>
      )}
      {needsPhoto && (
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {r?.photoUris.map((u) => <Thumb key={u} uri={u} size={72} />)}
          <Pressable
            accessibilityRole="button"
            onPress={onPhoto}
            style={({ pressed }) => [s.row, { flex: 1, minWidth: 160, minHeight: 52, justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.fail, backgroundColor: c.failSoft, opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="camera-outline" size={20} color={c.failText} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.failText }}>{r?.photoUris.length ? 'Add another photo' : 'Add photo (required)'}</Text>
          </Pressable>
        </View>
      )}
      {issues.map((m) => <Text key={m} style={s.error}>{m}</Text>)}
    </Card>
  );
}

/** Full red screen: the asset may not be used until a manager clears it. */
function LockedOut({ assetId, back }: { assetId: string; back: React.ReactNode }) {
  const { c, s } = useTheme();
  const { user } = useSession();
  const asset = getAsset(assetId)!;
  const open = listDefects({ assetId, openOnly: true }).filter((d) => d.critical);
  const names = new Map(listUsers().map((u) => [u.id, u]));
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <ScreenHeader color={c.locked}>
        <View style={[s.row, { gap: 12 }]}>
          {back}
          <View>
            <Text style={s.headerTitle}>{asset.fleetNumber}</Text>
            <Text style={[s.headerSub, { color: '#F5C9C9' }]}>{asset.typeName} · {asset.station}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="lock-closed" size={34} color={c.locked} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#FFFFFF' }}>Do not use</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: '#F5C9C9', textAlign: 'center' }}>A critical item failed. Only a manager can return this asset to service.</Text>
        </View>
      </ScreenHeader>
      <View style={s.pad}>
        <Text style={s.label}>Open critical defect{open.length > 1 ? 's' : ''}</Text>
        {open.map((d) => {
          const by = names.get(d.raisedBy);
          return (
            <Card key={d.id}>
              <View style={[s.row, { alignItems: 'flex-start', gap: 12 }]}>
                <Thumb uri={d.photoUris[0]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.h3}>{d.itemText}</Text>
                  <Text style={s.soft}>{d.description}</Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: c.border }} />
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.caption}>Raised by {by ? `${by.name} (${by.staffNumber})` : 'inspector'}</Text>
                <Text style={s.caption}>{new Date(d.raisedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </Card>
          );
        })}
        <View style={[s.row, { alignItems: 'flex-start', gap: 12, backgroundColor: c.primarySoft, borderRadius: 16, padding: 16 }]}>
          <Ionicons name="information-circle-outline" size={22} color={c.link} />
          <Text style={[s.soft, { flex: 1, color: c.link }]}>Use another unit. Your supervisor and maintenance can see this lock-out.</Text>
        </View>
        {user && can(user.role, 'clearLockout') && <Button title="Review and clear" icon="lock-open-outline" onPress={() => router.push('/defects')} />}
      </View>
    </ScrollView>
  );
}
