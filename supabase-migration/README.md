# Supabase → Firebase migration staging

This folder held the snapshot pulled from Supabase, and now contains the
scripts to push that data into Firebase.

- `files/`            Local copy of every file from the Supabase Storage bucket
                      `files`. File names match their `storage_path`.
- `db/files.json`     Export of the Supabase Postgres `files` table.
- `db/folders.json`   Export of the Supabase Postgres `folders` table.
- `pull.js`           (One-time) downloaded the files + DB rows from Supabase.
- `migrate.js`        (One-time) imports the DB rows into Firestore and uploads
                      the files into Firebase Storage.
- `serviceAccount.example.json`  Template for the key `migrate.js` needs.

## Migrate to Firebase

1. Install the admin dependency (already added as a dev dependency):

   ```bash
   npm install
   ```

2. Download a service account key from the Firebase console
   (Project settings → Service accounts → Generate new private key) and save it
   as `supabase-migration/serviceAccount.json`
   (see `serviceAccount.example.json` for the shape). This file is git-ignored.

3. Run the migration:

   ```bash
   node supabase-migration/migrate.js
   ```

   It is safe to re-run: Firestore docs are keyed by their original IDs and
   Storage uploads overwrite.

### Migration modes (environment variables)

- Default: imports the DB rows into Firestore **and** uploads the binary files
  to Firebase Storage.
- `SKIP_STORAGE=1`: imports only the Firestore metadata, no Storage upload.
- `BASE64=1`: embeds each file as a base64 data URL **inside the Firestore
  document** (no Storage used). Because Firestore caps documents at ~1 MB,
  only files up to ~700 KB are embedded; larger files are stored as metadata
  with `data_skipped: true`. The app shows embedded base64 automatically.

## After migrating

Deploy the security rules (see `firestore.rules` and `storage.rules` at the
repo root), then the app talks directly to Firebase from the browser. The
`files/` and `db/` folders can be deleted once everything is verified.
