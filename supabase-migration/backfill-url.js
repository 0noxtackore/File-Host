'use strict';

/**
 * Backfill: set the `url` column of existing files from their `storage_path`.
 * The folders/files data is already in Supabase (angello's data); we only need
 * to populate `url` (public Storage URL) so the app can preview/download.
 *
 * Requires supabase/schema.sql to have been run first (adds the `url` column
 * and the public RLS policies).
 *
 *   node supabase-migration/backfill-url.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qxgmhfugoxzzqblztuvq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zs0n2Xm3WrWg2YcE7SulmA_VMPU7WVT';
const BUCKET = 'files';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function publicUrl(p) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(p)}`;
}

async function main() {
  let updated = 0, skipped = 0, page = 0;
  const PAGE = 500;
  while (true) {
    const { data, error } = await supabase
      .from('files')
      .select('id, storage_path, url')
      .range(page * PAGE, page * PAGE + (PAGE - 1));
    if (error) { console.error('Select error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;

    for (const r of data) {
      if (r.url && r.url.length > 0) { skipped++; continue; }
      if (!r.storage_path) { skipped++; continue; }
      const { error: ue } = await supabase
        .from('files')
        .update({ url: publicUrl(r.storage_path) })
        .eq('id', r.id);
      if (ue) { console.error(`update ${r.id}: ${ue.message}`); }
      else updated++;
    }
    if (data.length < PAGE) break;
    page++;
  }
  console.log(`\nBackfill done. updated=${updated} skipped=${skipped}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
