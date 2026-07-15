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
  insert: db.prepare(`INSERT INTO files (filename, original_name, mimetype, size) VALUES (?, ?, ?, ?)`),
  getAll: db.prepare(`SELECT * FROM files ORDER BY created_at DESC`),
  getById: db.prepare(`SELECT * FROM files WHERE id = ?`),
  delete: db.prepare(`DELETE FROM files WHERE id = ?`),
};

app.get('/api/files', (req, res) => {
  try {
    const files = stmts.getAll.all();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/:id', (req, res) => {
  try {
    const file = stmts.getById.get(req.params.id);
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
    const inserted = [];
    for (const file of req.files) {
      const info = stmts.insert.run(file.filename, file.originalname, file.mimetype, file.size);
      inserted.push(stmts.getById.get(info.lastInsertRowid));
    }
    res.status(201).json(inserted.length === 1 ? inserted[0] : inserted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:id', (req, res) => {
  try {
    const file = stmts.getById.get(req.params.id);
    if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
    const filePath = path.join(uploadsDir, file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    stmts.delete.run(req.params.id);
    res.json({ message: 'Archivo eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`File Host corriendo en http://localhost:${PORT}`);
});