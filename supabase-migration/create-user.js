'use strict';

/**
 * Creates the app user angello@gmail.com / Spidey123 in Firebase Auth.
 *
 * Requires a service account key at supabase-migration/serviceAccount.json
 * (Firebase console > Project settings > Service accounts). Run:
 *
 *   node supabase-migration/create-user.js
 *
 * Safe to re-run: if the user already exists it just reports it.
 */

const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'serviceAccount.json');

if (!require('fs').existsSync(SERVICE_ACCOUNT)) {
  console.error('Missing serviceAccount.json. Download it from the Firebase console and retry.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT)),
  databaseURL: 'https://file-host-d3a49-default-rtdb.europe-west1.firebasedatabase.app',
});

const EMAIL = 'angello@gmail.com';
const PASSWORD = 'Spidey123';

admin.auth().createUser({ email: EMAIL, password: PASSWORD, emailVerified: false })
  .then(u => { console.log(`Created user ${EMAIL} (uid: ${u.uid})`); process.exit(0); })
  .catch(err => {
    if (err.code === 'auth/email-already-exists') {
      console.log(`User ${EMAIL} already exists.`);
      process.exit(0);
    }
    console.error('Error creating user:', err.message);
    process.exit(1);
  });
