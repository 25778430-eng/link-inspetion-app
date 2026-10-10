# Link pre-use inspection app

A mobile app for daily pre-use inspections of ground support equipment in the Maintenance, Towing and Ramp divisions. Every checklist item is marked Pass, Fail or N/A. A Fail needs a photo, and a Fail on a critical item locks the asset out until a manager clears it.

The full framework, decisions and open questions are in the project doc *Pre-use Inspection App Framework*.

## What version 1 does

- **Division modules:** users see the Maintenance, Towing or Ramp assets they are assigned to.
- **Daily inspections:** each asset is marked *Due today* until it has been inspected that day (SAST).
- **Checklists per asset type:** checklists are stored as versioned data (`checklist_templates`), so administrators can change them without an app release. Each inspection records the version it used.
- **Pass / Fail / N/A:** every item must be answered. A Fail needs an in-app photo and a description. N/A needs a reason and only appears where the administrator allows it. Out-of-range readings (for example GPU voltage) fail automatically.
- **Critical items and lock-out:** administrators pre-select critical items. A critical Fail locks the asset out on the device straight away, and on the server when the inspection uploads. Only a **manager** can clear a lock-out, and they must record a clearance note. This is enforced on the server by `clear_defect()`, not just in the app.
- **Works offline:** all data is held on the device in SQLite. Inspections, defects and photos queue there and upload automatically when the device connects to Wi-Fi or mobile data.
- **Station from GPS:** the station (JNB or CPT) is set from the device's location. Inspections done outside both geofences are flagged.
- **TRAX eMRO:** defects export to a CSV file for import into TRAX. The column layout in `src/domain/traxExport.ts` is a placeholder and needs to match your TRAX import template.

## Project layout

| Path | Contents |
| --- | --- |
| `src/domain/` | Business rules with no UI: outcome, lock-out, roles, geofence, daily due, TRAX export, starter checklists. Unit-tested. |
| `src/db/local.ts` | Offline SQLite store on the device |
| `src/sync/` | Supabase client and the upload/download sync |
| `src/app/` | Screens (Expo Router): sign-in, home, scan, inspection, defects |
| `supabase/migrations/` | Database schema, roles, lock-out triggers, row-level security |
| `supabase/tests/` | SQL test for the lock-out and manager-only clearance rules |

## Run it

```bash
npm install
npm test            # domain unit tests
npm run typecheck
npx expo start      # scan the QR code with Expo Go
```

If no backend is configured, the app runs in **demo mode**. It has demo assets at JNB and CPT and demo operator, supervisor and manager users, so every role can be tried on a phone.

## Connect the backend (Supabase)

1. Create a Supabase project. For data residency, choose a region close to South Africa.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql` (starter asset types and checklists, generated from `src/domain/seed.ts` by `scripts/gen-seed-sql.ts`).
3. Create users under Authentication > Users, then use `supabase/first_users.sql` to give each one a profile (role, divisions, station) and to add your assets.
4. Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Microsoft 365 sign-in can be added by enabling the Azure provider in Supabase Auth. It is not wired into the app yet; version 1 uses email and password.

## Test the database rules

With a local Postgres 16:

```bash
createdb inspection_test
psql -d inspection_test -f supabase/tests/00_supabase_stub.sql -f supabase/migrations/0001_init.sql
psql -d inspection_test -f supabase/tests/lockout_test.sql
```

The expected result is: the asset becomes `locked_out` after a critical Fail; direct updates are refused; a supervisor clearance is refused; a manager clearance with a note returns the asset to `serviceable`.

## Build for devices

The app uses native modules (camera, SQLite, location), so pilot devices need an EAS build: `npx eas-cli@latest build --profile preview`.
