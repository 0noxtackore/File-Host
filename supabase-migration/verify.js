'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'serviceAccount.json');
const SUPABASE_URL = 'https://qxgmhfugoxzzqblztuvq.supabase.co';
const BUCKET = 'files';

async function main() {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, 'utf8'))),
    databaseURL: 'https://file-host-d3a49-default-rtdb.europe-west1.firebasedatabase.app',
  });
  const db = admin.firestore();
  const snap = await db.collection('files').get();
  let missing = 0, ok = 0;
  const list = snap.docs.map(d => ({ id: d.id, sp: d.data().storage_path, url: d.data().url }));
  for (const f of list) {
    if (!f.sp) { missing++; continue; }
    const u = f.url || `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(f.sp)}`;
    try {
      const r = await fetch(u, { method: 'HEAD' });
      if (r.ok) ok++; else { missing++; console.log('MISSING', f.sp, r.status); }
    } catch (e) { missing++; console.log('ERR', f.sp, e.message); }
  }
  console.log(`\nTotal=${list.length} ok=${ok} missing=${missing}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
