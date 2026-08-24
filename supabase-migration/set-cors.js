'use strict';

/**
 * Sets the CORS configuration on the Firebase Storage bucket so that the
 * browser can download files via fetch() (needed by the app's download feature).
 *
 * Requires supabase-migration/serviceAccount.json (Firebase console >
 * Project settings > Service accounts). Run:
 *
 *   node supabase-migration/set-cors.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');

const ROOT = __dirname;
const SERVICE_ACCOUNT = path.join(ROOT, 'serviceAccount.json');
const CORS_FILE = path.join(__dirname, '..', 'storage-cors.json');
const BUCKET = 'file-host-d3a49.firebasestorage.app';

if (!fs.existsSync(SERVICE_ACCOUNT)) {
  console.error('Missing serviceAccount.json. Download it from the Firebase console and retry.');
  process.exit(1);
}

const cors = JSON.parse(fs.readFileSync(CORS_FILE, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, 'utf8'))),
  databaseURL: 'https://file-host-d3a49-default-rtdb.europe-west1.firebasedatabase.app',
  storageBucket: BUCKET,
});

async function setCors() {
  const { access_token: token } = await admin.app().options.credential.getAccessToken();
  const body = JSON.stringify({ cors });
  const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}?fields=cors`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('CORS updated on bucket', BUCKET);
          console.log(JSON.parse(data).cors);
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

setCors()
  .then(() => process.exit(0))
  .catch(err => { console.error('Failed to set CORS:', err.message); process.exit(1); });
