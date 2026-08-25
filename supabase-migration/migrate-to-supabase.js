'use strict';

/**
 * Data migration: Firebase Firestore -> Supabase Postgres.
 *
 * Reads the current Firestore collections (folders + files, which already hold
 * `storage_path` + `url` pointing at Supabase Storage) and inserts them into the
 * Supabase `folders` / `files` tables. The Supabase schema (supabase/schema.sql)
 * must already be applied.
 *
 *   node supabase-migration/migrate-to-supabase.js
 *
 * Requires: firebase-admin (serviceAccount.json) + @supabase/supabase-js.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const ROOT = __dirname;
const SERVICE_ACCOUNT = path.join(ROOT, 'serviceAccount.json');
const SUPABASE_URL = 'https://qxgmhfugoxzzqblztuvq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zs0n2Xm3WrWg2YcE7SulmA_VMPU7WVT';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, 'utf8'))),
    databaseURL: 'https://file-host-d3a49-default-rtdb.europe-west1.firebasedatabase.app',
  });
  const db = admin.firestore();

  // --- Folders (clean re-sync from Firestore, the source of truth) ---
  const foldersSnap = await db.collection('folders').get();
  const folderRows = foldersSnap.docs.map(d => {
    const f = d.data();
    return { id: d.id, name: f.name, parent_id: f.parent_id || null, created_at: f.created_at || new Date().toISOString() };
  });
  console.log(`Folders to migrate: ${folderRows.length}`);
  await supabase.from('folders').delete().neq('id', '__never__'); // clear existing
  for (const c of chunk(folderRows, 200)) {
    const { error } = await supabase.from('folders').insert(c);
    if (error) { console.error('Folder insert error:', error.message); throw error; }
  }
  console.log('  ✓ folders');

  // --- Files ---
  const filesSnap = await db.collection('files').get();
  const fileRows = filesSnap.docs.map(d => {
    const f = d.data();
    const url = f.url || `${SUPABASE_URL}/storage/v1/object/public/files/${encodeURIComponent(f.storage_path)}`;
    return {
      id: d.id,
      name: f.name,
      mimetype: f.mimetype || null,
      size: f.size || 0,
      storage_path: f.storage_path || null,
      folder_id: f.folder_id || null,
      custom_name: f.custom_name || null,
      created_at: f.created_at || new Date().toISOString(),
      url,
    };
  });
  console.log(`Files to migrate: ${fileRows.length}`);
  await supabase.from('files').delete().neq('id', '__never__'); // clear existing
  let done = 0;
  for (const c of chunk(fileRows, 200)) {
    const { error } = await supabase.from('files').insert(c);
    if (error) { console.error('File insert error:', error.message); throw error; }
    done += c.length;
  }
  console.log(`  ✓ files (${done})`);
  console.log('\nMigration complete. Firebase is no longer needed.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
