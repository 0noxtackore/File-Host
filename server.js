const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg|pdf|mp4|mp3|zip|txt|doc|docx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('text/') || file.mimetype === 'application/pdf' || file.mimetype === 'application/zip';
    cb(null, ext || mime);
  }
});

const stmts = {
  insertFile: db.prepare(`INSERT INTO files (filename, original_name, mimetype, size, folder_id, custom_name) VALUES (?, ?, ?, ?, ?, ?)`),
  getAllFiles: db.prepare(`SELECT * FROM files ORDER BY created_at DESC`),
  getFilesByFolder: db.prepare(`SELECT * FROM files WHERE folder_id IS ? ORDER BY created_at DESC`),
  getFileById: db.prepare(`SELECT * FROM files WHERE id = ?`),
  deleteFile: db.prepare(`DELETE FROM files WHERE id = ?`),
  renameFile: db.prepare(`UPDATE files SET custom_name = ? WHERE id = ?`),
  moveFile: db.prepare(`UPDATE files SET folder_id = ? WHERE id = ?`),

  insertFolder: db.prepare(`INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)`),
  getFoldersByParent: db.prepare(`SELECT * FROM folders WHERE parent_id IS ? ORDER BY name ASC`),
  getAllFolders: db.prepare(`SELECT * FROM folders ORDER BY name ASC`),
  getFolderById: db.prepare(`SELECT * FROM folders WHERE id = ?`),
  deleteFolder: db.prepare(`DELETE FROM folders WHERE id = ?`),
  renameFolder: db.prepare(`UPDATE folders SET name = ? WHERE id = ?`),
  moveFilesToRoot: db.prepare(`UPDATE files SET folder_id = NULL WHERE folder_id = ?`),

};

// === FILE ENDPOINTS ===

app.get('/api/files', (req, res) => {
  try {
    const { folder_id } = req.query;
    const files = folder_id !== undefined
      ? stmts.getFilesByFolder.all(folder_id === 'null' ? null : folder_id)
      : stmts.getAllFiles.all();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/:id', (req, res) => {
  try {
    const file = stmts.getFileById.get(req.params.id);
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.json(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/files', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }
    const folder_id = req.body.folder_id || null;
    const custom_name = req.body.custom_name || null;
    const inserted = [];
    for (const file of req.files) {
      const info = stmts.insertFile.run(file.filename, file.originalname, file.mimetype, file.size, folder_id, custom_name);
      inserted.push(stmts.getFileById.get(info.lastInsertRowid));
    }
    res.status(201).json(inserted.length === 1 ? inserted[0] : inserted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:id', (req, res) => {
  try {
    const file = stmts.getFileById.get(req.params.id);
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
    const filePath = path.join(uploadsDir, file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    stmts.deleteFile.run(req.params.id);
    res.json({ message: 'Archivo eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/files/:id/rename', (req, res) => {
  try {
    const { custom_name } = req.body;
    if (!custom_name || !custom_name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const file = stmts.getFileById.get(req.params.id);
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
    stmts.renameFile.run(custom_name.trim(), req.params.id);
    res.json(stmts.getFileById.get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/files/:id/move', (req, res) => {
  try {
    const { folder_id } = req.body;
    const file = stmts.getFileById.get(req.params.id);
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
    stmts.moveFile.run(folder_id || null, req.params.id);
    res.json(stmts.getFileById.get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === FOLDER ENDPOINTS ===

app.get('/api/folders', (req, res) => {
  try {
    const { parent_id } = req.query;
    const folders = parent_id !== undefined
      ? stmts.getFoldersByParent.all(parent_id === 'null' ? null : parent_id)
      : stmts.getAllFolders.all();
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folders', (req, res) => {
  try {
    const { name, parent_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const id = uuidv4();
    stmts.insertFolder.run(id, name.trim(), parent_id || null);
    res.status(201).json(stmts.getFolderById.get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/folders/:id/rename', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const folder = stmts.getFolderById.get(req.params.id);
    if (!folder) return res.status(404).json({ error: 'Carpeta no encontrada' });
    stmts.renameFolder.run(name.trim(), req.params.id);
    res.json(stmts.getFolderById.get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/folders/:id', (req, res) => {
  try {
    const folder = stmts.getFolderById.get(req.params.id);
    if (!folder) return res.status(404).json({ error: 'Carpeta no encontrada' });
    stmts.moveFilesToRoot.run(req.params.id);
    stmts.deleteFolder.run(req.params.id);
    res.json({ message: 'Carpeta eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`File Host corriendo en http://localhost:${PORT}`);
});
