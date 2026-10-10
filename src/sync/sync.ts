import { File } from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import {
  markDefectSynced,
  markInspectionSynced,
  pendingUploads,
  replaceReferenceData,
  setMeta,
  upsertDefects,
  upsertServerInspections,
} from '../db/local';
import type { Asset, ChecklistItem, Defect, Division, Inspection, ItemResult, User } from '../domain/types';
import { PHOTO_BUCKET, supabase } from './supabase';

export interface SyncResult {
  uploaded: number;
  failed: number;
  error?: string;
}

let running: Promise<SyncResult> | null = null;

/** Upload everything queued on the device, then refresh reference data. Safe to call repeatedly. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

/** Sync whenever the device regains a connection (Wi-Fi or mobile data). */
export function startAutoSync(onDone?: (r: SyncResult) => void) {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) syncNow().then((r) => onDone?.(r));
  });
}

async function doSync(): Promise<SyncResult> {
  if (!supabase) return { uploaded: 0, failed: 0 };
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return { uploaded: 0, failed: 0, error: 'Not signed in' };

  let uploaded = 0;
  let failed = 0;
  const { inspections, defects } = pendingUploads();
  const photoPath = new Map<string, string>();

  for (const { inspection, signature } of inspections) {
    try {
      await uploadInspection(inspection, signature, photoPath);
      markInspectionSynced(inspection.id);
      uploaded++;
    } catch {
      failed++;
    }
  }
  for (const d of defects) {
    try {
      await uploadDefect(d, photoPath);
      markDefectSynced(d.id);
      uploaded++;
    } catch {
      failed++;
    }
  }

  try {
    await pullReferenceData();
    setMeta('lastSyncAt', new Date().toISOString());
  } catch (e) {
    return { uploaded, failed, error: e instanceof Error ? e.message : String(e) };
  }
  return { uploaded, failed };
}

async function uploadPhoto(localUri: string, path: string) {
  const bytes = await new File(localUri).bytes();
  const { error } = await supabase!.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

async function uploadInspection(inspection: Inspection, signature: string, photoPath: Map<string, string>) {
  const results = [];
  for (const r of inspection.results) {
    const paths: string[] = [];
    for (const [n, uri] of r.photoUris.entries()) {
      const path = `${inspection.id}/${r.itemId}/${n + 1}.jpg`;
      await uploadPhoto(uri, path);
      photoPath.set(uri, path);
      paths.push(path);
    }
    results.push({ itemId: r.itemId, result: r.result, readingValue: r.readingValue ?? null, comment: r.comment ?? null, naReason: r.naReason ?? null, photoPaths: paths });
  }
  const { error } = await supabase!.from('inspections').upsert(
    {
      id: inspection.id,
      asset_id: inspection.assetId,
      template_id: inspection.templateId,
      template_version: inspection.templateVersion,
      user_id: inspection.userId,
      station: inspection.station,
      latitude: inspection.latitude,
      longitude: inspection.longitude,
      started_at: inspection.startedAt,
      submitted_at: inspection.submittedAt,
      meter_reading: inspection.meterReading,
      outcome: inspection.outcome,
      results,
      signature,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}

async function uploadDefect(d: Defect, photoPath: Map<string, string>) {
  const { error } = await supabase!.from('defects').upsert(
    {
      id: d.id,
      asset_id: d.assetId,
      inspection_id: d.inspectionId,
      item_id: d.itemId,
      item_text: d.itemText,
      critical: d.critical,
      description: d.description,
      status: 'open',
      raised_by: d.raisedBy,
      raised_at: d.raisedAt,
      photo_paths: d.photoUris.map((u) => photoPath.get(u) ?? u),
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
  // A clearance recorded offline goes through the server's own permission check.
  if (d.status === 'closed' && d.clearanceNote) {
    const { error: e2 } = await supabase!.rpc('clear_defect', { p_defect: d.id, p_note: d.clearanceNote });
    if (e2) throw e2;
  }
}

async function pullReferenceData() {
  const sb = supabase!;
  // The last 30 days: open defects plus recently cleared ones, and inspections (the server only returns
  // a user's own unless they are a supervisor or above).
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [profiles, types, assets, templates, defects, cleared, inspections] = await Promise.all([
    sb.from('profiles').select('id, name, staff_number, role, divisions').eq('active', true),
    sb.from('asset_types').select('id, name, division'),
    sb.from('assets').select('id, fleet_number, asset_type_id, station, description, status, last_inspected_at'),
    sb.from('checklist_templates').select('id, version, asset_type_id, items').eq('published', true),
    sb.from('defects').select('*').neq('status', 'closed'),
    sb.from('defects').select('*').eq('status', 'closed').gte('cleared_at', since),
    sb.from('inspections').select('*').gte('submitted_at', since).order('submitted_at', { ascending: false }).limit(1000),
  ]);
  for (const r of [profiles, types, assets, templates, defects, cleared, inspections]) if (r.error) throw r.error;

  replaceReferenceData({
    users: profiles.data!.map((p): User => ({ id: p.id, name: p.name, staffNumber: p.staff_number, role: p.role, divisions: p.divisions as Division[] })),
    assetTypes: types.data!,
    assets: assets.data!.map((a) => ({
      id: a.id,
      fleetNumber: a.fleet_number,
      assetTypeId: a.asset_type_id,
      station: a.station,
      description: a.description,
      status: a.status as Asset['status'],
      lastInspectedAt: a.last_inspected_at,
    })),
    templates: templates.data!.map((t) => ({ id: t.id, version: t.version, assetTypeId: t.asset_type_id, items: t.items as ChecklistItem[] })),
  });
  upsertServerInspections(
    inspections.data!.map((i) => ({
      signature: i.signature,
      inspection: {
        id: i.id,
        assetId: i.asset_id,
        templateId: i.template_id,
        templateVersion: i.template_version,
        userId: i.user_id,
        station: i.station,
        latitude: i.latitude,
        longitude: i.longitude,
        startedAt: i.started_at,
        submittedAt: i.submitted_at,
        meterReading: i.meter_reading,
        outcome: i.outcome,
        results: (i.results as (Omit<ItemResult, 'photoUris'> & { photoPaths?: string[] })[]).map(({ photoPaths, ...r }) => ({ ...r, photoUris: photoPaths ?? [] })),
      } satisfies Inspection,
    })),
  );
  upsertDefects(
    [...defects.data!, ...cleared.data!].map((d): Defect => ({
      id: d.id,
      assetId: d.asset_id,
      inspectionId: d.inspection_id,
      itemId: d.item_id,
      itemText: d.item_text,
      critical: d.critical,
      description: d.description,
      status: d.status,
      raisedBy: d.raised_by,
      raisedAt: d.raised_at,
      clearedBy: d.cleared_by,
      clearedAt: d.cleared_at,
      clearanceNote: d.clearance_note,
      photoUris: d.photo_paths ?? [],
    })),
    true,
  );
}
