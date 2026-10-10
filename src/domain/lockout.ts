import type { AssetStatus, Defect, Role } from './types';

/**
 * Asset status is derived from its open defects, never set by hand:
 * any open critical defect means the asset is locked out.
 */
export function assetStatusFromDefects(defects: Defect[], outOfService = false): AssetStatus {
  if (outOfService) return 'out_of_service';
  const open = defects.filter((d) => d.status !== 'closed');
  if (open.some((d) => d.critical)) return 'locked_out';
  if (open.length > 0) return 'serviceable_with_defects';
  return 'serviceable';
}

export function canInspect(status: AssetStatus): boolean {
  return status !== 'locked_out' && status !== 'out_of_service';
}

export const PERMISSIONS = {
  inspect: ['operator', 'supervisor', 'manager', 'maintenance', 'admin'],
  viewDashboard: ['supervisor', 'manager', 'admin', 'auditor'],
  /** Only a manager may clear a critical lock-out and return the asset to service. */
  clearLockout: ['manager'],
  closeNonCriticalDefect: ['supervisor', 'manager', 'maintenance'],
  exportTrax: ['manager', 'maintenance', 'admin'],
  manageChecklists: ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function canClearDefect(role: Role, defect: Defect): boolean {
  return defect.critical ? can(role, 'clearLockout') : can(role, 'closeNonCriticalDefect') || can(role, 'clearLockout');
}
