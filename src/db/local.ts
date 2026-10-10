import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { assetStatusFromDefects } from '../domain/lockout';
import { ASSET_TYPES, CHECKLIST_TEMPLATES } from '../domain/seed';
import type {
  Asset,
  AssetType,
  ChecklistTemplate,
  Defect,
  Inspection,
  User,
} from '../domain/types';

/**
 * The device's own copy of everything an inspector needs, so the app works with no signal.
 * Rows with synced = 0 are waiting to upload.
 */
export const db = SQLite.openDatabaseSync('inspection.db');

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS asset_types (id TEXT PRIMARY KEY, name TEXT NOT NULL, division TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, fleet_number TEXT NOT NULL, asset_type_id TEXT NOT NULL, station TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, last_inspected_at TEXT
);
CREATE TABLE IF NOT EXISTS templates (
  id TEXT NOT NULL, version INTEGER NOT NULL, asset_type_id TEXT NOT NULL, items TEXT NOT NULL,
  PRIMARY KEY (id, version)
);
CREATE TABLE IF NOT EXISTS inspections (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, json TEXT NOT NULL, signature TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS defects (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, json TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0);
`;

export function initDb() {
  db.execSync(SCHEMA);
}

export function getMeta(key: string): string | null {
  return db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value ?? null;
}

export function setMeta(key: string, value: string) {
  db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

// Reference data -----------------------------------------------------------

export function replaceReferenceData(data: {
  users: User[];
  assetTypes: AssetType[];
  assets: (Omit<Asset, 'status'> & { status: Asset['status']; lastInspectedAt: string | null })[];
  templates: ChecklistTemplate[];
}) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM users');
    for (const u of data.users) db.runSync('INSERT INTO users (id, json) VALUES (?, ?)', u.id, JSON.stringify(u));
    db.runSync('DELETE FROM asset_types');
    for (const t of data.assetTypes) db.runSync('INSERT INTO asset_types VALUES (?, ?, ?)', t.id, t.name, t.division);
    db.runSync('DELETE FROM templates');
    for (const t of data.templates)
      db.runSync('INSERT INTO templates VALUES (?, ?, ?, ?)', t.id, t.version, t.assetTypeId, JSON.stringify(t.items));
    db.runSync('DELETE FROM assets');
    for (const a of data.assets) {
      db.runSync(
        'INSERT INTO assets VALUES (?, ?, ?, ?, ?, ?, ?)',
        a.id, a.fleetNumber, a.assetTypeId, a.station, a.description, a.status, a.lastInspectedAt,
      );
    }
  });
  // Lock-outs raised on this device but not yet uploaded must survive a refresh from the server.
  for (const a of data.assets) refreshAssetStatus(a.id, a.status);
}

/** Demo data so the app can be tried before the backend is connected. */
export function seedDemoData() {
  const demoUsers: User[] = [
    { id: 'demo-operator', name: 'Demo Operator', staffNumber: '10001', role: 'operator', divisions: ['maintenance', 'towing', 'ramp'] },
    { id: 'demo-supervisor', name: 'Demo Supervisor', staffNumber: '10002', role: 'supervisor', divisions: ['maintenance', 'towing', 'ramp'] },
    { id: 'demo-manager', name: 'Demo Manager', staffNumber: '10003', role: 'manager', divisions: ['maintenance', 'towing', 'ramp'] },
  ];
  const fleet: [string, string, Asset['station']][] = [
    ['GPU-101', 'gpu', 'JNB'], ['GPU-201', 'gpu', 'CPT'], ['ASU-102', 'asu', 'JNB'], ['HYD-103', 'hyd-cart', 'JNB'],
    ['TT-014', 'tow-tractor', 'JNB'], ['TT-022', 'tow-tractor', 'CPT'], ['TB-E190', 'towbar', 'JNB'], ['TB-CRJ', 'towbar', 'CPT'],
    ['BL-031', 'belt-loader', 'JNB'], ['PS-041', 'pax-steps', 'CPT'], ['DL-051', 'dolly', 'JNB'], ['HL-061', 'high-loader', 'JNB'],
  ];
  replaceReferenceData({
    users: demoUsers,
    assetTypes: ASSET_TYPES,
    templates: CHECKLIST_TEMPLATES,
    assets: fleet.map(([fleetNumber, assetTypeId, station]) => ({
      id: `demo-${fleetNumber}`, fleetNumber, assetTypeId, station, description: '', status: 'serviceable', lastInspectedAt: null,
    })),
  });
}

export function listUsers(): User[] {
  return db.getAllSync<{ json: string }>('SELECT json FROM users').map((r) => JSON.parse(r.json));
}

export function listAssetTypes(): AssetType[] {
  return db.getAllSync<AssetType>('SELECT id, name, division FROM asset_types ORDER BY name');
}

type AssetRow = { id: string; fleet_number: string; asset_type_id: string; station: string; description: string; status: string; last_inspected_at: string | null };

export interface AssetWithType extends Asset {
  typeName: string;
  division: string;
  lastInspectedAt: string | null;
}

function toAsset(r: AssetRow & { type_name: string; division: string }): AssetWithType {
  return {
    id: r.id,
    fleetNumber: r.fleet_number,
    assetTypeId: r.asset_type_id,
    station: r.station as Asset['station'],
    description: r.description,
    status: r.status as Asset['status'],
    lastInspectedAt: r.last_inspected_at,
    typeName: r.type_name,
    division: r.division,
  };
}

const ASSET_SELECT = `SELECT a.*, t.name AS type_name, t.division FROM assets a JOIN asset_types t ON t.id = a.asset_type_id`;

export function listAssets(division?: string): AssetWithType[] {
  return division
    ? db.getAllSync<AssetRow & { type_name: string; division: string }>(`${ASSET_SELECT} WHERE t.division = ? ORDER BY a.station, a.fleet_number`, division).map(toAsset)
    : db.getAllSync<AssetRow & { type_name: string; division: string }>(`${ASSET_SELECT} ORDER BY a.station, a.fleet_number`).map(toAsset);
}

export function getAsset(id: string): AssetWithType | null {
  const r = db.getFirstSync<AssetRow & { type_name: string; division: string }>(`${ASSET_SELECT} WHERE a.id = ?`, id);
  return r ? toAsset(r) : null;
}

export function findAssetByCode(code: string): AssetWithType | null {
  const r = db.getFirstSync<AssetRow & { type_name: string; division: string }>(
    `${ASSET_SELECT} WHERE a.id = ? OR upper(a.fleet_number) = upper(?)`, code.trim(), code.trim(),
  );
  return r ? toAsset(r) : null;
}

export function latestTemplate(assetTypeId: string): ChecklistTemplate | null {
  const r = db.getFirstSync<{ id: string; version: number; asset_type_id: string; items: string }>(
    'SELECT * FROM templates WHERE asset_type_id = ? ORDER BY version DESC LIMIT 1', assetTypeId,
  );
  return r ? { id: r.id, version: r.version, assetTypeId: r.asset_type_id, items: JSON.parse(r.items) } : null;
}

// Inspections and defects --------------------------------------------------

export function saveSubmittedInspection(inspection: Inspection, signature: string, defects: Defect[]) {
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT INTO inspections (id, asset_id, json, signature, synced) VALUES (?, ?, ?, ?, 0)',
      inspection.id, inspection.assetId, JSON.stringify(inspection), signature,
    );
    for (const d of defects) {
      db.runSync('INSERT INTO defects (id, asset_id, json, synced) VALUES (?, ?, ?, 0)', d.id, d.assetId, JSON.stringify(d));
    }
    db.runSync('UPDATE assets SET last_inspected_at = ? WHERE id = ?', inspection.submittedAt, inspection.assetId);
  });
  refreshAssetStatus(inspection.assetId);
}

export interface InspectionSummary {
  inspection: Inspection;
  fleetNumber: string;
  typeName: string;
  division: string;
}

/** Most recent first. Includes inspections pulled from the server (a supervisor sees the whole station). */
export function listInspections(filter: { userId?: string; sinceIso?: string; limit?: number } = {}): InspectionSummary[] {
  const rows = db.getAllSync<{ json: string; fleet_number: string | null; type_name: string | null; division: string | null }>(
    `SELECT i.json, a.fleet_number, t.name AS type_name, t.division FROM inspections i
     LEFT JOIN assets a ON a.id = i.asset_id LEFT JOIN asset_types t ON t.id = a.asset_type_id`,
  );
  return rows
    .map((r) => ({ inspection: JSON.parse(r.json) as Inspection, fleetNumber: r.fleet_number ?? '?', typeName: r.type_name ?? '', division: r.division ?? '' }))
    .filter((x) => (!filter.userId || x.inspection.userId === filter.userId) && (!filter.sinceIso || (x.inspection.submittedAt ?? '') >= filter.sinceIso))
    .sort((a, b) => (b.inspection.submittedAt ?? '').localeCompare(a.inspection.submittedAt ?? ''))
    .slice(0, filter.limit ?? 200);
}

/** Store inspections downloaded from the server. Never touches ones still waiting to upload. */
export function upsertServerInspections(list: { inspection: Inspection; signature: string }[]) {
  db.withTransactionSync(() => {
    for (const { inspection, signature } of list) {
      db.runSync(
        'INSERT INTO inspections (id, asset_id, json, signature, synced) VALUES (?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET json = excluded.json WHERE synced = 1',
        inspection.id, inspection.assetId, JSON.stringify(inspection), signature,
      );
    }
  });
}

export function listDefects(filter: { assetId?: string; openOnly?: boolean } = {}): Defect[] {
  const rows = filter.assetId
    ? db.getAllSync<{ json: string }>('SELECT json FROM defects WHERE asset_id = ?', filter.assetId)
    : db.getAllSync<{ json: string }>('SELECT json FROM defects');
  const all: Defect[] = rows.map((r) => JSON.parse(r.json));
  const list = filter.openOnly ? all.filter((d) => d.status !== 'closed') : all;
  return list.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
}

export function upsertDefects(defects: Defect[], synced: boolean) {
  db.withTransactionSync(() => {
    for (const d of defects) {
      // Never overwrite a local change that has not been uploaded yet.
      const local = db.getFirstSync<{ synced: number }>('SELECT synced FROM defects WHERE id = ?', d.id);
      if (local && local.synced === 0) continue;
      db.runSync('INSERT OR REPLACE INTO defects (id, asset_id, json, synced) VALUES (?, ?, ?, ?)', d.id, d.assetId, JSON.stringify(d), synced ? 1 : 0);
    }
  });
  for (const id of new Set(defects.map((d) => d.assetId))) refreshAssetStatus(id);
}

export function updateDefect(defect: Defect, synced: boolean) {
  db.runSync('UPDATE defects SET json = ?, synced = ? WHERE id = ?', JSON.stringify(defect), synced ? 1 : 0, defect.id);
  refreshAssetStatus(defect.assetId);
}

/** Lock-out applies on this device immediately, from its own open defects, before any upload. */
export function refreshAssetStatus(assetId: string, serverStatus?: Asset['status']) {
  if (serverStatus === 'out_of_service') return;
  const status = assetStatusFromDefects(listDefects({ assetId }));
  db.runSync('UPDATE assets SET status = ? WHERE id = ?', status, assetId);
}

export function pendingUploads(): { inspections: { inspection: Inspection; signature: string }[]; defects: Defect[] } {
  const ins = db
    .getAllSync<{ json: string; signature: string }>('SELECT json, signature FROM inspections WHERE synced = 0')
    .map((r) => ({ inspection: JSON.parse(r.json) as Inspection, signature: r.signature }));
  const defects = db.getAllSync<{ json: string }>('SELECT json FROM defects WHERE synced = 0').map((r) => JSON.parse(r.json) as Defect);
  return { inspections: ins, defects };
}

export function markInspectionSynced(id: string) {
  db.runSync('UPDATE inspections SET synced = 1 WHERE id = ?', id);
}

export function markDefectSynced(id: string) {
  db.runSync('UPDATE defects SET synced = 1 WHERE id = ?', id);
}

export function pendingCount(): number {
  const i = db.getFirstSync<{ n: number }>('SELECT count(*) AS n FROM inspections WHERE synced = 0')?.n ?? 0;
  const d = db.getFirstSync<{ n: number }>('SELECT count(*) AS n FROM defects WHERE synced = 0')?.n ?? 0;
  return i + d;
}

export const newId = () => randomUUID();
