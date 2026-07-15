let selectedFiles = [];
let currentFileId = null;
let allFiles = [];
let viewMode = 'grid';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const uploadModal = $('#uploadModal');
const detailModal = $('#detailModal');
const confirmModal = $('#confirmModal');
const gallery = $('#gallery');
const empty = $('#empty');
const noResults = $('#noResults');
const stats = $('#stats');
const fileInput = $('#fileInput');
const dropZone = $('#dropZone');
const filePreview = $('#filePreview');
const uploadForm = $('#uploadForm');
const searchInput = $('#searchInput');

/* ===== TOASTS ===== */
function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = $('#toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

/* ===== MODALS ===== */
function openModal(modal) { modal.classList.add('active'); }
function closeModal(modal) { modal.classList.remove('active'); }

function closeAll() {
  [uploadModal, detailModal, confirmModal].forEach(m => closeModal(m));
}

$$('[data-close]').forEach(btn => btn.addEventListener('click', closeAll));

$$('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAll();
});

/* ===== UPLOAD ===== */
$('#uploadBtn').addEventListener('click', () => {
  selectedFiles = [];
  filePreview.innerHTML = '';
  fileInput.value = '';
  $('#uploadProgress').style.display = 'none';
  openModal(uploadModal);
});

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => addFiles(fileInput.files));

function addFiles(fileList) {
  for (const f of fileList) {
    if (!selectedFiles.find(s => s.name === f.name && s.size === f.size)) {
      selectedFiles.push(f);
    }
  }
  renderPreview();
}

function renderPreview() {
  filePreview.innerHTML = selectedFiles.map((f, i) => `
    <div class="tag">
      ${f.name.length > 28 ? f.name.substring(0, 28) + '…' : f.name}
      <span class="remove-tag" data-idx="${i}">&times;</span>
    </div>
  `).join('');

  filePreview.querySelectorAll('.remove-tag').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFiles.splice(parseInt(el.dataset.idx), 1);
      renderPreview();
    });
  });
}

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (selectedFiles.length === 0) return toast('Selecciona al menos un archivo', 'error');

  const fd = new FormData();
  selectedFiles.forEach(f => fd.append('files', f));

  const submitBtn = $('#submitBtn');
  const progress = $('#uploadProgress');
  const progressFill = $('#progressFill');
  const progressPercent = $('#progressPercent');

  submitBtn.disabled = true;
  progress.style.display = 'block';

  try {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
      }
    });

    await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(JSON.parse(xhr.responseText).error));
      };
      xhr.onerror = () => reject(new Error('Error de red'));
      xhr.open('POST', '/api/files');
      xhr.send(fd);
    });

    const count = selectedFiles.length;
    closeModal(uploadModal);
    toast(`${count} archivo(s) subido(s)`, 'success');
    loadFiles();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    progress.style.display = 'none';
    progressFill.style.width = '0%';
  }
});

/* ===== LOAD & RENDER ===== */
async function loadFiles() {
  try {
    const res = await fetch('/api/files');
    allFiles = await res.json();
    renderGallery(allFiles);
  } catch (err) {
    gallery.innerHTML = '<p style="color:var(--danger)">Error al cargar archivos</p>';
  }
}

function getFilteredFiles() {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) return allFiles;
  return allFiles.filter(f => f.original_name.toLowerCase().includes(q));
}

searchInput.addEventListener('input', () => renderGallery(getFilteredFiles()));

function renderGallery(files) {
  const hasSearch = searchInput.value.trim().length > 0;

  if (allFiles.length === 0 && !hasSearch) {
    gallery.innerHTML = '';
    empty.style.display = 'block';
    noResults.style.display = 'none';
    stats.textContent = '';
    return;
  }

  empty.style.display = 'none';

  if (files.length === 0) {
    gallery.innerHTML = '';
    noResults.style.display = 'block';
    stats.textContent = '';
    return;
  }

  noResults.style.display = 'none';

  const totalSize = files.reduce((a, f) => a + f.size, 0);
  stats.textContent = `${files.length} archivo(s) · ${formatSize(totalSize)}`;

  gallery.innerHTML = files.map((f, i) => `
    <div class="card" data-id="${f.id}" style="animation-delay: ${i * 0.04}s">
      <div class="card-preview">
        <span class="card-type-badge">${getExtension(f.original_name)}</span>
        ${f.mimetype.startsWith('image/')
          ? `<img src="/uploads/${f.filename}" alt="${esc(f.original_name)}" loading="lazy">`
          : `<div class="icon-placeholder">${getIcon(f.mimetype)}</div>`}
      </div>
      <div class="card-info">
        <h3 title="${esc(f.original_name)}">${esc(f.original_name)}</h3>
        <div class="meta">
          <span>${formatSize(f.size)}</span>
          <span>${formatDate(f.created_at)}</span>
        </div>
      </div>
    </div>
  `).join('');

  gallery.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => showDetail(parseInt(card.dataset.id)));
  });
}

/* ===== VIEW TOGGLE ===== */
$('#gridViewBtn').addEventListener('click', () => setView('grid'));
$('#listViewBtn').addEventListener('click', () => setView('list'));

function setView(mode) {
  viewMode = mode;
  gallery.classList.toggle('list-view', mode === 'list');
  $('#gridViewBtn').classList.toggle('active', mode === 'grid');
  $('#listViewBtn').classList.toggle('active', mode === 'list');
}

/* ===== HELPERS ===== */
function getIcon(mimetype) {
  if (mimetype.startsWith('video/')) return '🎬';
  if (mimetype.startsWith('audio/')) return '🎵';
  if (mimetype === 'application/pdf') return '📄';
  if (mimetype.includes('zip')) return '📦';
  if (mimetype.startsWith('text/')) return '📝';
  return '📁';
}

function getExtension(name) {
  const ext = name.split('.').pop();
  return ext.length <= 6 ? ext.toUpperCase() : 'FILE';
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'Z');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ===== DETAIL ===== */
async function showDetail(id) {
  try {
    const res = await fetch(`/api/files/${id}`);
    const file = await res.json();
    currentFileId = file.id;

    $('#detailTitle').textContent = file.original_name;

    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    const isAudio = file.mimetype.startsWith('audio/');

    let mediaHtml = '';
    if (isImage) {
      mediaHtml = `<img class="detail-img" src="/uploads/${file.filename}" alt="${esc(file.original_name)}">`;
    } else if (isVideo) {
      mediaHtml = `<video class="detail-img" src="/uploads/${file.filename}" controls></video>`;
    } else if (isAudio) {
      mediaHtml = `<audio style="width:100%;margin-bottom:1rem;border-radius:var(--radius-sm);" src="/uploads/${file.filename}" controls></audio>`;
    }

    $('#detailBody').innerHTML = `
      ${mediaHtml}
      <div class="detail-info">
        <div class="detail-info-row">
          <span class="label">Nombre</span>
          <span class="value">${esc(file.original_name)}</span>
        </div>
        <div class="detail-info-row">
          <span class="label">Tipo</span>
          <span class="value">${file.mimetype}</span>
        </div>
        <div class="detail-info-row">
          <span class="label">Tamaño</span>
          <span class="value">${formatSize(file.size)}</span>
        </div>
        <div class="detail-info-row">
          <span class="label">Subido</span>
          <span class="value">${formatDate(file.created_at)}</span>
        </div>
      </div>
    `;

    $('#detailDownload').href = `/uploads/${file.filename}`;
    $('#detailDownload').download = file.original_name;

    openModal(detailModal);
  } catch (err) {
    toast('Error al cargar detalle', 'error');
  }
}

/* ===== DELETE ===== */
$('#detailDeleteBtn').addEventListener('click', () => {
  closeModal(detailModal);
  openModal(confirmModal);
});

$('#cancelDeleteBtn').addEventListener('click', () => closeModal(confirmModal));

$('#confirmDeleteBtn').addEventListener('click', async () => {
  try {
    await fetch(`/api/files/${currentFileId}`, { method: 'DELETE' });
    closeModal(confirmModal);
    toast('Archivo eliminado', 'success');
    loadFiles();
  } catch (err) {
    toast('Error al eliminar', 'error');
  }
});

/* ===== INIT ===== */
loadFiles();