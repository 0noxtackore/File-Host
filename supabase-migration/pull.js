'use strict';

/**
 * Pulls every file (and the DB rows) out of Supabase into this local staging
 * folder. Run once to snapshot the current Supabase state before migrating to
 * Firebase.
 *
 *   npm install @supabase/supabase-js
 *   node supabase-migration/pull.js
 *
 * Credentials fall back to the public values already used by the frontend.
 * Override them with environment variables if needed.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qxgmhfugoxzzqblztuvq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zs0n2Xm3WrWg2YcE7SulmA_VMPU7WVT';
const BUCKET = process.env.SUPABASE_BUCKET || 'files';

const ROOT = __dirname;
const FILES_DIR = path.join(ROOT, 'files');
const DB_DIR = path.join(ROOT, 'db');

async function main() {
  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch {
    console.error('Missing dependency: run  npm install @supabase/supabase-js');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  fs.mkdirSync(FILES_DIR, { recursive: true });
  fs.mkdirSync(DB_DIR, { recursive: true });

  // --- Export database tables ---
  for (const table of ['files', 'folders']) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Failed to read "${table}": ${error.message}`);
      process.exit(1);
    }
    fs.writeFileSync(path.join(DB_DIR, `${table}.json`), JSON.stringify(data, null, 2));
    console.log(`Exported ${data.length} row(s) from "${table}"`);
  }

  // --- Recursively list every object in the bucket ---
  const paths = [];
  async function walk(prefix) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (error) {
      console.error(`Failed to list "${prefix}": ${error.message}`);
      process.exit(1);
    }
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        // It's a folder, recurse.
        await walk(full);
      } else {
        paths.push(full);
      }
    }
  }
  await walk('');

  console.log(`Found ${paths.length} file(s) in bucket "${BUCKET}"`);

  // --- Download each file, keeping its storage_path as the local name ---
  let ok = 0;
  for (const p of paths) {
    const outPath = path.join(FILES_DIR, p);
    if (fs.existsSync(outPath)) {
      ok++;
      continue;
    }
    const { data, error } = await supabase.storage.from(BUCKET).download(p);
    if (error) {
      console.error(`  ✕ ${p}: ${error.message}`);
      continue;
    }
    const out = path.join(FILES_DIR, p);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const buf = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(out, buf);
    ok++;
    console.log(`  ✓ ${p}`);
  }

  console.log(`\nDone. ${ok}/${paths.length} file(s) saved to supabase-migration/files/`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
