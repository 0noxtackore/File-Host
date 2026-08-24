// Firebase initialization + data layer for File Host.
// Replaces the previous Supabase client. Uses the Firebase Web SDK (modular)
// loaded via the import map in index.html.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  select,
  writeBatch,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  deleteObject,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyChQwvNEz98LSbNdxO6pIT6Lb-XkTXO4SE',
  authDomain: 'file-host-d3a49.firebaseapp.com',
  projectId: 'file-host-d3a49',
  storageBucket: 'file-host-d3a49.firebasestorage.app',
  messagingSenderId: '258023746859',
  appId: '1:258023746859:web:e74108b598c9b57dfa696e',
  measurementId: 'G-NQ4X1QPZXC',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const BUCKET = firebaseConfig.storageBucket;

// Synchronous public URL. The Storage bucket is configured for public read
// (see storage.rules), so we can build the URL directly without a token.
export function fileUrl(p) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(p)}?alt=media`;
}

// === FOLDERS (Firestore collection: "folders") ===

export async function fetchFolders() {
  const snap = await getDocs(collection(db, 'folders'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createFolder({ name, parent_id }) {
  const refDoc = doc(collection(db, 'folders'));
  const data = { name, parent_id: parent_id || null, created_at: new Date().toISOString() };
  await setDoc(refDoc, data);
  return { id: refDoc.id, ...data };
}

export async function renameFolder(id, name) {
  await updateDoc(doc(db, 'folders', id), { name });
}

export async function moveFolder(id, parent_id) {
  await updateDoc(doc(db, 'folders', id), { parent_id: parent_id || null });
}

// Deletes a folder and moves its files back to the root.
export async function removeFolder(id) {
  const batch = writeBatch(db);
  const filesSnap = await getDocs(query(collection(db, 'files'), where('folder_id', '==', id)));
  filesSnap.forEach(f => batch.update(doc(db, 'files', f.id), { folder_id: null }));
  batch.delete(doc(db, 'folders', id));
  await batch.commit();
}

// === FILES (Firestore collection: "files") ===

// Gallery listing: lightweight — excludes the heavy base64 `data` field so the
// initial load stays fast. Use getFileFull() to fetch `data` on demand.
export async function fetchFiles() {
  const q = query(
    collection(db, 'files'),
    select('name', 'mimetype', 'size', 'storage_path', 'folder_id', 'custom_name', 'created_at', 'data_skipped')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Full document including the embedded base64 `data` (used for preview/download).
export async function getFileFull(id) {
  const snap = await getDoc(doc(db, 'files', id));
  return { id: snap.id, ...snap.data() };
}

export async function addFileRecord(data) {
  const refDoc = doc(collection(db, 'files'));
  const record = { created_at: new Date().toISOString(), ...data };
  await setDoc(refDoc, record);
  return { id: refDoc.id, ...record };
}

export async function updateFileRecord(id, fields) {
  await updateDoc(doc(db, 'files', id), fields);
}

export async function removeFileRecord(id) {
  await deleteDoc(doc(db, 'files', id));
}

// === STORAGE (Firebase Storage bucket) ===

export async function uploadFile(path, blob) {
  await uploadBytes(ref(storage, path), blob);
}

export async function deleteStorageFile(path) {
  await deleteObject(ref(storage, path));
}
