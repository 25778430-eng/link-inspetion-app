import type {
  ChecklistItem,
  ChecklistTemplate,
  Defect,
  InspectionOutcome,
  ItemResult,
} from './types';

export interface ValidationIssue {
  itemId: string;
  message: string;
}

/** A reading outside its configured range counts as a Fail, whatever the inspector tapped. */
export function readingOutOfRange(item: ChecklistItem, value: number | null | undefined): boolean {
  if (!item.reading || value === null || value === undefined) return false;
  const { min, max } = item.reading;
  return (min !== undefined && value < min) || (max !== undefined && value > max);
}

export function effectiveResult(item: ChecklistItem, r: ItemResult | undefined): ItemResult['result'] {
  if (!r || r.result === null) return null;
  if (r.result === 'pass' && readingOutOfRange(item, r.readingValue)) return 'fail';
  return r.result;
}

/**
 * Every item must be answered before submission: the answer is the evidence the item was inspected.
 * A Fail needs at least one photo and a description; an N/A needs a reason and must be allowed.
 */
export function validateInspection(
  template: ChecklistTemplate,
  results: ItemResult[],
): ValidationIssue[] {
  const byId = new Map(results.map((r) => [r.itemId, r]));
  const issues: ValidationIssue[] = [];
  for (const item of template.items) {
    const r = byId.get(item.id);
    const result = effectiveResult(item, r);
    if (!r || result === null) {
      issues.push({ itemId: item.id, message: 'Not answered' });
      continue;
    }
    if (item.reading && (r.readingValue === null || r.readingValue === undefined) && r.result !== 'na') {
      issues.push({ itemId: item.id, message: `Enter the reading (${item.reading.unit})` });
    }
    if (result === 'fail') {
      if (r.photoUris.length === 0) issues.push({ itemId: item.id, message: 'A photo is required for a Fail' });
      if (!r.comment?.trim()) issues.push({ itemId: item.id, message: 'Describe the fault' });
    }
    if (result === 'na') {
      if (!item.naAllowed) issues.push({ itemId: item.id, message: 'N/A is not allowed for this item' });
      else if (!r.naReason?.trim()) issues.push({ itemId: item.id, message: 'Give a reason for N/A' });
    }
    if (result === 'pass' && item.photoOnPass && r.photoUris.length === 0) {
      issues.push({ itemId: item.id, message: 'A photo is required for this item' });
    }
  }
  return issues;
}

export function computeOutcome(template: ChecklistTemplate, results: ItemResult[]): InspectionOutcome {
  const byId = new Map(results.map((r) => [r.itemId, r]));
  let anyFail = false;
  for (const item of template.items) {
    if (effectiveResult(item, byId.get(item.id)) !== 'fail') continue;
    if (item.critical) return 'unserviceable';
    anyFail = true;
  }
  return anyFail ? 'serviceable_with_defects' : 'serviceable';
}

/** One defect per failed item. Critical defects drive the automatic lock-out. */
export function defectsFromInspection(args: {
  template: ChecklistTemplate;
  results: ItemResult[];
  inspectionId: string;
  assetId: string;
  userId: string;
  now: string;
  newId: () => string;
}): Defect[] {
  const { template, results, inspectionId, assetId, userId, now, newId } = args;
  const byId = new Map(results.map((r) => [r.itemId, r]));
  const defects: Defect[] = [];
  for (const item of template.items) {
    const r = byId.get(item.id);
    if (effectiveResult(item, r) !== 'fail' || !r) continue;
    const reading =
      item.reading && r.readingValue !== null && r.readingValue !== undefined
        ? ` (reading ${r.readingValue} ${item.reading.unit})`
        : '';
    defects.push({
      id: newId(),
      assetId,
      inspectionId,
      itemId: item.id,
      itemText: item.text,
      critical: item.critical,
      description: `${r.comment?.trim() ?? ''}${reading}`.trim(),
      status: 'open',
      raisedBy: userId,
      raisedAt: now,
      clearedBy: null,
      clearedAt: null,
      clearanceNote: null,
      photoUris: [...r.photoUris],
    });
  }
  return defects;
}
