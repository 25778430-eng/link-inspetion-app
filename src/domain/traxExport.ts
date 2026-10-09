import type { Asset, Defect, User } from './types';

/**
 * Version 1 sends defects to TRAX eMRO by file export.
 * Column names are a placeholder layout; align them with the TRAX import template your TRAX administrator uses.
 */
export const TRAX_COLUMNS = [
  'DEFECT_ID',
  'EQUIPMENT_NO',
  'STATION',
  'REPORTED_DATE',
  'REPORTED_BY',
  'ITEM',
  'DESCRIPTION',
  'CRITICAL',
  'STATUS',
  'INSPECTION_ID',
] as const;

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function defectsToTraxCsv(defects: Defect[], assets: Asset[], users: User[]): string {
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const rows = defects.map((d) => {
    const asset = assetById.get(d.assetId);
    const user = userById.get(d.raisedBy);
    return [
      d.id,
      asset?.fleetNumber ?? d.assetId,
      asset?.station ?? '',
      d.raisedAt,
      user ? `${user.staffNumber} ${user.name}` : d.raisedBy,
      d.itemText,
      d.description,
      d.critical ? 'Y' : 'N',
      d.status.toUpperCase(),
      d.inspectionId,
    ].map(csvCell);
  });
  return [TRAX_COLUMNS.join(','), ...rows.map((r) => r.join(','))].join('\r\n') + '\r\n';
}
