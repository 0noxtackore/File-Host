const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'filehost.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
  )
`);

const columns = db.prepare("PRAGMA table_info(files)").all().map(c => c.name);
if (!columns.includes('folder_id')) {
  db.exec(`ALTER TABLE files ADD COLUMN folder_id TEXT`);
}
if (!columns.includes('custom_name')) {
  db.exec(`ALTER TABLE files ADD COLUMN custom_name TEXT`);
}

module.exports = db;
