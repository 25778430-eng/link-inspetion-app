// Generates supabase/seed.sql from the starter checklists in src/domain/seed.ts.
// Run: npx tsx scripts/gen-seed-sql.ts > supabase/seed.sql
import { ASSET_TYPES, CHECKLIST_TEMPLATES } from '../src/domain/seed';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const out: string[] = ['-- Starter asset types and checklists (placeholders until OEM-based criteria are approved).', ''];
out.push('insert into asset_types (id, name, division) values');
out.push(ASSET_TYPES.map((t) => `  (${q(t.id)}, ${q(t.name)}, ${q(t.division)})`).join(',\n') + '\non conflict (id) do nothing;', '');
out.push('insert into checklist_templates (id, version, asset_type_id, items, published, published_at) values');
out.push(
  CHECKLIST_TEMPLATES.map((t) => `  (${q(t.id)}, ${t.version}, ${q(t.assetTypeId)}, ${q(JSON.stringify(t.items))}::jsonb, true, now())`).join(',\n') +
    '\non conflict (id, version) do nothing;',
);
console.log(out.join('\n'));
