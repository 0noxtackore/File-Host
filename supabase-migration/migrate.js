'use strict';

/**
 * Migration refresh: Firestore "files" -> Supabase Storage.
 *
 * For every file document that still carries an embedded base64 `data` field,
 * we upload the original blob to Supabase Storage (bucket "files", keyed by the
 * existing `storage_path`), set `url` to the public URL, and delete `data` from
 * Firestore. Documents without `data` only get their `url` refreshed (their
 * blob is assumed already present in Supabase from a previous run).
 *
 *   node supabase-migration/migrate.js            # upload from data + refresh url
 *   SKIP_UPLOAD=1 node supabase-migration/migrate.js   # only refresh url (no re-upload)
 *
 * Requires: firebase-admin + serviceAccount.json in this folder.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const ROOT = __dirname;
const SERVICE_ACCOUNT = path.join(ROOT, 'serviceAccount.json');

const SUPABASE_URL = 'https://qxgmhfugoxzzqblztuvq.supabase.co';
const SUPABASE_BUCKET = 'files';
const SUPABASE_KEY = 'sb_publishable_zs0n2Xm3WrWg2YcE7SulmA_VMPU7WVT';
const SKIP_UPLOAD = process.env.SKIP_UPLOAD === '1';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function publicUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(storagePath)}`;
}

function loadServiceAccount() {
  if (!fs.existsSync(SERVICE_ACCOUNT)) {
    console.error('\nMissing service account key:\n  ' + SERVICE_ACCOUNT + '\n');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, 'utf8'));
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
    databaseURL: 'https://file-host-d3a49-default-rtdb.europe-west1.firebasedatabase.app',
  });
  const db = admin.firestore();

  const snap = await db.collection('files').get();
  let updated = 0, uploaded = 0, skipped = 0;

  for (const d of snap.docs) {
    const f = d.data();
    if (!f.storage_path) { skipped++; continue; }
    const url = publicUrl(f.storage_path);

    if (f.data && !SKIP_UPLOAD) {
      try {
        const b64 = String(f.data).includes(',') ? f.data.split(',').pop() : f.data;
        const buf = Buffer.from(b64, 'base64');
        const { error } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(f.storage_path, buf, { contentType: f.mimetype || 'application/octet-stream', upsert: true });
        if (error) {
          console.error(`  upload failed ${f.storage_path}: ${error.message}`);
        } else {
          uploaded++;
        }
      } catch (e) {
        console.error(`  upload error ${f.storage_path}: ${e.message}`);
      }
    }

    const update = { url };
    if (f.data) update.data = admin.firestore.FieldValue.delete();
    await d.ref.update(update);
    updated++;
  }

  console.log(`\nDone. updated=${updated} uploaded=${uploaded} skipped=${skipped}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
