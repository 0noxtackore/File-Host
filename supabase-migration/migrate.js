'use strict';

/**
 * One-time migration from Supabase to Firebase.
 *
 *   1. Imports supabase-migration/db/folders.json  -> Firestore "folders"
 *   2. Imports supabase-migration/db/files.json    -> Firestore "files"
 *   3. Uploads  supabase-migration/files/*          -> Firebase Storage bucket
 *
 * Requirements:
 *   - `npm install firebase-admin` (already added as a dev dependency)
 *   - A service account key saved as supabase-migration/serviceAccount.json
 *     (download it from Firebase console: Project settings > Service accounts).
 *
 * Re-runnable: Firestore docs are keyed by their original IDs and Storage
 * uploads overwrite, so running it again is safe.
 *
 *   node supabase-migration/migrate.js
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = __dirname;
const FILES_DIR = path.join(ROOT, 'files');
const DB_DIR = path.join(ROOT, 'db');
const SERVICE_ACCOUNT = path.join(ROOT, 'serviceAccount.json');
const BUCKET = 'file-host-d3a49.firebasestorage.app';

function loadServiceAccount() {
  if (!fs.existsSync(SERVICE_ACCOUNT)) {
    console.error('\nMissing service account key.');
    console.error('Download it from Firebase console (Project settings > Service accounts)');
    console.error('and save it as:\n  ' + SERVICE_ACCOUNT + '\n');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, 'utf8'));
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
    storageBucket: BUCKET,
  });
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BUCKET);

  // --- Folders ---
  const folders = JSON.parse(fs.readFileSync(path.join(DB_DIR, 'folders.json'), 'utf8'));
  console.log(`Importing ${folders.length} folder(s)...`);
  for (const f of folders) {
    await db.collection('folders').doc(String(f.id)).set({
      name: f.name,
      parent_id: f.parent_id || null,
      created_at: f.created_at || new Date().toISOString(),
    });
  }
  console.log(`  ✓ folders`);

  // --- Files (metadata) ---
  const files = JSON.parse(fs.readFileSync(path.join(DB_DIR, 'files.json'), 'utf8'));
  console.log(`Importing ${files.length} file record(s)...`);
  for (const f of files) {
    await db.collection('files').doc(String(f.id)).set({
      name: f.name,
      mimetype: f.mimetype,
      size: f.size,
      storage_path: f.storage_path,
      folder_id: f.folder_id || null,
      custom_name: f.custom_name || null,
      created_at: f.created_at || new Date().toISOString(),
    });
  }
  console.log(`  ✓ file records`);

  // --- File blobs ->
  console.log(`Uploading ${files.length} file(s) to Storage...`);
  let ok = 0;
  for (const f of files) {
    const local = path.join(FILES_DIR, f.storage_path);
    if (!fs.existsSync(local)) {
      console.warn(`  ⚠ missing local file, skipping: ${f.storage_path}`);
      continue;
    }
    try {
      await bucket.upload(local, {
        destination: f.storage_path,
        metadata: { contentType: f.mimetype || 'application/octet-stream' },
      });
      ok++;
    } catch (err) {
      console.error(`  ✕ ${f.storage_path}: ${err.message}`);
    }
  }
  console.log(`\nDone. Uploaded ${ok}/${files.length} file(s) to Storage.`);
  console.log('Migration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
