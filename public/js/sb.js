// Full backend module — Supabase only.
//   - Postgres (via PostgREST) for folders + files metadata
//   - Storage for the original file blobs
//   - Auth (email/password + anonymous)
// Firebase has been removed entirely.

const { createClient } = window.supabase;

const SUPABASE_URL = 'https://qxgmhfugoxzzqblztuvq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zs0n2Xm3WrWg2YcE7SulmA_VMPU7WVT';
export const BUCKET = 'files';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Public URL of a stored original (used for download + detail preview).
export function publicUrl(p) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(p)}`;
}

function genId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
}

// === AUTH (PIN) ===
// The app no longer uses email/password. Access is granted by a PIN
// stored in the `pins` table on Supabase. We keep a local session flag
// in localStorage so reloads stay authenticated.

const PIN_SESSION_KEY = 'fh_pin_session';

export async function verifyPin(pin) {
  const { data, error } = await supabase
    .from('pins')
    .select('pin')
    .eq('pin', pin)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export function setSession() {
  localStorage.setItem(PIN_SESSION_KEY, '1');
}

export function clearSession() {
  localStorage.removeItem(PIN_SESSION_KEY);
}

export function getSession() {
  return localStorage.getItem(PIN_SESSION_KEY) === '1';
}

// === FOLDERS ===

export async function fetchFolders() {
  const { data, error } = await supabase
    .from('folders')
    .select('id, name, parent_id, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(r => ({ id: r.id, name: r.name, parent_id: r.parent_id || null, created_at: r.created_at }));
}

export async function createFolder({ name, parent_id }) {
  const { data, error } = await supabase
    .from('folders')
    .insert({ id: genId(), name, parent_id: parent_id || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameFolder(id, name) {
  const { error } = await supabase.from('folders').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function moveFolder(id, parentId) {
  const { error } = await supabase.from('folders').update({ parent_id: parentId || null }).eq('id', id);
  if (error) throw error;
}

export async function removeFolder(id) {
  // Re-parent contained files to root, then delete the folder.
  await supabase.from('files').update({ folder_id: null }).eq('folder_id', id);
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) throw error;
}

// === FILES ===

export async function fetchFiles() {
  const { data, error } = await supabase
    .from('files')
    .select('id, name, mimetype, size, storage_path, folder_id, custom_name, created_at, url')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({ ...r, folder_id: r.folder_id || null }));
}

export async function getFileFull(id) {
  const { data, error } = await supabase.from('files').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function addFileRecord(rec) {
  const { error } = await supabase.from('files').insert({
    id: genId(),
    name: rec.name,
    mimetype: rec.mimetype,
    size: rec.size,
    storage_path: rec.storage_path,
    folder_id: rec.folder_id || null,
    custom_name: rec.custom_name || null,
    url: rec.url,
  });
  if (error) throw error;
}

export async function updateFileRecord(id, patch) {
  const { error } = await supabase.from('files').update(patch).eq('id', id);
  if (error) throw error;
}

export async function removeFileRecord(id) {
  const { error } = await supabase.from('files').delete().eq('id', id);
  if (error) throw error;
}
