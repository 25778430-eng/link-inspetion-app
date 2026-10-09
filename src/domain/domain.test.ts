import { describe, expect, it } from 'vitest';
import { computeOutcome, defectsFromInspection, validateInspection } from './inspection';
import { assetStatusFromDefects, canClearDefect, canInspect } from './lockout';
import { stationForPosition } from './stations';
import { isDueToday, sastDay } from './daily';
import { defectsToTraxCsv } from './traxExport';
import { CHECKLIST_TEMPLATES } from './seed';
import type { ChecklistTemplate, ItemResult } from './types';

const tpl: ChecklistTemplate = {
  id: 't',
  assetTypeId: 'x',
  version: 1,
  items: [
    { id: 'brakes', section: 's', text: 'Brakes', critical: true, naAllowed: false },
    { id: 'mirror', section: 's', text: 'Mirror', critical: false, naAllowed: true },
    { id: 'volts', section: 's', text: 'Voltage', critical: true, naAllowed: false, reading: { unit: 'V', min: 112, max: 118 } },
  ],
};

const pass = (itemId: string, extra: Partial<ItemResult> = {}): ItemResult => ({ itemId, result: 'pass', photoUris: [], ...extra });

describe('validateInspection', () => {
  it('requires every item answered', () => {
    expect(validateInspection(tpl, [pass('brakes')]).map((i) => i.itemId)).toEqual(['mirror', 'volts']);
  });
  it('requires a photo and description on Fail', () => {
    const issues = validateInspection(tpl, [
      { itemId: 'brakes', result: 'fail', photoUris: [] },
      pass('mirror'),
      pass('volts', { readingValue: 115 }),
    ]);
    expect(issues.map((i) => i.message)).toEqual(['A photo is required for a Fail', 'Describe the fault']);
  });
  it('requires a reason for N/A and rejects N/A where not allowed', () => {
    const issues = validateInspection(tpl, [
      { itemId: 'brakes', result: 'na', photoUris: [], naReason: 'x' },
      { itemId: 'mirror', result: 'na', photoUris: [] },
      pass('volts', { readingValue: 115 }),
    ]);
    expect(issues.map((i) => i.message)).toEqual(['N/A is not allowed for this item', 'Give a reason for N/A']);
  });
  it('treats an out-of-range reading as a Fail needing a photo', () => {
    const issues = validateInspection(tpl, [pass('brakes'), pass('mirror'), pass('volts', { readingValue: 125 })]);
    expect(issues.map((i) => i.message)).toContain('A photo is required for a Fail');
  });
  it('accepts a complete inspection', () => {
    expect(validateInspection(tpl, [pass('brakes'), pass('mirror'), pass('volts', { readingValue: 115 })])).toEqual([]);
  });
});

describe('computeOutcome and lock-out', () => {
  it('a critical Fail makes the asset unserviceable and locks it out', () => {
    const results: ItemResult[] = [
      { itemId: 'brakes', result: 'fail', photoUris: ['p.jpg'], comment: 'Spongy' },
      pass('mirror'),
      pass('volts', { readingValue: 115 }),
    ];
    expect(computeOutcome(tpl, results)).toBe('unserviceable');
    let n = 0;
    const defects = defectsFromInspection({ template: tpl, results, inspectionId: 'i', assetId: 'a', userId: 'u', now: '2026-10-09T08:00:00Z', newId: () => `d${++n}` });
    expect(defects).toHaveLength(1);
    expect(defects[0].critical).toBe(true);
    expect(assetStatusFromDefects(defects)).toBe('locked_out');
    expect(canInspect('locked_out')).toBe(false);
  });
  it('a non-critical Fail leaves the asset serviceable with defects', () => {
    const results: ItemResult[] = [pass('brakes'), { itemId: 'mirror', result: 'fail', photoUris: ['p'], comment: 'Cracked' }, pass('volts', { readingValue: 115 })];
    expect(computeOutcome(tpl, results)).toBe('serviceable_with_defects');
  });
  it('an out-of-range critical reading locks the asset out', () => {
    expect(computeOutcome(tpl, [pass('brakes'), pass('mirror'), pass('volts', { readingValue: 100 })])).toBe('unserviceable');
  });
  it('only a manager can clear a critical defect', () => {
    const d = { critical: true } as never;
    expect(canClearDefect('manager', d)).toBe(true);
    expect(canClearDefect('supervisor', d)).toBe(false);
    expect(canClearDefect('maintenance', d)).toBe(false);
    expect(canClearDefect('operator', d)).toBe(false);
  });
});

describe('stations', () => {
  it('detects JNB and CPT from GPS and flags anywhere else', () => {
    expect(stationForPosition(-26.135, 28.235)).toBe('JNB');
    expect(stationForPosition(-33.97, 18.6)).toBe('CPT');
    expect(stationForPosition(-29.85, 31.02)).toBeNull(); // Durban
  });
});

describe('daily due', () => {
  it('uses the SAST calendar day', () => {
    expect(sastDay('2026-10-09T22:30:00Z')).toBe('2026-10-10');
    expect(isDueToday(null)).toBe(true);
    expect(isDueToday('2026-10-09T06:00:00Z', new Date('2026-10-09T20:00:00Z'))).toBe(false);
    expect(isDueToday('2026-10-09T06:00:00Z', new Date('2026-10-09T22:30:00Z'))).toBe(true);
  });
});

describe('TRAX export', () => {
  it('writes a CSV row per defect with quoting', () => {
    const csv = defectsToTraxCsv(
      [{ id: 'd1', assetId: 'a1', inspectionId: 'i1', itemId: 'x', itemText: 'Brakes', critical: true, description: 'Spongy, "soft" pedal', status: 'open', raisedBy: 'u1', raisedAt: '2026-10-09T08:00:00Z', clearedBy: null, clearedAt: null, clearanceNote: null, photoUris: [] }],
      [{ id: 'a1', fleetNumber: 'TT-014', assetTypeId: 'tow-tractor', station: 'JNB', description: '', status: 'locked_out' }],
      [{ id: 'u1', name: 'A Driver', staffNumber: '1234', role: 'operator', divisions: ['towing'] }],
    );
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('d1,TT-014,JNB,2026-10-09T08:00:00Z,1234 A Driver,Brakes,"Spongy, ""soft"" pedal",Y,OPEN,i1');
  });
});

describe('seed checklists', () => {
  it('have unique item ids and at least one critical item each', () => {
    for (const t of CHECKLIST_TEMPLATES) {
      const ids = t.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(t.items.some((i) => i.critical)).toBe(true);
    }
  });
});
