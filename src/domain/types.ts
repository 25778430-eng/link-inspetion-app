export type Division = 'maintenance' | 'towing' | 'ramp';

export const DIVISION_LABELS: Record<Division, string> = {
  maintenance: 'Maintenance',
  towing: 'Towing',
  ramp: 'Ramp',
};

export type Role =
  | 'operator'
  | 'supervisor'
  | 'manager'
  | 'maintenance'
  | 'admin'
  | 'auditor';

export type StationCode = 'JNB' | 'CPT';

export type ItemResultValue = 'pass' | 'fail' | 'na';

export type InspectionOutcome =
  | 'serviceable'
  | 'serviceable_with_defects'
  | 'unserviceable';

export type AssetStatus =
  | 'serviceable'
  | 'serviceable_with_defects'
  | 'locked_out'
  | 'out_of_service';

export type DefectStatus = 'open' | 'deferred' | 'in_work' | 'closed';

export interface User {
  id: string;
  name: string;
  staffNumber: string;
  role: Role;
  divisions: Division[];
}

export interface AssetType {
  id: string;
  name: string;
  division: Division;
}

export interface Asset {
  id: string;
  fleetNumber: string;
  assetTypeId: string;
  station: StationCode;
  description: string;
  status: AssetStatus;
}

export interface ChecklistItem {
  id: string;
  section: string;
  text: string;
  helpText?: string;
  /** Pre-selected by an administrator. A Fail locks the asset out. */
  critical: boolean;
  naAllowed: boolean;
  /** When set, the inspector records a reading; out-of-range values fail automatically. */
  reading?: { unit: string; min?: number; max?: number };
  photoOnPass?: boolean;
}

export interface ChecklistTemplate {
  id: string;
  assetTypeId: string;
  version: number;
  items: ChecklistItem[];
}

export interface ItemResult {
  itemId: string;
  result: ItemResultValue | null;
  readingValue?: number | null;
  comment?: string;
  naReason?: string;
  photoUris: string[];
}

export interface Inspection {
  id: string;
  assetId: string;
  templateId: string;
  templateVersion: number;
  userId: string;
  station: StationCode | null;
  latitude: number | null;
  longitude: number | null;
  startedAt: string;
  submittedAt: string | null;
  meterReading: number | null;
  outcome: InspectionOutcome | null;
  results: ItemResult[];
}

export interface Defect {
  id: string;
  assetId: string;
  inspectionId: string;
  itemId: string;
  itemText: string;
  critical: boolean;
  description: string;
  status: DefectStatus;
  raisedBy: string;
  raisedAt: string;
  clearedBy: string | null;
  clearedAt: string | null;
  clearanceNote: string | null;
  photoUris: string[];
}
