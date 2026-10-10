import type { AssetType, ChecklistItem, ChecklistTemplate } from './types';

/**
 * Starter checklists. These are placeholders to be replaced by criteria from OEM manuals
 * and company procedures, approved before go-live. Critical flags are set by the administrator.
 */

type ItemDef = [text: string, opts?: Partial<Omit<ChecklistItem, 'id' | 'section' | 'text'>>];

const C = { critical: true } as const;

function section(prefix: string, name: string, defs: ItemDef[]): ChecklistItem[] {
  return defs.map(([text, opts], i) => ({
    id: `${prefix}-${i + 1}`,
    section: name,
    text,
    critical: false,
    naAllowed: false,
    ...opts,
  }));
}

const vehicleBlock = (p: string) =>
  section(`${p}-veh`, 'Vehicle walk-around', [
    ['Body, panels and guards undamaged'],
    ['Tyres: condition, no cuts or bulges', C],
    ['Engine oil, coolant and hydraulic fluid levels correct'],
    ['No fuel, oil or hydraulic leaks', C],
    ['Service brake works', C],
    ['Parking brake holds', C],
    ['Steering free and responsive', C],
    ['Lights and beacon working'],
    ['Horn working'],
    ['Seat belt fitted and working', C],
    ['Fire extinguisher present, sealed and in date', { naAllowed: true }],
    ['Mirrors intact', { naAllowed: true }],
  ]);

export const ASSET_TYPES: AssetType[] = [
  { id: 'gpu', name: 'Ground Power Unit (GPU)', division: 'maintenance' },
  { id: 'asu', name: 'Air Start Unit (ASU)', division: 'maintenance' },
  { id: 'hyd-cart', name: 'Hydraulic / nitrogen cart, jacks and stands', division: 'maintenance' },
  { id: 'tow-tractor', name: 'Tow tractor', division: 'towing' },
  { id: 'towbar', name: 'Towbar', division: 'towing' },
  { id: 'belt-loader', name: 'Belt loader', division: 'ramp' },
  { id: 'pax-steps', name: 'Passenger steps', division: 'ramp' },
  { id: 'dolly', name: 'Baggage dolly / cart', division: 'ramp' },
  { id: 'high-loader', name: 'Pallet / container loader', division: 'ramp' },
];

const items: Record<string, ChecklistItem[]> = {
  gpu: section('gpu', 'Ground power unit', [
    ['Cables, plug and pins free of cuts, burns or bent pins', C],
    ['Output voltage within limits', { ...C, reading: { unit: 'V AC', min: 112, max: 118 } }],
    ['Output frequency within limits', { ...C, reading: { unit: 'Hz', min: 395, max: 405 } }],
    ['Emergency stop works', C],
    ['No fuel, oil or coolant leaks', C],
    ['Fuel and engine oil levels correct'],
    ['Cable stowage and earthing strap in place'],
    ['Warning lights and gauges working'],
    ['Tow eye, drawbar and parking brake serviceable', C],
  ]),
  asu: section('asu', 'Air start unit', [
    ['Air hose and coupling free of cracks, splits or damaged seals', C],
    ['Duct pressure within limits', { ...C, reading: { unit: 'psi' } }],
    ['Emergency stop works', C],
    ['No fuel or oil leaks', C],
    ['Intake and exhaust clear of FOD and debris'],
    ['Hose stowage, guards and covers in place'],
  ]),
  'hyd-cart': section('hyd', 'Hydraulic / nitrogen equipment', [
    ['Calibration or pressure-test date in date', C],
    ['Hoses, fittings and gauges undamaged, no leaks', C],
    ['Locking pins, safety collars and rails in place', C],
    ['Wheels, castors and brakes serviceable'],
  ]),
  'tow-tractor': [
    ...vehicleBlock('tt'),
    ...section('tt', 'Towing equipment', [
      ['Hitch, pintle and coupling pin undamaged and secure', C],
      ['Towbarless: cradle, clamp and pick-up undamaged, no hydraulic leaks', { ...C, naAllowed: true }],
      ['Radio or headset communication working', C],
    ]),
  ],
  towbar: section('tb', 'Towbar', [
    ['Shear pins fitted, correct type, not sheared or bent', C],
    ['Aircraft-type identification plate present and legible', { photoOnPass: true }],
    ['Tow head and attachment pins undamaged, locking correct', C],
    ['Bar free of cracks, bends or weld damage', C],
    ['Wheels, tyres and height adjustment working'],
    ['Safety pins and lanyards present'],
  ]),
  'belt-loader': [
    ...vehicleBlock('bl'),
    ...section('bl', 'Belt loader', [
      ['Belt free of tears, tracking correctly, start and stop work', C],
      ['Boom raise and lower, no hydraulic leaks', C],
      ['Rubber bumpers and guard rails intact', C],
      ['Emergency stop works', C],
    ]),
  ],
  'pax-steps': section('ps', 'Passenger steps', [
    ['Handrails, treads and platform secure', C],
    ['Stabilisers or jacks deploy and lock', C],
    ['Bumpers on aircraft contact edge intact', C],
    ['Lighting for night operations', { naAllowed: true }],
    ['Brakes and wheels serviceable', C],
  ]),
  dolly: section('dl', 'Baggage dolly / cart', [
    ['Drawbar, tow eye and coupling secure', C],
    ['Brakes and wheels serviceable', C],
    ['Curtains, side panels and floor rollers or locks', { naAllowed: true }],
  ]),
  'high-loader': [
    ...vehicleBlock('hl'),
    ...section('hl', 'Loader platform', [
      ['Platform raise and lower, level, no hydraulic leaks', C],
      ['Stops, guides and rollers working', C],
      ['Bumpers and proximity sensors working', C],
      ['Emergency stop works', C],
    ]),
  ],
};

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = ASSET_TYPES.map((t) => ({
  id: `tpl-${t.id}`,
  assetTypeId: t.id,
  version: 1,
  items: items[t.id],
}));
